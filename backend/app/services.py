"""Business logic, kept out of the routers so it can be unit tested and reused
(e.g. by the BIND importer and the seed script)."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from . import dns
from .models import HostedZone, Record, User, ZoneTag
from .schemas import HostedZoneCreate, HostedZoneOut, HostedZoneUpdate, RecordBase, Tag

ALIAS_TYPES = {"A", "AAAA", "CNAME", "CAA", "MX", "NAPTR", "PTR", "SPF", "SRV", "TXT"}


def bad_request(msg: str, code: str = "InvalidInput") -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": code, "message": msg})


def not_found(msg: str, code: str = "NoSuchHostedZone") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": code, "message": msg})


# ================================================================ zones
def zone_to_out(zone: HostedZone, record_count: int) -> HostedZoneOut:
    ns = next((r for r in zone.records if r.is_default and r.type == "NS"), None)
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        type=zone.type,  # type: ignore[arg-type]
        description=zone.description,
        record_count=record_count,
        caller_reference=zone.caller_reference,
        name_servers=[v.rstrip(".") for v in ns.values] if ns else [],
        vpc_region=zone.vpc_region,
        vpc_id=zone.vpc_id,
        tags=[Tag(key=t.key, value=t.value) for t in zone.tags],
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _record_counts(db: Session, zone_ids: list[str]) -> dict[str, int]:
    if not zone_ids:
        return {}
    rows = db.execute(
        select(Record.zone_id, func.count(Record.id)).where(Record.zone_id.in_(zone_ids)).group_by(Record.zone_id)
    ).all()
    return {zid: n for zid, n in rows}


def get_zone(db: Session, user: User, zone_id: str) -> HostedZone:
    zone = db.scalar(
        select(HostedZone)
        .options(selectinload(HostedZone.tags), selectinload(HostedZone.records))
        .where(HostedZone.id == zone_id, HostedZone.owner_id == user.id)
    )
    if not zone:
        raise not_found(f"No hosted zone found with ID: {zone_id}")
    return zone


def zone_out(db: Session, zone: HostedZone) -> HostedZoneOut:
    return zone_to_out(zone, _record_counts(db, [zone.id]).get(zone.id, 0))


ZONE_SORT = {
    "name": HostedZone.name,
    "type": HostedZone.type,
    "description": HostedZone.description,
    "id": HostedZone.id,
    "created_at": HostedZone.created_at,
}


def list_zones(
    db: Session,
    user: User,
    search: str | None,
    zone_type: str | None,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> tuple[list[HostedZoneOut], int]:
    q = select(HostedZone).where(HostedZone.owner_id == user.id)
    if search:
        like = f"%{search.strip().lower()}%"
        q = q.where(
            or_(
                func.lower(HostedZone.name).like(like),
                func.lower(HostedZone.description).like(like),
                func.lower(HostedZone.id).like(like),
                func.lower(HostedZone.type).like(like),
            )
        )
    if zone_type in ("public", "private"):
        q = q.where(HostedZone.type == zone_type)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0

    if sort_by == "record_count":
        cnt = select(func.count(Record.id)).where(Record.zone_id == HostedZone.id).scalar_subquery()
        col = cnt
    else:
        col = ZONE_SORT.get(sort_by, HostedZone.name)
    q = q.order_by(col.desc() if sort_order == "desc" else col.asc(), HostedZone.id)
    q = q.options(selectinload(HostedZone.tags), selectinload(HostedZone.records))
    zones = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
    counts = _record_counts(db, [z.id for z in zones])
    return [zone_to_out(z, counts.get(z.id, 0)) for z in zones], total


def _apply_tags(zone: HostedZone, tags: list[Tag]) -> None:
    seen: set[str] = set()
    for t in tags:
        if t.key in seen:
            raise bad_request(f"Duplicate tag key '{t.key}'.", "InvalidTagKey")
        if t.key.lower().startswith("aws:"):
            raise bad_request("Tag keys can't start with 'aws:'.", "InvalidTagKey")
        seen.add(t.key)
    zone.tags.clear()
    for t in tags:
        zone.tags.append(ZoneTag(key=t.key, value=t.value))


def create_zone(db: Session, user: User, data: HostedZoneCreate) -> HostedZone:
    try:
        name = dns.normalize_zone_name(data.name)
    except dns.DNSValidationError as exc:
        raise bad_request(str(exc), "InvalidDomainName") from exc
    if data.type == "private":
        if not data.vpc_region or not data.vpc_id:
            raise bad_request("A private hosted zone must be associated with a VPC. Choose a Region and a VPC ID.", "InvalidVPCId")
        if data.vpc_region not in dns.AWS_REGIONS:
            raise bad_request(f"Unknown Region '{data.vpc_region}'.", "InvalidVPCId")
    zone = HostedZone(
        id=dns.new_zone_id(),
        owner_id=user.id,
        name=name,
        type=data.type,
        description=data.description.strip(),
        caller_reference=dns.new_caller_reference(),
        vpc_region=data.vpc_region if data.type == "private" else None,
        vpc_id=data.vpc_id if data.type == "private" else None,
    )
    _apply_tags(zone, data.tags)
    ns = dns.generate_name_servers()
    zone.records.append(
        Record(id=dns.new_record_id(), name=name, type="NS", ttl=172800, values_json=_j(ns), is_default=True)
    )
    zone.records.append(
        Record(id=dns.new_record_id(), name=name, type="SOA", ttl=900, values_json=_j([dns.default_soa(ns[0])]), is_default=True)
    )
    db.add(zone)
    db.commit()
    return get_zone(db, user, zone.id)


def update_zone(db: Session, user: User, zone_id: str, data: HostedZoneUpdate) -> HostedZone:
    zone = get_zone(db, user, zone_id)
    if data.description is not None:
        zone.description = data.description.strip()
    if data.tags is not None:
        _apply_tags(zone, data.tags)
    db.commit()
    return get_zone(db, user, zone_id)


def delete_zone(db: Session, user: User, zone_id: str) -> None:
    zone = get_zone(db, user, zone_id)
    extra = [r for r in zone.records if not r.is_default]
    if extra:
        raise bad_request(
            f"The specified hosted zone contains non-required resource record sets ({len(extra)}) and so cannot be deleted. "
            "Delete all records except the NS and SOA records, then try again.",
            "HostedZoneNotEmpty",
        )
    db.delete(zone)
    db.commit()


# ================================================================ records
def _j(values: list[str]) -> str:
    import json

    return json.dumps(values)


REC_SORT = {
    "name": Record.name,
    "type": Record.type,
    "ttl": Record.ttl,
    "routing_policy": Record.routing_policy,
    "set_identifier": Record.set_identifier,
    "created_at": Record.created_at,
}


def list_records(
    db: Session,
    zone: HostedZone,
    search: str | None,
    rtype: str | None,
    routing_policy: str | None,
    alias: str | None,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> tuple[list[Record], int]:
    q = select(Record).where(Record.zone_id == zone.id)
    if search:
        like = f"%{search.strip().lower()}%"
        q = q.where(
            or_(
                func.lower(Record.name).like(like),
                func.lower(Record.values_json).like(like),
                func.lower(Record.type) == search.strip().lower(),
                func.lower(Record.alias_target).like(like),
                func.lower(Record.set_identifier).like(like),
            )
        )
    if rtype:
        types = [t.strip().upper() for t in rtype.split(",") if t.strip()]
        q = q.where(Record.type.in_(types))
    if routing_policy:
        q = q.where(Record.routing_policy.in_([p.strip() for p in routing_policy.split(",")]))
    if alias in ("true", "false"):
        q = q.where(Record.alias == (alias == "true"))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = REC_SORT.get(sort_by, Record.name)
    if sort_by in ("name", "", None):
        # Route 53 lists apex first then alphabetically; keep SOA/NS of apex on top.
        order = [Record.name.desc() if sort_order == "desc" else Record.name.asc(), Record.type, Record.set_identifier]
    else:
        order = [col.desc() if sort_order == "desc" else col.asc(), Record.name]
    q = q.order_by(*order).offset((page - 1) * page_size).limit(page_size)
    return list(db.scalars(q).all()), total


def get_record(db: Session, zone: HostedZone, record_id: str) -> Record:
    rec = db.scalar(select(Record).where(Record.zone_id == zone.id, Record.id == record_id))
    if not rec:
        raise not_found(f"No record found with ID: {record_id}", "NoSuchRecord")
    return rec


def _validate_record(
    db: Session, zone: HostedZone, data: RecordBase, existing: Record | None = None
) -> dict:
    rtype = data.type.strip().upper()
    if existing and existing.is_default:
        # SOA / apex NS: only TTL and values can change.
        if rtype != existing.type or dns.normalize_record_name(data.name, zone.name) != existing.name:
            raise bad_request(f"You can't change the name or type of the default {existing.type} record.", "InvalidChangeBatch")
        if data.alias or data.routing_policy != "simple":
            raise bad_request(f"The default {existing.type} record must use simple routing without alias.", "InvalidChangeBatch")
    elif rtype not in dns.CREATABLE_TYPES:
        raise bad_request(f"Record type '{data.type}' is not supported.", "InvalidChangeBatch")

    try:
        name = dns.normalize_record_name(data.name, zone.name)
    except dns.DNSValidationError as exc:
        raise bad_request(str(exc), "InvalidChangeBatch") from exc

    out: dict = {
        "name": name,
        "type": rtype,
        "routing_policy": data.routing_policy,
        "health_check_id": (data.health_check_id or None),
        "comment": data.comment,
        "set_identifier": "",
        "weight": None,
        "region": None,
        "failover": None,
        "geolocation": None,
    }

    # ---- alias vs. standard values
    if data.alias:
        if rtype not in ALIAS_TYPES:
            raise bad_request(f"Alias records aren't supported for type {rtype}.", "InvalidChangeBatch")
        target = (data.alias_target or "").strip().rstrip(".").lower()
        if not target:
            raise bad_request("Choose an endpoint to route traffic to.", "InvalidChangeBatch")
        if target == name:
            raise bad_request("An alias record can't route traffic to itself.", "InvalidChangeBatch")
        out.update(
            alias=True,
            alias_target=target,
            alias_target_type=data.alias_target_type or "Alias to another record in this hosted zone",
            evaluate_target_health=data.evaluate_target_health,
            ttl=None,
            values_json=_j([]),
        )
    else:
        if data.ttl is None:
            raise bad_request("TTL is required for non-alias records.", "InvalidChangeBatch")
        try:
            values = dns.validate_values(rtype, data.values)
        except dns.DNSValidationError as exc:
            raise bad_request(str(exc), "InvalidChangeBatch") from exc
        out.update(alias=False, alias_target=None, alias_target_type=None, evaluate_target_health=False, ttl=data.ttl, values_json=_j(values))

    # ---- routing policy
    rp = data.routing_policy
    if rp != "simple":
        if existing and existing.is_default:
            pass
        sid = data.set_identifier.strip()
        if not sid:
            raise bad_request("Record ID (set identifier) is required for this routing policy.", "InvalidChangeBatch")
        out["set_identifier"] = sid
        if rp == "weighted":
            if data.weight is None:
                raise bad_request("Weight is required for weighted routing.", "InvalidChangeBatch")
            out["weight"] = data.weight
        elif rp == "latency":
            if data.region not in dns.AWS_REGIONS:
                raise bad_request("Choose a Region for latency routing.", "InvalidChangeBatch")
            out["region"] = data.region
        elif rp == "failover":
            if not data.failover:
                raise bad_request("Choose a failover record type (Primary or Secondary).", "InvalidChangeBatch")
            out["failover"] = data.failover
        elif rp == "geolocation":
            if not data.geolocation:
                raise bad_request("Choose a location for geolocation routing.", "InvalidChangeBatch")
            out["geolocation"] = data.geolocation
        elif rp == "multivalue" and data.alias:
            raise bad_request("Multivalue answer routing doesn't support alias records.", "InvalidChangeBatch")

    # ---- structural rules
    if rtype == "CNAME" and name == zone.name:
        raise bad_request(
            f"RRSet of type CNAME with DNS name {name}. is not permitted at apex in zone {zone.name}.", "InvalidChangeBatch"
        )
    if not (existing and existing.is_default) and rtype == "NS" and name == zone.name:
        raise bad_request("The zone apex already has an NS record. Edit the existing NS record instead.", "InvalidChangeBatch")

    others = db.scalars(select(Record).where(Record.zone_id == zone.id, Record.name == name)).all()
    others = [r for r in others if not existing or r.id != existing.id]
    if rtype == "CNAME" and any(r.type != "CNAME" for r in others):
        raise bad_request(
            f"RRSet of type CNAME with DNS name {name}. is not permitted as it conflicts with other records with the same DNS name in zone {zone.name}.",
            "InvalidChangeBatch",
        )
    if rtype != "CNAME" and any(r.type == "CNAME" for r in others):
        raise bad_request(
            f"RRSet of type {rtype} with DNS name {name}. is not permitted because a conflicting RRSet of type CNAME with the same DNS name already exists in zone {zone.name}.",
            "InvalidChangeBatch",
        )
    same_type = [r for r in others if r.type == rtype]
    for r in same_type:
        if r.set_identifier == out["set_identifier"]:
            raise bad_request(
                f"Tried to create resource record set [name='{name}.', type='{rtype}'"
                + (f", set-identifier='{r.set_identifier}'" if r.set_identifier else "")
                + "] but it already exists",
                "InvalidChangeBatch",
            )
        if (r.routing_policy == "simple") != (rp == "simple") or (rp != "simple" and r.routing_policy != rp):
            raise bad_request(
                f"RRSet with DNS name {name}. and type {rtype} cannot be created because a record with a different routing policy already exists.",
                "InvalidChangeBatch",
            )
    return out


def create_record(db: Session, zone: HostedZone, data: RecordBase, commit: bool = True) -> Record:
    fields = _validate_record(db, zone, data)
    rec = Record(id=dns.new_record_id(), zone_id=zone.id, **fields)
    db.add(rec)
    if commit:
        db.commit()
    else:
        db.flush()
    return rec


def create_records_batch(db: Session, zone: HostedZone, items: list[RecordBase]) -> list[Record]:
    """All-or-nothing, like a Route 53 ChangeBatch."""
    created: list[Record] = []
    try:
        for i, item in enumerate(items):
            try:
                created.append(create_record(db, zone, item, commit=False))
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
                prefix = f"Record {i + 1}: " if len(items) > 1 else ""
                raise bad_request(prefix + detail["message"], detail.get("code", "InvalidChangeBatch")) from exc
        db.commit()
    except Exception:
        db.rollback()
        raise
    return created


def update_record(db: Session, zone: HostedZone, record_id: str, data: RecordBase) -> Record:
    rec = get_record(db, zone, record_id)
    fields = _validate_record(db, zone, data, existing=rec)
    for k, v in fields.items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return rec


def delete_records(db: Session, zone: HostedZone, ids: list[str]) -> tuple[list[str], list[dict]]:
    deleted, failed = [], []
    for rid in ids:
        rec = db.scalar(select(Record).where(Record.zone_id == zone.id, Record.id == rid))
        if not rec:
            failed.append({"id": rid, "message": "Record not found."})
        elif rec.is_default:
            failed.append({"id": rid, "message": f"You can't delete the {rec.type} record that Route 53 created for the zone apex."})
        else:
            db.delete(rec)
            deleted.append(rid)
    db.commit()
    return deleted, failed
