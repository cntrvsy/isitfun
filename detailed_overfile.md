# Codebase Routes & Endpoints Detailed Overview

This document provides a detailed overview of every route, page layout, and endpoint in the **IsItFun** codebase. It maps their functional purposes, data flows, authorization guards, and highlights critical architectural and security concerns (e.g. potential attack vectors, anti-patterns, or performance bottlenecks).

---

## 🔑 Base Layouts & Hooks Guard Architecture

### 1. Centralized Hooks Handler
* **Path**: [src/hooks.server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/hooks.server.ts)
* **Functional Purpose**: Sets up the request processing pipeline, initializes the database (D1 client for Cloudflare edge, LibSQL client locally), and handles global session loading and route guards.
* **Authorization & Logic**:
  - Implements role-based access control (RBAC) under `/portal` routes.
  - **Admin Guard**: Restricts `/portal/admin/*` to users with the `admin` role.
  - **Developer Guard**: Restricts `/portal/dashboard/*` to users with `admin` or `game_developer` roles.
  - **Tester Guard**: Restricts `/portal/user/*` to users with `admin`, `game_developer`, or `game_tester` roles.
  - Invokes `svelteKitHandler` from Better Auth to intercept authentication endpoint actions at `/api/auth/*`.
* **Potential Pitfalls / Anti-patterns**:
  - **D1 Binding Fallback**: In non-Cloudflare environments, it falls back to LibSQL/local SQLite. However, it constructs a single global LibSQL connection cache (`let db: DrizzleClient | null`). Under serverless hot-starts, this is fine, but in persistent node.js dev servers, it relies on global state variables.

### 2. Website Layout
* **Path**: [src/routes/(website)/+layout.svelte](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/(website)/+layout.svelte)
* **Functional Purpose**: Wraps public-facing routes (`/`, `/privacy`, `/terms`) with global typography, headers, and footer layouts.

---

## 🎮 Playtest & Proxy Mechanics (Edge Execution)

### 3. Edge-Native Game Proxy
* **Path**: [src/routes/play/[projectId]/[...file]/+server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/play/%5BprojectId%5D/%5B...file%5D/+server.ts)
* **Functional Purpose**: Serves game builds out of the Cloudflare R2 `GAMES_BUCKET` directly at the edge, serving static HTML, JS, CSS, WASM, and PCK assets.
* **Logic & Flows**:
  - Checks if the project exists in D1.
  - Enforces password protection: Checks the browser cookie `play_auth_${projectId}` against the hashed password stored in the database.
  - Appends headers critical for Godot 4 multithreaded runtime support: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
  - Streams the main `index.html` file through Cloudflare's `HTMLRewriter` (or uses a replacement polyfill in local dev) to append the overlay tracking script: `<script src="/assets/overlay-widget.js" ...></script>`.
* **Potential Pitfalls / Anti-patterns**:
  - **R2 Read Overhead**: Every single asset read (such as images, script chunks, or large WASM/PCK game assets) requires a query to D1 database to check project status and password protection. For assets like images and audio that are requested frequently during game load, this introduces excessive D1 database queries, creating a latency bottleneck and running up database read operations.
  - **Lack of Asset Caching Integration with D1**: Although the endpoint sets caching headers for static game assets (`Cache-Control: public, max-age=31536000, immutable`), the worker itself still executes for every request to check project state in D1, defeating the benefit of caching at the Edge network layer (Cloudflare CDN caching should ideally shield the worker).

### 4. Playtest Password Page
* **Path**: [src/routes/(app)/playgame/+page.server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/(app)/playgame/+page.server.ts) / [+page.svelte](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/(app)/playgame/+page.svelte)
* **Functional Purpose**: Renders a simple, clean, password-entry form for protected playtests.
* **Logic & Flows**:
  - Validates `projectId` query parameter and queries the project table.
  - If the project is public, it redirects directly to the `/play/[projectId]` endpoint.
  - Post action `verify` compares the SHA-256 hash of the submitted password with `passwordHash` and stores it in the cookie `play_auth_${projectId}` with a 7-day TTL scoped exclusively to `/play`.
* **Security Pitfalls**:
  - **Weak Password Hashing**: Utilizes a raw SHA-256 hash function (`hashPassword()`) without salt or adaptive hashing algorithms (like bcrypt or argon2) to store/verify passwords:
    ```typescript
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    ```
    If the D1 database is leaked or compromised, playtest passwords can be easily decrypted using offline lookup tables/rainbow attacks.

---

## 📈 API Endpoints (Data Streams & Integrations)

### 5. Edge-Native Telemetry Collector
* **Path**: [src/routes/api/telemetry/+server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/api/telemetry/+server.ts)
* **Functional Purpose**: Ingests high-frequency telemetry events, logs, and play session heartbeats from running web games.
* **Logic & Flows**:
  - Reads request payload containing `projectId`, `sessionId`, and `logType`.
  - Performs edge security quota checks by querying Cloudflare KV namespace at key `quota:project:${projectId}`. If the write count exceeds the tier limit (5,000 for Free, 500,000 for Pro), it blocks requests with a `429 Too Many Requests` code.
  - Rate-limits Free tier sessions to max 3 concurrent active sessions (measured in the last 10 minutes).
  - Anonymizes player IPs using a salted SHA-256 hash signature for GDPR compliance.
  - Uses `platform.ctx.waitUntil` to complete telemetry logs and sessions insertions asynchronously, immediately returning a `200 OK` network response to the client game thread to protect frame rates.
