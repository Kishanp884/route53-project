import type { BulkDeleteResult, DnsRecord, HostedZone, Page, RecordInput, Tag, User } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "r53.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(t: string) {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}, raw = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "NetworkError", "Unable to reach the Route 53 API. Check that the backend is running.");
  }
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    tokenStore.clear();
    onUnauthorized?.();
  }
  if (!res.ok) {
    let code = "Error";
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      const d = body.detail;
      if (typeof d === "string") message = d;
      else if (d?.message) {
        message = d.message;
        code = d.code ?? code;
      }
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (raw ? res.text() : res.json()) as Promise<T>;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export interface ListParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export const api = {
  login: (username: string, password: string, account_id?: string) =>
    request<{ token: string; expires_at: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, account_id: account_id || null }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),

  listZones: (p: ListParams & { type?: string }) => request<Page<HostedZone>>(`/api/hostedzones${qs({ ...p })}`),
  getZone: (id: string) => request<HostedZone>(`/api/hostedzones/${id}`),
  createZone: (body: {
    name: string;
    type: string;
    description: string;
    vpc_region?: string | null;
    vpc_id?: string | null;
    tags: Tag[];
  }) => request<HostedZone>("/api/hostedzones", { method: "POST", body: JSON.stringify(body) }),
  updateZone: (id: string, body: { description?: string; tags?: Tag[] }) =>
    request<HostedZone>(`/api/hostedzones/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteZone: (id: string) => request<void>(`/api/hostedzones/${id}`, { method: "DELETE" }),
  bulkDeleteZones: (ids: string[]) =>
    request<BulkDeleteResult>("/api/hostedzones/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
  exportZone: (id: string, format: "json" | "bind") =>
    request<string>(`/api/hostedzones/${id}/export${qs({ format })}`, {}, true),
  importZone: (id: string, zone_file: string) =>
    request<{ created: number; skipped: number; records: DnsRecord[] }>(`/api/hostedzones/${id}/import`, {
      method: "POST",
      body: JSON.stringify({ zone_file }),
    }),

  listRecords: (zoneId: string, p: ListParams & { type?: string; routing_policy?: string; alias?: string }) =>
    request<Page<DnsRecord>>(`/api/hostedzones/${zoneId}/records${qs({ ...p })}`),
  createRecords: (zoneId: string, records: Partial<RecordInput>[]) =>
    request<DnsRecord[]>(`/api/hostedzones/${zoneId}/records/batch`, {
      method: "POST",
      body: JSON.stringify({ records }),
    }),
  updateRecord: (zoneId: string, id: string, body: Partial<RecordInput>) =>
    request<DnsRecord>(`/api/hostedzones/${zoneId}/records/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  bulkDeleteRecords: (zoneId: string, ids: string[]) =>
    request<BulkDeleteResult>(`/api/hostedzones/${zoneId}/records/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
