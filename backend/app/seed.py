"""Seed a demo user and a few realistic hosted zones on first start."""
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import services
from .auth import hash_password
from .models import User
from .schemas import HostedZoneCreate, RecordCreate, Tag

DEMO_USERNAME = os.getenv("DEMO_USERNAME", "admin")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "admin123")
DEMO_ACCOUNT_ID = os.getenv("DEMO_ACCOUNT_ID", "123456789012")


def seed(db: Session) -> None:
    if db.scalar(select(User).where(User.username == DEMO_USERNAME)):
        return
    user = User(
        username=DEMO_USERNAME,
        password_hash=hash_password(DEMO_PASSWORD),
        account_id=DEMO_ACCOUNT_ID,
        display_name="Admin",
    )
    db.add(user)
    db.commit()

    z1 = services.create_zone(db, user, HostedZoneCreate(
        name="example.com", description="Primary marketing website",
        tags=[Tag(key="Environment", value="production"), Tag(key="Team", value="web")]))
    services.create_records_batch(db, z1, [
        RecordCreate(name="", type="A", ttl=300, values=["192.0.2.10", "192.0.2.11"]),
        RecordCreate(name="www", type="CNAME", ttl=300, values=["example.com"]),
        RecordCreate(name="", type="MX", ttl=3600, values=["10 mail1.example.com", "20 mail2.example.com"]),
        RecordCreate(name="", type="TXT", ttl=300, values=['"v=spf1 include:amazonses.com ~all"', '"google-site-verification=abc123"']),
        RecordCreate(name="", type="CAA", ttl=3600, values=['0 issue "amazon.com"', '0 issuewild "amazon.com"']),
        RecordCreate(name="mail1", type="A", ttl=300, values=["192.0.2.25"]),
        RecordCreate(name="mail2", type="A", ttl=300, values=["192.0.2.26"]),
        RecordCreate(name="ipv6", type="AAAA", ttl=300, values=["2001:db8::1"]),
        RecordCreate(name="_sip._tcp", type="SRV", ttl=300, values=["10 60 5060 sip.example.com"]),
        RecordCreate(name="sip", type="A", ttl=300, values=["192.0.2.40"]),
        RecordCreate(name="api", type="A", ttl=60, values=["198.51.100.1"], routing_policy="weighted", set_identifier="api-blue", weight=80),
        RecordCreate(name="api", type="A", ttl=60, values=["198.51.100.2"], routing_policy="weighted", set_identifier="api-green", weight=20),
        RecordCreate(name="app", type="A", alias=True, alias_target="dualstack.my-alb-1234567890.us-east-1.elb.amazonaws.com",
                     alias_target_type="Alias to Application and Classic Load Balancer", evaluate_target_health=True),
        RecordCreate(name="dev", type="NS", ttl=172800, values=["ns-1.awsdns-01.org.", "ns-2.awsdns-02.co.uk."]),
    ])
    z2 = services.create_zone(db, user, HostedZoneCreate(name="mycompany.io", description="SaaS product domain"))
    services.create_records_batch(db, z2, [
        RecordCreate(name="", type="A", ttl=300, values=["203.0.113.5"]),
        RecordCreate(name="status", type="CNAME", ttl=300, values=["mycompany.statuspage.io"]),
        RecordCreate(name="eu", type="A", ttl=60, values=["203.0.113.20"], routing_policy="latency", set_identifier="eu-west-1", region="eu-west-1"),
        RecordCreate(name="eu", type="A", ttl=60, values=["203.0.113.30"], routing_policy="latency", set_identifier="us-east-1", region="us-east-1"),
    ])
    services.create_zone(db, user, HostedZoneCreate(
        name="internal.corp", type="private", description="Internal service discovery",
        vpc_region="us-east-1", vpc_id="vpc-0a1b2c3d4e5f67890"))
    z4 = services.create_zone(db, user, HostedZoneCreate(name="2.0.192.in-addr.arpa", description="Reverse DNS for 192.0.2.0/24"))
    services.create_records_batch(db, z4, [
        RecordCreate(name="10", type="PTR", ttl=300, values=["example.com"]),
    ])
    services.create_zone(db, user, HostedZoneCreate(name="staging-example.net"))
