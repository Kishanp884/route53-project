export type ZoneType = "public" | "private";
export type RoutingPolicy = "simple" | "weighted" | "latency" | "failover" | "geolocation" | "multivalue" | "ip";

export interface Tag {
  key: string;
  value: string;
}

export interface User {
  username: string;
  display_name: string;
  account_id: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface HostedZone {
  id: string;
  name: string;
  type: ZoneType;
  description: string;
  record_count: number;
  created_by: string;
  caller_reference: string;
  name_servers: string[];
  vpc_region: string | null;
  vpc_id: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface DnsRecord {
  id: string;
  zone_id: string;
  name: string;
  type: string;
  ttl: number | null;
  values: string[];
  routing_policy: RoutingPolicy;
  set_identifier: string;
  weight: number | null;
  region: string | null;
  failover: "PRIMARY" | "SECONDARY" | null;
  geolocation: string | null;
  health_check_id: string | null;
  alias: boolean;
  alias_target: string | null;
  alias_target_type: string | null;
  evaluate_target_health: boolean;
  comment: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type RecordInput = Omit<DnsRecord, "id" | "zone_id" | "is_default" | "created_at" | "updated_at">;

export interface BulkDeleteResult {
  deleted: string[];
  failed: { id: string; message: string }[];
}