* **Potential Pitfalls / Anti-patterns**:
  - **KV Inconsistencies**: The KV quota count is updated asynchronously via `await kv.put(...)` during the `waitUntil` step. Because KV is eventually consistent, multiple parallel game instances can execute simultaneous writes, bypassing the quota gate limits before KV updates propagate globally.
  - **In-memory/D1 Syncing**: There is no scheduled background worker to sync D1 usage metrics back to KV quotas. The quota counters depend purely on incremental KV writes, which can drift over time.

### 6. Client-Side Decompressed Asset Uploader
* **Path**: [src/routes/api/games/[projectId]/upload/+server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/api/games/%5BprojectId%5D/upload/+server.ts)
* **Functional Purpose**: Receives and uploads decompressed HTML5 game bundle assets into the Cloudflare R2 bucket.
* **Logic & Flows**:
  - Verifies session authentication and project ownership in D1.
  - Checks if the file size exceeds the 40MB limit for Free tier projects.
  - Uploads the stream payload into R2 at key `games/${projectId}/assets/${filePath}` with appropriate MIME content-types derived from the file extension.
* **Security Pitfalls**:
  - **R2 Storage Exhaustion Vulnerability**: The upload API verifies that single file uploads do not exceed the 40MB limit for Free projects, but there is no rate limit on the *number* of uploaded files or the *aggregate* project storage size. A malicious or compromised developer account on a Free tier can flood the endpoint with endless uploads under 40MB, filling the R2 storage bucket.

### 7. Creem Payment Webhook Collector
* **Path**: [src/routes/api/webhooks/creem/+server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/api/webhooks/creem/+server.ts)
* **Functional Purpose**: Receives webhooks from the Creem payment gateway to upgrade projects to the Pro tier and log invoices.
* **Logic & Flows**:
  - Implements an idempotency check: Queries the `processedWebhooks` table to check if the incoming event ID has already been handled.
  - Upgrades project tier status to `pro` and creates an invoice ledger record in the `payments` table inside an atomic SQL transaction block.
* **Critical Security Pitfalls**:
  - **Missing Signature/Token Verification (Critical)**: The webhook collector parses the incoming JSON body and processes the upgrade logic *without checking any cryptographic signature headers or webhook tokens*.
    - Anyone who discovers or guesses this endpoint can easily craft a POST payload with an arbitrary `request_id` (project ID) and status `paid` to upgrade any project to the `pro` tier for free.
    - Implementing verification checks (e.g. comparing HMAC signatures or validating secret headers) is necessary to secure this endpoint.

---

## 🛠️ Developer Management Portal (`/portal/*`)

### 8. Dashboard load & Actions
* **Path**: [src/routes/(app)/portal/dashboard/+page.server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/%28app%29/portal/dashboard/+page.server.ts) / [+page.svelte](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/%28app%29/portal/dashboard/+page.svelte)
* **Functional Purpose**: Renders the developer dashboard showing projects, upgrade options, and upload triggers.
* **Logic & Flows**:
  - Server load pulls all projects owned by the user, eager-loading related `projectQuotas` and `payments` records.
  - **7-Day Log Decay Protocol**: Asynchronously schedules a cleanup task using `waitUntil` to delete telemetry logs older than 7 days for Free tier projects on every dashboard load.
* **Potential Pitfalls / Anti-patterns**:
  - **Inefficient Decay Trigger**: Cleaning up logs older than 7 days inside the *dashboard load path* means data deletion is only triggered when a developer visits their portal. If a developer remains inactive for weeks, old logs will persist in the database, wasting space. A cron job (scheduled Cloudflare Worker trigger) is a much better architectural choice.

### 9. Dashboard Form Actions (Mutations API)
* **Path**: [src/routes/(app)/portal/dashboard/dashboard.remote.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/%28app%29/portal/dashboard/dashboard.remote.ts)
* **Functional Purpose**: Handles project creation, deletion (purging associated files from R2, cascading database records), and payment checkout initiation.
* **Logic & Flows**:
  - **Create Project**: Enforces a strict limit of 1 active free project per user.
  - **Delete Project**: Recursively lists and deletes all associated files in R2 under prefix `games/${projectId}/` before purging D1 records.
  - **Upgrade Project**: Calls Creem checkout creation API, returning the checkout gateway URL. If API credentials are not set (local dev environment), it performs a direct local mock upgrade.
* **Potential Pitfalls / Anti-patterns**:
  - **Unbounded Deletion Loops**: Deleting R2 folders requires listing and looping over objects in a `while (truncated)` block. If a project contains thousands of static files, this loop can easily hit serverless execution execution limits, resulting in a timeout and leaving orphaned files in the R2 bucket.

### 10. Developer Profile & Admin Portal
* **Paths**: [src/routes/(app)/portal/profile/+page.server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/%28app%29/portal/profile/+page.server.ts) / [src/routes/(app)/portal/admin/+page.server.ts](file:///run/media/system/2tbsata/projects/sveltekit/isitfun/src/routes/%28app%29/portal/admin/+page.server.ts)
* **Functional Purpose**: Handles developer profiles and displays global system stats to platform administrators.
* **Data Flow**:
  - Admin load performs raw aggregation queries (`count(*)`) on the `projects`, `telemetrySessions`, `telemetryLogs`, and `user` tables to display dashboard metrics.
* **Potential Pitfalls**:
  - **Performance Degradation at Scale**: Performing `count(*)` queries on active tables like `telemetry_logs` will become extremely slow once the database grows to millions of rows, locking the database and degrading portal performance. These stats should be pre-aggregated and indexed or cached.
