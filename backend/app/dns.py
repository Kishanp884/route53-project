"""DNS helpers: name normalisation, per-type value validation, ID generation,
default (SOA/NS) records and BIND zone-file import/export.

No real DNS is served - these helpers only make the stored data look and
behave like Route 53 does.
"""
from __future__ import annotations

import ipaddress
import random
import re
import secrets
import string

RECORD_TYPES = ["A", "AAAA", "CAA", "CNAME", "DS", "HTTPS", "MX", "NAPTR", "NS", "PTR", "SOA", "SPF", "SRV", "SSHFP", "SVCB", "TLSA", "TXT"]
# Types users can create from the UI (SOA is managed automatically).
CREATABLE_TYPES = [t for t in RECORD_TYPES if t != "SOA"]
ROUTING_POLICIES = ["simple", "weighted", "latency", "failover", "geolocation", "multivalue", "ip"]
AWS_REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2", "af-south-1", "ap-east-1", "ap-south-1",
    "ap-northeast-1", "ap-northeast-2", "ap-northeast-3", "ap-southeast-1", "ap-southeast-2",
    "ca-central-1", "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
    "eu-south-1", "me-south-1", "sa-east-1",
]

_LABEL_RE = re.compile(r"^(\*|[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)$", re.I)
_HOST_RE = re.compile(r"^([a-z0-9_*]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.?$", re.I)


class DNSValidationError(ValueError):
    """Raised with a Route 53-style, user facing message."""


# ---------------------------------------------------------------- ids
def new_zone_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "Z" + "".join(secrets.choice(alphabet) for _ in range(20))


def new_record_id() -> str:
    return secrets.token_hex(8)


def new_caller_reference() -> str:
    return secrets.token_hex(12)


def generate_name_servers() -> list[str]:
    """Route 53 style delegation set: one .com/.net/.org/.co.uk server each."""
    tlds = ["com", "net", "org", "co.uk"]
    return [f"ns-{random.randint(1, 2047)}.awsdns-{random.randint(0, 63):02d}.{tld}." for tld in tlds]


# ---------------------------------------------------------------- names
def normalize_zone_name(name: str) -> str:
    name = (name or "").strip().lower().rstrip(".")
    if not name:
        raise DNSValidationError("Domain name is required.")
    if len(name) > 253:
        raise DNSValidationError("Domain name can't be longer than 253 characters.")
    labels = name.split(".")
    for label in labels:
        if not label or not _LABEL_RE.match(label) or label == "*":
            raise DNSValidationError(
                f"The domain name '{name}' is not valid. Use only letters, numbers, hyphens and periods; "
                "labels can't start or end with a hyphen."
            )
    return name


def normalize_record_name(name: str, zone_name: str) -> str:
    """Accepts '', '@', 'www', 'www.example.com' or 'www.example.com.' and returns an FQDN."""
    raw = (name or "").strip().lower().rstrip(".")
    if raw in ("", "@"):
        return zone_name
    if raw == zone_name or raw.endswith("." + zone_name):
        fqdn = raw
    else:
        fqdn = f"{raw}.{zone_name}"
    for label in fqdn.split("."):
        if not label or not _LABEL_RE.match(label):
            raise DNSValidationError(f"Record name '{fqdn}' contains an invalid label.")
    if len(fqdn) > 253:
        raise DNSValidationError("Record name can't be longer than 253 characters.")
    return fqdn


# ---------------------------------------------------------------- values
def _hostname(v: str, what: str = "domain name") -> str:
    if not _HOST_RE.match(v):
        raise DNSValidationError(f"'{v}' is not a valid {what}.")
    return v


def _int(v: str, lo: int, hi: int, what: str) -> int:
    try:
        n = int(v)
    except ValueError as exc:
        raise DNSValidationError(f"{what} must be an integer between {lo} and {hi}.") from exc
    if not lo <= n <= hi:
        raise DNSValidationError(f"{what} must be between {lo} and {hi}.")
    return n


