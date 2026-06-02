# AI Agent Onboarding Brief: `isitfun.frstudios.co.ke`

Welcome, Agent. This document acts as your ground-truth blueprint for **IsItFun**—an edge-native QA, validation, and telemetry platform tailored specifically for indie developers exporting Godot 4 (and general HTML5) games.

Our core philosophy is **zero-friction technical observation**—helping solo devs answer "Is it fun?" and debug structural failures without forcing playtesters to log in, install desktop executables, or manually open browser developer consoles.

---

## 1. System Architecture & Tech Stack

To maintain an near-zero cost signature and minimize structural friction, the system is consolidated into a **unified single-domain codebase** deployed on the Cloudflare edge network.

- **Framework:** SvelteKit (Svelte 5) configured via `@sveltejs/adapter-cloudflare`. Every API and route compiles down to a native Cloudflare Workers environment.
- **Database:** Cloudflare D1 (`isitfun-db`) managed using Drizzle ORM.
- **Storage:** Cloudflare R2 for storing unzipped static game assets (`index.html`, `.wasm`, `.pck`).
- **Edge Cache / Flags:** Cloudflare KV for maintaining project security passwords, active configurations, and live billing metrics/quotas.
- **Identity System:** Better-Auth managing OAuth registration (Google/GitHub).

---

## 2. Core Relational Schema (`src/lib/server/db/schema.ts`)

When interacting with the database, strictly implement the following architectural map:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Better-Auth Core Tables
export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
    image: text('image'),
    role: text('role').default('developer'), // 'admin' | 'developer'
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
    userId: text('userId').notNull().references(() => user.id),
});

export const account = sqliteTable('account', {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId').notNull().references(() => user.id),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    expiresAt: integer('expiresAt'),
    password: text('password'),
});

// IsItFun Platform Tables
export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(), // Generated NanoID string
    userId: text('userId').notNull().references(() => user.id),
    name: text('name').notNull(),
    passwordProtected: integer('passwordProtected', { mode: 'boolean' }).default(false),
    passwordHash: text('passwordHash'),
    tier: text('tier').default('free'), // 'free' | 'pro'
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const telemetrySessions = sqliteTable('telemetry_sessions', {
    id: text('id').primaryKey(), // Generated per testing game initialization
    projectId: text('projectId').notNull().references(() => projects.id),
    deviceHash: text('deviceHash').notNull(), // Salted SHA256 IP for GDPR anonymity
    browserInfo: text('browserInfo'),
    duration: integer('duration').default(0), // Aggregated in-game time in seconds
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const telemetryLogs = sqliteTable('telemetry_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('sessionId').notNull().references(() => telemetrySessions.id),
    projectId: text('projectId').notNull().references(() => projects.id),
    logType: text('logType').notNull(), // 'error' | 'log' | 'heartbeat' | 'bug_report'
    payload: text('payload').notNull(), // Text-serialized JSON object
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

```

---

## 3. Scoped Routing & Critical Execution Paths

### 🔑 Authentication Boundaries

To prevent untrusted web games executing on the same domain from fetching developer details, restrict Better-Auth cookie availability using targeted browser scopes. Set your base configurations explicitly to the management area:

```typescript
advanced: {
    cookieOptions: {
        path: "/dashboard", // Isolates administration sessions away from public game streams
    }
}

```

### 🛠️ Flow A: The Developer Portal (`/dashboard`)

- **The Ingestion Trap:** Decompressing large zip bundles inside an ephemeral serverless execution window easily triggers platform timeout boundaries.
- **Your Strategy:** Perform zip extraction entirely on the client side using browser tools (e.g., `fflate`). The UI must parse the bundle locally, loop through individual file arrays, and stream them incrementally to the R2 bucket asset pipeline under `games/[projectId]/assets/...`.

### 🎮 Flow B: The Game Proxy (`/play/[projectId]/[...file]`)

This unified catch-all routing file handles dynamic game execution and proxy operations.

- **Godot 4 Multi-threading Support:** You must append `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to headers for every proxied asset request to unlock modern desktop browser memory multithreading features (`SharedArrayBuffer`).
- **The Stream Transformation:** When reading `index.html`, do not pull the entire content array into memory. Stream it through the native edge engine `HTMLRewriter` to append our active tracking tracking widget before delivery:

```typescript
new HTMLRewriter().on('body', {
    element(el) {
        el.append(`<script src="/assets/overlay-widget.js" data-project="${projectId}"></script>`, { html: true });
    }
})

```

````

### 📊 Flow C: Telemetry Processing (`/api/telemetry`)
*   **Edge Security Checks:** Before performing any writes, execute a sub-millisecond key-value lookup against Cloudflare KV tracking the corresponding `quota:project:[id]` metric. If counts exceed subscription tier limits, immediately block operations using a `429 Too Many Requests` code.
*   **Zero Performance Penalties:** Playtesters must not experience dropped frame counts due to tracking round-trips. Wrap incoming database operations inside an active context tracking method:
    ```typescript
platform?.context.waitUntil(
    db.insert(telemetryLogs).values({ ... })
);

````

```
This delivers an instant `200 OK` network completion message to the running play session, finalizing D1 record creation asynchronously in the background.

```

---

## 4. Current Directive For the Agent

When writing, refactoring, or optimizing code inside this repository:

1. **Enforce single-domain simplicity.** Reject attempts to decouple pipelines into separate microservices or isolated subdomain infrastructures.
2. **Protect the edge runtime.** Keep execution paths clean, minimize dependencies, use client-side computation where appropriate, and leverage `waitUntil` for background analytics writes.
3. **Strictly adhere to Svelte 5 runes** (`$state`, `$derived`, `$props`) for all UI work across components.
