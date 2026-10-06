import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from .. import dns, services
from ..auth import current_user
from ..database import get_db
from ..models import User
from ..schemas import (
    BulkDeleteRequest,
    BulkDeleteResult,
    HostedZoneCreate,
    HostedZoneOut,
    HostedZoneUpdate,
    ImportRequest,
    ImportResult,
    Page,
    RecordBatchCreate,
    RecordCreate,
    RecordOut,
    RecordUpdate,
)

router = APIRouter(prefix="/api/hostedzones", tags=["hosted zones"])


# ------------------------------------------------------------------ zones
@router.get("", response_model=Page[HostedZoneOut])
def list_hosted_zones(
    search: str | None = None,
    type: Literal["public", "private"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    items, total = services.list_zones(db, user, search, type, page, page_size, sort_by, sort_order)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=HostedZoneOut, status_code=201)
def create_hosted_zone(body: HostedZoneCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    zone = services.create_zone(db, user, body)
    return services.zone_out(db, zone)


@router.post("/bulk-delete", response_model=BulkDeleteResult)
def bulk_delete_zones(body: BulkDeleteRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deleted, failed = [], []
    for zid in body.ids:
        try:
            services.delete_zone(db, user, zid)
            deleted.append(zid)
        except HTTPException as exc:
            failed.append({"id": zid, "message": exc.detail["message"] if isinstance(exc.detail, dict) else str(exc.detail)})
    return BulkDeleteResult(deleted=deleted, failed=failed)


@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_hosted_zone(zone_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return services.zone_out(db, services.get_zone(db, user, zone_id))


@router.patch("/{zone_id}", response_model=HostedZoneOut)
def update_hosted_zone(
    zone_id: str, body: HostedZoneUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    return services.zone_out(db, services.update_zone(db, user, zone_id, body))


@router.delete("/{zone_id}", status_code=204)
def delete_hosted_zone(zone_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    services.delete_zone(db, user, zone_id)
    return Response(status_code=204)


# ------------------------------------------------------------------ export / import
@router.get("/{zone_id}/export")
def export_zone(
    zone_id: str,
    format: Literal["json", "bind"] = "json",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    zone = services.get_zone(db, user, zone_id)
    recs = [RecordOut.model_validate(r).model_dump(mode="json") for r in sorted(zone.records, key=lambda r: (r.name, r.type))]
    if format == "bind":
        return Response(
            dns.export_bind(zone.name, recs),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{zone.name}.zone"'},
        )
    payload = services.zone_out(db, zone).model_dump(mode="json")
    payload["records"] = recs
    return Response(
        json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{zone.name}.json"'},
    )


@router.post("/{zone_id}/import", response_model=ImportResult)
def import_zone_file(zone_id: str, body: ImportRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Import records from a BIND zone file. SOA and apex NS lines are skipped
    (Route 53 keeps its own), as are records that already exist. All-or-nothing."""
    zone = services.get_zone(db, user, zone_id)
    try:
        parsed = dns.parse_bind(body.zone_file, zone.name)
    except dns.DNSValidationError as exc:
        raise services.bad_request(str(exc), "InvalidZoneFile") from exc
    existing = {(r.name, r.type) for r in zone.records}
    to_create, skipped = [], 0
    for p in parsed:
        if p["type"] == "SOA" or (p["type"] == "NS" and p["name"] == zone.name) or (p["name"], p["type"]) in existing:
            skipped += 1
            continue
        to_create.append(RecordCreate(name=p["name"], type=p["type"], ttl=p["ttl"], values=p["values"]))
    if not to_create:
        return ImportResult(created=0, skipped=skipped, records=[])
    created = services.create_records_batch(db, zone, to_create)
    return ImportResult(created=len(created), skipped=skipped, records=[RecordOut.model_validate(r) for r in created])


# ------------------------------------------------------------------ records
@router.get("/{zone_id}/records", response_model=Page[RecordOut])
def list_records(
    zone_id: str,
    search: str | None = None,
    type: str | None = Query(None, description="Comma separated record types"),
    routing_policy: str | None = None,
    alias: Literal["true", "false"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=300),
    sort_by: str = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    zone = services.get_zone(db, user, zone_id)
    items, total = services.list_records(
        db, zone, search, type, routing_policy, alias, page, page_size, sort_by, sort_order
    )
    return Page(items=[RecordOut.model_validate(r) for r in items], total=total, page=page, page_size=page_size)


@router.post("/{zone_id}/records", response_model=RecordOut, status_code=201)
def create_record(zone_id: str, body: RecordCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    zone = services.get_zone(db, user, zone_id)
    return services.create_records_batch(db, zone, [body])[0]


@router.post("/{zone_id}/records/batch", response_model=list[RecordOut], status_code=201)
def create_records(
    zone_id: str, body: RecordBatchCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    zone = services.get_zone(db, user, zone_id)
    return services.create_records_batch(db, zone, body.records)


@router.post("/{zone_id}/records/bulk-delete", response_model=BulkDeleteResult)
def bulk_delete_records(
    zone_id: str, body: BulkDeleteRequest, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    zone = services.get_zone(db, user, zone_id)
    deleted, failed = services.delete_records(db, zone, body.ids)
    return BulkDeleteResult(deleted=deleted, failed=failed)


@router.get("/{zone_id}/records/{record_id}", response_model=RecordOut)
def get_record(zone_id: str, record_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    zone = services.get_zone(db, user, zone_id)
    return services.get_record(db, zone, record_id)


@router.put("/{zone_id}/records/{record_id}", response_model=RecordOut)
def update_record(
    zone_id: str, record_id: str, body: RecordUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    zone = services.get_zone(db, user, zone_id)
    return services.update_record(db, zone, record_id, body)


@router.delete("/{zone_id}/records/{record_id}", status_code=204)
def delete_record(zone_id: str, record_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    zone = services.get_zone(db, user, zone_id)
    deleted, failed = services.delete_records(db, zone, [record_id])
    if failed:
        msg = failed[0]["message"]
        if msg == "Record not found.":
            raise services.not_found(msg, "NoSuchRecord")
        raise services.bad_request(msg, "InvalidChangeBatch")
    return Response(status_code=204)