def _validate_value(rtype: str, value: str) -> str:
    v = value.strip()
    if not v:
        raise DNSValidationError("Value can't be empty.")
    if rtype == "A":
        try:
            ipaddress.IPv4Address(v)
        except ValueError as exc:
            raise DNSValidationError(f"Bad request. (Invalid Resource Record: 'ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address)' encountered with '{v}')") from exc
    elif rtype == "AAAA":
        try:
            v = str(ipaddress.IPv6Address(v))
        except ValueError as exc:
            raise DNSValidationError(f"'{v}' is not a valid IPv6 address.") from exc
    elif rtype in ("CNAME", "NS", "PTR"):
        _hostname(v)
    elif rtype == "MX":
        parts = v.split()
        if len(parts) != 2:
            raise DNSValidationError(f"MX value '{v}' must be in the format '[priority] [mail server host name]', e.g. '10 mail.example.com'.")
        _int(parts[0], 0, 65535, "MX priority")
        _hostname(parts[1], "mail server host name")
        v = f"{int(parts[0])} {parts[1]}"
    elif rtype == "SRV":
        parts = v.split()
        if len(parts) != 4:
            raise DNSValidationError(f"SRV value '{v}' must be in the format '[priority] [weight] [port] [server host name]', e.g. '1 10 5269 xmpp-server.example.com.'")
        _int(parts[0], 0, 65535, "SRV priority")
        _int(parts[1], 0, 65535, "SRV weight")
        _int(parts[2], 0, 65535, "SRV port")
        _hostname(parts[3], "server host name")
    elif rtype in ("TXT", "SPF"):
        if not (v.startswith('"') and v.endswith('"')):
            v = '"' + v.replace('"', '\\"') + '"'
        if len(v) > 4000:
            raise DNSValidationError("TXT value is too long.")
    elif rtype == "CAA":
        m = re.match(r'^(\d+)\s+(issue|issuewild|iodef|issuemail)\s+(".*")$', v, re.I)
        if not m:
            raise DNSValidationError(f"CAA value '{v}' must be in the format '[flags] [tag] \"[value]\"', e.g. '0 issue \"amazon.com\"'.")
        _int(m.group(1), 0, 255, "CAA flags")
        v = f"{int(m.group(1))} {m.group(2).lower()} {m.group(3)}"
    elif rtype == "SOA":
        if len(v.split()) != 7:
            raise DNSValidationError("SOA value must contain 7 fields.")
    # Other types (DS, HTTPS, NAPTR, SSHFP, SVCB, TLSA) are stored as-is.
    return v


def validate_values(rtype: str, values: list[str]) -> list[str]:
    cleaned = [_validate_value(rtype, v) for v in values if v and v.strip()]
    if not cleaned:
        raise DNSValidationError("You must specify at least one value.")
    if rtype in ("CNAME", "SOA") and len(cleaned) > 1:
        raise DNSValidationError(f"A {rtype} record can contain only one value.")
    if len(set(cleaned)) != len(cleaned):
        raise DNSValidationError("Duplicate values aren't allowed in the same record.")
    return cleaned


def default_soa(primary_ns: str) -> str:
    return f"{primary_ns} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"


# ---------------------------------------------------------------- BIND
def export_bind(zone_name: str, records: list[dict]) -> str:
    lines = [f"$ORIGIN {zone_name}.", "$TTL 300", f"; Exported from Route 53 clone - zone {zone_name}", ""]
    order = {"SOA": 0, "NS": 1}
    for r in sorted(records, key=lambda r: (order.get(r["type"], 2), r["name"], r["type"])):
        if r.get("alias"):
            lines.append(f"; ALIAS {r['name']}. {r['type']} -> {r.get('alias_target')} (not representable in BIND)")
            continue
        owner = "@" if r["name"] == zone_name else r["name"][: -(len(zone_name) + 1)]
        for v in r["values"]:
            lines.append(f"{owner:<24} {r['ttl'] or 300:<7} IN  {r['type']:<6} {v}")
    return "\n".join(lines) + "\n"


