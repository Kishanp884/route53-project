# AWS Route 53 Console Clone

A functional clone of the **Amazon Route 53** console, focused on **hosted zone** and **DNS record** management.
It recreates the Route 53 look, navigation and workflows (tables, filters, pagination, split panel, modals and
flash notifications). It does **not** serve real DNS.

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15 (App Router) + TypeScript + [Cloudscape Design System](https://cloudscape.design) (the open-source design system used by the AWS console) |
| Backend  | FastAPI + SQLAlchemy 2 + Pydantic 2 |
| Database | SQLite |

**Demo login:** account ID `123456789012`, user name `admin`, password `admin123`.

---

## Features

**Authentication (mocked)**
- Sign-in page (root user / IAM user), sign out from the account menu.
- Opaque bearer token stored in the `sessions` table, with expiry; it is kept in `localStorage`, so a page refresh keeps you signed in.
- All API routes except login and health need a valid token. Expired or invalid tokens send you back to sign-in.

**Hosted zones**: full CRUD
- List with a text filter (name, description, ID, type), a type filter, server-side sorting and pagination, and table preferences (page size, visible columns, wrap lines, striped rows).
- Create public or private zones (private needs a Region and VPC ID), with a description and tags.
- Edit the description and tags. As in Route 53, you can't change the domain name.
- Delete with a "type *delete* to confirm" modal. As in Route 53, a zone that still has records other than its default NS/SOA can't be deleted.
- Bulk delete and bulk export of selected zones.
- Each new zone automatically gets an **NS** record (4 `awsdns` name servers) and an **SOA** record.

**DNS records**: full CRUD
- Types: A, AAAA, CNAME, TXT, MX, NS, PTR, SRV and CAA (plus DS, HTTPS, NAPTR, SPF, SSHFP, SVCB, TLSA, stored as-is).
- Per-type value validation (IPv4/IPv6, `priority host` for MX, `priority weight port target` for SRV, `flags tag "value"` for CAA, TXT quoting).
- Route 53 rules: no CNAME at the zone apex, CNAME can't coexist with other types, no duplicate name/type/set identifier, the default SOA/NS can't be deleted (only their TTL and values can change).
- Routing policies: Simple, Weighted, Latency, Failover, Geolocation and Multivalue, with a record ID (set identifier), weight, Region and so on.
- **Alias** records (load balancer, CloudFront, S3, another record in the zone and more) with *Evaluate target health*.
- Quick create of **several records in one atomic batch**.
- Records table with a text search, type, routing policy and alias filters, sorting, pagination and column preferences.
- **Split panel** with record details and an in-place **Edit record** form.
- Bulk delete with a confirmation modal.

**Route 53 experience**
- AWS-style top bar (global search, help, settings, "Global" region, account menu), Route 53 side navigation, breadcrumbs.
- Flashbar notifications for success and error, Info links that open a help panel, empty states and loading states.
- Placeholder "Coming soon" pages for Health checks, Profiles, Traffic policies, Resolver, Domains, DNS Firewall and the other sections. The Dashboard shows live zone counts.

**Bonus**
- ✅ **Import BIND zone files** (paste the text or upload a file). Supports `$ORIGIN`, `$TTL`, `@`, relative names, blank owners, multi-line `( )` and TTL units such as `1h`.
- ✅ **Export hosted zones** as **JSON** or **BIND**.
- ✅ **Dark mode** and **compact density** (Settings menu, or press `d`).
- ✅ **Keyboard shortcuts**: press `?` for the list (`/` filter, `c` create, `r` refresh, `g` then `z` for hosted zones, `g` then `d` for the dashboard, `[` to toggle the nav, `Alt+S` for search).
- ✅ **Bulk operations**: multi-select delete and export for zones, multi-select delete for records, multi-record batch create.

---

## Repository layout

```
.
├── backend/                 FastAPI service
│   ├── app/
│   │   ├── main.py          app factory, CORS, error format, startup (create tables + seed)
│   │   ├── database.py      engine/session, SQLite pragmas (foreign keys, WAL)
│   │   ├── models.py        SQLAlchemy ORM models (schema)
│   │   ├── schemas.py       Pydantic request/response models (API contract)
│   │   ├── services.py      business rules (zones, records, validation, batches)
│   │   ├── dns.py           DNS helpers: name/value validation, IDs, BIND parse/export
│   │   ├── auth.py          mocked auth: password hashing, sessions, `current_user` dependency
│   │   ├── seed.py          demo user + sample zones
│   │   └── routers/         auth.py, zones.py (zones, records, import/export)
│   ├── tests/               pytest API tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                Next.js app
│   └── src/
│       ├── app/
│       │   ├── login/                                   sign-in
│       │   └── route53/v2/
│       │       ├── dashboard/
│       │       ├── hostedzones/                         list
│       │       ├── hostedzones/create/
│       │       ├── hostedzones/[zoneId]/                details + records + split panel
│       │       ├── hostedzones/[zoneId]/edit/
│       │       ├── hostedzones/[zoneId]/records/create/
│       │       ├── hostedzones/[zoneId]/import/
│       │       └── [...slug]/                           "Coming soon" placeholders
│       ├── components/      ConsoleShell (top nav + AppLayout), Navigation, RecordFields, modals…
│       └── lib/             api client, auth/theme/notification contexts, types
└── render.yaml              one-click Render blueprint for the backend
```

---

## Setup (local)

### Prerequisites
Python 3.11+ and Node.js 18.18+ (20+ recommended).

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000. Interactive docs (Swagger): http://localhost:8000/docs
- On first start the SQLite file `route53.db` is created and seeded with the demo user and 5 sample zones.
- Tests: `pip install -r requirements-dev.txt && pytest -q`

Environment variables (see `backend/.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./route53.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | `*` | comma-separated allowed origins |
| `SEED_DEMO_DATA` | `true` | seed demo user and zones on startup |
| `DEMO_USERNAME` / `DEMO_PASSWORD` / `DEMO_ACCOUNT_ID` | `admin` / `admin123` / `123456789012` | demo credentials |
| `SESSION_TTL_HOURS` | `12` | session lifetime |

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local         # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                        # http://localhost:3000
```

Production build: `npm run build && npm start`.

---

## Deployment

**Backend on Render**
1. Push this repo to GitHub.
2. On Render, choose **New > Blueprint** and select the repo. `render.yaml` creates the web service with root `backend/`.
   To set it up by hand instead, create a **Web Service** with root directory `backend`, build command `pip install -r requirements.txt` and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Note the URL, for example `https://route53-clone-api.onrender.com`. Check it at `/api/health`.

**Frontend on Vercel**
1. **Add New > Project**, import the repo and set the **Root Directory** to `frontend`. Vercel detects Next.js.
2. Add the environment variable `NEXT_PUBLIC_API_URL` set to your Render URL (no trailing slash).
3. Deploy.

> On Render's free plan the disk is temporary: the SQLite file resets when the service restarts or redeploys, and it is seeded again with the demo data. The free service also sleeps after inactivity, so the first request can take about 50 seconds. To keep data, attach a Render persistent disk and set `DATABASE_URL=sqlite:////var/data/route53.db`.

---

## Architecture overview

```
 Browser ──► Next.js (Vercel)  ── fetch + Bearer token ──►  FastAPI (Render)  ──►  SQLite
             Cloudscape UI                                   routers → services → ORM
```

- **Frontend.** Client-rendered pages built from Cloudscape components, the same design system the AWS console uses, so tables, forms, split panels, flashbars and dark mode behave like Route 53.
  - `ConsoleShell` holds the shared chrome: top navigation, side navigation, breadcrumbs, flashbar, help panel and keyboard shortcuts.
  - Three React contexts handle **auth** (token, current user, route guard), **notifications** (flashbar queue that survives navigation, so you see "Hosted zone created" after the redirect) and **theme** (dark mode and density, saved in `localStorage`).
  - `lib/api.ts` is a typed API client. It normalises errors into `ApiError(code, message)` and sends you to sign-in on a 401.
  - Tables use **server-side** filtering, sorting and pagination.
- **Backend.** A layered design: **routers** (HTTP, auth dependency, query params) → **services** (business rules, Route 53 semantics, atomic batches) → **models** (SQLAlchemy). Pydantic schemas define the API contract. Errors use a Route 53-like format: `{"detail": {"code": "InvalidChangeBatch", "message": "..."}}`.
- **Data isolation.** Every zone query is scoped to the signed-in user (`owner_id`).

---

## Database schema

```
users
  id PK · username UNIQUE · password_hash (PBKDF2) · account_id · display_name · created_at

sessions
  token PK · user_id FK→users (CASCADE) · created_at · expires_at

hosted_zones
  id PK ("Z" + 20 chars) · owner_id FK→users (CASCADE) · name · type (public|private)
  description · caller_reference · vpc_region · vpc_id · created_at · updated_at
  INDEX (owner_id, name)

zone_tags
  id PK · zone_id FK→hosted_zones (CASCADE) · key · value
  UNIQUE (zone_id, key)

records
  id PK · zone_id FK→hosted_zones (CASCADE) · name (FQDN) · type · ttl (NULL for alias)
  values (JSON array of strings)
  routing_policy · set_identifier ('' for simple) · weight · region · failover · geolocation · health_check_id
  alias · alias_target · alias_target_type · evaluate_target_health
  comment · is_default (zone-apex SOA/NS) · created_at · updated_at
  UNIQUE (zone_id, name, type, set_identifier)   -- Route 53 record-set identity
  INDEX  (zone_id, type)
```

Design notes:
- A row in `records` is a Route 53 **resource record set**: one name and type with many values. The values are stored as a JSON array because they are always read and written together. This mirrors the `ResourceRecords` list in the Route 53 API.
- `set_identifier` defaults to `''` rather than `NULL`, so the UNIQUE constraint also prevents duplicate *simple* records. In SQLite, `NULL`s are never equal to each other.
- `PRAGMA foreign_keys=ON` makes `ON DELETE CASCADE` work, and WAL mode improves concurrent reads.
- The record count is computed with `COUNT(*)` rather than stored, so it can never drift.

---

## API overview

Interactive docs are at **`/docs`** (Swagger) and **`/redoc`**. Every route except login and health needs `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | `{username, password, account_id?}` → `{token, expires_at, user}` |
| POST | `/api/auth/logout` | Revoke the current session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/hostedzones` | List zones. Query: `search`, `type`, `page`, `page_size`, `sort_by` (name, type, record_count, description, id, created_at), `sort_order` |
| POST | `/api/hostedzones` | Create a zone `{name, type, description, vpc_region?, vpc_id?, tags[]}` (adds NS and SOA) |
| GET | `/api/hostedzones/{id}` | Zone details (incl. name servers, tags, record count) |
| PATCH | `/api/hostedzones/{id}` | Update `{description?, tags?}` |
| DELETE | `/api/hostedzones/{id}` | Delete the zone (`400 HostedZoneNotEmpty` if it still has non-default records) |
| POST | `/api/hostedzones/bulk-delete` | `{ids[]}` → `{deleted[], failed[]}` |
| GET | `/api/hostedzones/{id}/export?format=json\|bind` | Export the zone |
| POST | `/api/hostedzones/{id}/import` | `{zone_file}` BIND import → `{created, skipped, records}` |
| GET | `/api/hostedzones/{id}/records` | List records. Query: `search`, `type` (comma list), `routing_policy`, `alias`, `page`, `page_size`, `sort_by`, `sort_order` |
| POST | `/api/hostedzones/{id}/records` | Create one record |
| POST | `/api/hostedzones/{id}/records/batch` | `{records[]}` all-or-nothing create (quick create of several records) |
| GET | `/api/hostedzones/{id}/records/{rid}` | Get a record |
| PUT | `/api/hostedzones/{id}/records/{rid}` | Replace a record |
| DELETE | `/api/hostedzones/{id}/records/{rid}` | Delete a record (default SOA/NS are protected) |
| POST | `/api/hostedzones/{id}/records/bulk-delete` | `{ids[]}` → `{deleted[], failed[]}` |

Record body example:

```json
{
  "name": "api",                 // relative, "@"/"" for apex, or FQDN
  "type": "A",
  "ttl": 60,
  "values": ["198.51.100.1"],
  "routing_policy": "weighted",
  "set_identifier": "api-blue",
  "weight": 80
}
```

---

## Assumptions and mocked parts

- **No real DNS** is served or propagated. Name servers, SOA, caller references and zone IDs are generated to look like Route 53's.
- **Authentication is mocked**: one seeded demo user with a hashed password and DB-backed bearer sessions. There is no real IAM, Organizations, billing or other AWS integration. The account menu items are placeholders.
- **Private hosted zones** accept any VPC ID. VPCs aren't validated.
- **Alias targets** are free-text endpoints, since there are no real AWS resources to choose from. Health checks are free-text IDs.
- **Mocked / Coming soon**: Health checks, Profiles, Traffic flow, Resolver, Domains, DNS Firewall, ARC, DNSSEC signing, query logging and Test record.
- The UI uses the open-source **Cloudscape** design system to match the AWS console's look and feel. Branding is generic ("Route 53 Console", a custom logo); it uses no AWS trademarks or logos.
