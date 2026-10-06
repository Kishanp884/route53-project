"""ORM models.

Schema overview
---------------
users           mocked IAM identities that can sign in
sessions        opaque bearer tokens -> user (session persistence)
hosted_zones    a Route 53 hosted zone, owned by a user
zone_tags       key/value tags attached to a hosted zone
records         DNS resource record sets inside a hosted zone
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    account_id: Mapped[str] = mapped_column(String(12))
    display_name: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    zones: Mapped[list[HostedZone]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class SessionToken(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # e.g. Z0A1B2C3D4E5F6G7H8I9J
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)  # stored without trailing dot
    type: Mapped[str] = mapped_column(String(16), default="public")  # public | private
    description: Mapped[str] = mapped_column(Text, default="")
    caller_reference: Mapped[str] = mapped_column(String(64))
    vpc_region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vpc_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="zones")
    tags: Mapped[list[ZoneTag]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", order_by="ZoneTag.key"
    )
    records: Mapped[list[Record]] = relationship(back_populates="zone", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_zone_owner_name", "owner_id", "name"),)


class ZoneTag(Base):
    __tablename__ = "zone_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(256), default="")

    zone: Mapped[HostedZone] = relationship(back_populates="tags")

    __table_args__ = (UniqueConstraint("zone_id", "key", name="uq_zone_tag_key"),)


class Record(Base):
    __tablename__ = "records"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)  # FQDN, no trailing dot
    type: Mapped[str] = mapped_column(String(8), index=True)
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null for alias records
    values_json: Mapped[str] = mapped_column("values", Text, default="[]")  # JSON list[str]

    routing_policy: Mapped[str] = mapped_column(String(16), default="simple")
    set_identifier: Mapped[str] = mapped_column(String(128), default="")  # '' for simple routing
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    failover: Mapped[str | None] = mapped_column(String(16), nullable=True)  # PRIMARY | SECONDARY
    geolocation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    health_check_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    alias: Mapped[bool] = mapped_column(Boolean, default=False)
    alias_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    alias_target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evaluate_target_health: Mapped[bool] = mapped_column(Boolean, default=False)

    comment: Mapped[str] = mapped_column(Text, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # zone-apex SOA / NS
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    zone: Mapped[HostedZone] = relationship(back_populates="records")

    __table_args__ = (
        UniqueConstraint("zone_id", "name", "type", "set_identifier", name="uq_record_identity"),
        Index("ix_record_zone_type", "zone_id", "type"),
    )

    @property
    def values(self) -> list[str]:
        return json.loads(self.values_json or "[]")

    @values.setter
    def values(self, v: list[str]) -> None:
        self.values_json = json.dumps(list(v))