def _strip_comment(line: str) -> str:
    out, in_q = [], False
    for ch in line:
        if ch == '"':
            in_q = not in_q
        if ch == ";" and not in_q:
            break
        out.append(ch)
    return "".join(out)


_TTL_UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


def _parse_ttl(tok: str) -> int | None:
    if tok.isdigit():
        return int(tok)
    m = re.fullmatch(r"(\d+[smhdw])+", tok.lower())
    if not m:
        return None
    return sum(int(n) * _TTL_UNITS[u] for n, u in re.findall(r"(\d+)([smhdw])", tok.lower()))


def parse_bind(text: str, zone_name: str) -> list[dict]:
    """Very small BIND parser: supports $ORIGIN, $TTL, parentheses, '@', relative
    names, blank owner (repeat previous) and the record types we support.
    Returns a list of {name, type, ttl, values} grouped by (name, type)."""
    origin = zone_name
    default_ttl = 300
    last_owner = zone_name
    # join multi-line parentheses
    joined, buf, depth = [], "", 0
    for raw in text.splitlines():
        line = _strip_comment(raw).rstrip()
        if not line.strip() and depth == 0:
            continue
        depth += line.count("(") - line.count(")")
        buf += (" " if buf else "") + (line if not buf else line.strip())
        if depth <= 0:
            joined.append(buf.replace("(", " ").replace(")", " "))
            buf, depth = "", 0
    groups: dict[tuple[str, str], dict] = {}
    for line in joined:
        starts_blank = line[:1] in (" ", "\t")
        toks = line.split()
        if not toks:
            continue
        if toks[0].upper() == "$ORIGIN":
            origin = toks[1].lower().rstrip(".")
            continue
        if toks[0].upper() == "$TTL":
            default_ttl = _parse_ttl(toks[1]) or default_ttl
            continue
        if toks[0].startswith("$"):
            continue
        if starts_blank:
            owner = last_owner
        else:
            o = toks.pop(0)
            if o == "@":
                owner = origin
            elif o.endswith("."):
                owner = o.lower().rstrip(".")
            else:
                owner = f"{o.lower()}.{origin}"
            last_owner = owner
        ttl = default_ttl
        rtype = None
        while toks:
            t = toks.pop(0)
            up = t.upper()
            if up in ("IN", "CH", "HS"):
                continue
            pt = _parse_ttl(t)
            if pt is not None and rtype is None and up not in RECORD_TYPES:
                ttl = pt
                continue
            if up in RECORD_TYPES:
                rtype = up
                break
            raise DNSValidationError(f"Unsupported or malformed line in zone file: '{line.strip()}'")
        if not rtype:
            raise DNSValidationError(f"Missing record type in line: '{line.strip()}'")
        rdata = " ".join(toks)
        if rtype in ("CNAME", "NS", "PTR") and not rdata.endswith(".") and rdata != "@":
            rdata = f"{rdata}.{origin}"
        if rdata == "@":
            rdata = origin
        if rtype in ("MX", "SRV"):
            parts = rdata.split()
            if parts and parts[-1] == "@":
                parts[-1] = origin
            elif parts and not parts[-1].endswith("."):
                parts[-1] = f"{parts[-1]}.{origin}"
            rdata = " ".join(parts)
        if not (owner == zone_name or owner.endswith("." + zone_name)):
            raise DNSValidationError(f"Record '{owner}' is not in zone '{zone_name}'.")
        g = groups.setdefault((owner, rtype), {"name": owner, "type": rtype, "ttl": ttl, "values": []})
        if rdata not in g["values"]:
            g["values"].append(rdata)
    return list(groups.values())
