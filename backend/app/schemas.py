"""Pydantic request / response models (the public API contract)."""
from __future__ import annotations

from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

ZoneType = Literal["public", "private"]
RoutingPolicy = Literal["simple", "weighted", "latency", "failover", "geolocation", "multivalue", "ip"]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------- auth
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    account_id: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    username: str
    display_name: str
    account_id: str


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut


# ---------------------------------------------------------------- zones
class Tag(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)


class HostedZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: ZoneType = "public"
    description: str = Field(default="", max_length=256)
    vpc_region: str | None = None
    vpc_id: str | None = None
    tags: list[Tag] = []


class HostedZoneUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=256)
    tags: list[Tag] | None = None


class HostedZoneOut(BaseModel):
    id: str
    name: str
    type: ZoneType
    description: str
    record_count: int
    created_by: str = "Route 53"
    caller_reference: str
    name_servers: list[str]
    vpc_region: str | None
    vpc_id: str | None
    tags: list[Tag]
    created_at: datetime
    updated_at: datetime


class BulkDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)


class BulkDeleteResult(BaseModel):
    deleted: list[str]
    failed: list[dict]


# ---------------------------------------------------------------- records
class RecordBase(BaseModel):
    name: str = Field(default="", max_length=255, description="Relative ('www'), '@' or fully-qualified name")
    type: str
    ttl: int | None = Field(default=300, ge=0, le=2147483647)
    values: list[str] = []
    routing_policy: RoutingPolicy = "simple"
    set_identifier: str = Field(default="", max_length=128)
    weight: int | None = Field(default=None, ge=0, le=255)
    region: str | None = None
    failover: Literal["PRIMARY", "SECONDARY"] | None = None
    geolocation: str | None = None
    health_check_id: str | None = None
    alias: bool = False
    alias_target: str | None = None
    alias_target_type: str | None = None
    evaluate_target_health: bool = False
    comment: str = Field(default="", max_length=256)


class RecordCreate(RecordBase):
    pass


class RecordUpdate(RecordBase):
    pass


class RecordBatchCreate(BaseModel):
    records: list[RecordCreate] = Field(min_length=1, max_length=100)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    zone_id: str
    name: str
    type: str
    ttl: int | None
    values: list[str]
    routing_policy: str
    set_identifier: str
    weight: int | None
    region: str | None
    failover: str | None
    geolocation: str | None
    health_check_id: str | None
    alias: bool
    alias_target: str | None
    alias_target_type: str | None
    evaluate_target_health: bool
    comment: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class ImportRequest(BaseModel):
    zone_file: str = Field(min_length=1, max_length=1_000_000)


class ImportResult(BaseModel):
    created: int
    skipped: int
    records: list[RecordOut]
