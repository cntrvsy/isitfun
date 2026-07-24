# SvelteKit + Cloudflare D1 + Better Auth

This project is built using SvelteKit tailored for Cloudflare Workers. It uses **Drizzle ORM** with **Cloudflare D1** for the database, and **Better Auth** for robust authentication.

## 🏗️ Architecture & Implementation Flow

### 1. Database (Cloudflare D1)

Unlike traditional servers with a persistent global database connection, Cloudflare Workers operates in a serverless, per-request environment.

- The Cloudflare D1 database binding (`env.DB`) is injected into the request by SvelteKit's Cloudflare adapter.
- We intercept every request in `src/hooks.server.ts` to initialize a Drizzle instance using this DB binding (`event.platform.env.DB`), and store it into `event.locals.db`. This safely isolates database queries per user request.

### 2. Authentication Flow (Better Auth)

Better Auth typically expects a single initialized global Database Adapter. However, to work harmoniously with Cloudflare D1:

- We export an auth **factory function** (`getAuth(db)`) in `src/lib/server/auth.ts`.
- During each request, right after the database is injected, SvelteKit initializes Better Auth with the scoped database instance (`event.locals.auth = getAuth(event.locals.db)`).
- **Usage**: In any `+page.server.ts` or server endpoint, you can interact with the API securely and declaratively using `event.locals.auth.api...` (e.g., `event.locals.auth.api.getSession()`).
- **CLI Fallback**: For scripts executed by Node.js, we detect the CLI environment and mock the database connection locally (`better-sqlite3` in memory).

### 3. Telemetry Ingestion Flow (Durable Objects & R2)

High-frequency telemetry logging is handled efficiently without overloading the transactional database:

- We auto-inject an `overlay-widget.js` script into the game's `index.html`. This script intercepts console prints and runtime errors, batching them in client-side memory.
- Batched telemetry and heartbeat pings are posted to the `/api/telemetry` endpoint.
- The worker verifies the request (using edge-cached project credentials in KV) and forwards it to a Cloudflare **Durable Object** (`TelemetrySessionDO`).
- The Durable Object acts as a real-time, in-memory buffer, maintaining session state.
- Upon session exit or expiration, the DO writes the raw logs to **Cloudflare R2** as a single JSON file and saves general metadata (e.g. final duration, crash flags) into the **Cloudflare D1** database before destroying itself.

```mermaid
sequenceDiagram
    participant Game as HTML5 Game (iframe)
    participant Client as Overlay Widget (Client)
    participant Edge as Cloudflare Worker (Edge)
    participant DO as Durable Object (Buffer)
    participant R2 as R2 Bucket (Storage)
    participant D1 as D1 Database (Metadata)

    Note over Game, Client: Console & Error Interception
    Game->>Client: print / Debug.Log / console.log
    Client->>Client: Queue in Memory (up to 15s)
    
    Note over Client, Edge: Heartbeat & Logs Ingest
    Client->>Edge: POST /api/telemetry (Heartbeat + Logs)
    Edge->>Edge: Cache Check (KV Project metadata)
    Edge->>DO: Route to TelemetrySessionDO
    DO->>DO: Append to memory state
    Edge-->>Client: HTTP 200 OK (Instant)

    Note over Edge, R2: Session Termination / Exit
    Client->>Edge: POST /api/telemetry (Exit Event)
    Edge->>DO: Terminate Session
    DO->>R2: Save complete log JSON to R2
    DO->>D1: Save summary metadata (duration, count)
    DO->>DO: Self-Destroy
## 🔑 Tier Hard Caps & Access Control System

To prevent unmanaged viral leaks and protect against runaway Cloudflare D1/R2 infrastructure costs, playtest access is protected using a multi-key access system (`project_access_keys`).

### Key Limits by Subscription Tier

Server-side validation enforces maximum usage caps per key (`maxUses`) based on the project/organization tier:

| Tier | Ideal Persona | Max Uses per Key | Write / Session Quota |
|---|---|---|---|
| **Free Jammer Tier** | Game jams & quick testing with friends | **Max 20 uses / key** | 5,000 writes/month |
| **Pro Project Pass** *(One-time Lifetime)* | Solo dev shipping a single game | **Max 100 uses / key** | 50,000 writes/month |
| **Team Subscription** *(Monthly Recurring)* | Active indie game studios & teams | **Max 1,000 uses / key** | 500,000 writes/month |

- **Revocability**: Developers can create, name, toggle (`isActive`), or delete specific keys without revoking access for other legitimate playtesters.
- **Admin Overrides**: Platform admins (`role === 'admin'`) can override tier caps for specific projects directly in `/portal/admin`.

```mermaid
sequenceDiagram
    participant Game as Playtester Browser
    participant Worker as Cloudflare Worker (/play)
    participant D1 as D1 Database

    Game->>Worker: GET /play/proj_123?key=ALPHA-20
    Worker->>D1: Query project_access_keys WHERE code = 'ALPHA-20'
    alt Key is Active & usedCount < maxUses & not expired
        Worker->>D1: Increment usedCount by 1
        Worker-->>Game: Grant Playtest Access (200 OK + Auth Cookie)
    else Key limit exceeded or inactive
        Worker-->>Game: HTTP 403 / Redirect to Access Blocked Gate
    end
```

## 🗄️ Database Migrations

Whenever you modify your database models in `src/lib/server/db/db-schema.ts`, you need to generate migrations and apply them locally or to your production D1 instance.

### Generating Migrations

Run the Drizzle CLI to evaluate your schema and build the corresponding SQL files in `src/lib/server/db/migrations`:

```bash
npm run db:generate
```

### Applying Migrations Locally

Since Wrangler manages Cloudflare resources locally using Miniflare, apply the migration to your local sandbox:

```bash
npx wrangler d1 migrations apply isitfun-db --local
```

### Applying Migrations to Production

When you're ready to deploy your changes to your live Cloudflare deployment, execute:

```bash
npx wrangler d1 migrations apply isitfun-db --remote
```

## 👩‍💻 Local Developer Setting

To develop locally without deploying to a Preview environment, use `wrangler dev` (which SvelteKit orchestrates implicitly during dev):

1. **Install Dependencies**: Ensure you have run `npm install`.
2. **Setup Types**: In an edge environment, Typescript requires your bindings accurately mapped. Auto-generate the bindings from your `wrangler.jsonc` file:
   ```bash
   npm run cf-typegen
   ```
3. **Start Development Server**: Do _NOT_ run `npm run preview`. Start the standard development server, which leverages the Cloudflare Miniflare environment internally:
   ```bash
   npm run dev
   ```

## 🚀 CI/CD Pipeline Setup (GitHub Actions)

Since this project builds into a Cloudflare Worker (instead of Pages), a GitHub Action workflow has been set up at `.github/workflows/deploy.yml` to automatically build and deploy changes to Cloudflare.

### Mechanism

- The pipeline initiates whenever you **push to the `main` branch**.
- **Automatically Applies Migrations**: It runs `wrangler d1 migrations apply isitfun-db --remote` prior to deploying to ensure your database schema is strictly up to date.
- Next, it uses the official `cloudflare/wrangler-action` executing your project's `deploy` step natively.

### Requirements to Get it Running

To get this working, you must add a Cloudflare API Token to your GitHub repository secrets:

1. Go to your [Cloudflare Dashboard Profile -> API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Create an **Edit Cloudflare Workers** API token.
3. Go to your GitHub repository: `Settings > Secrets and variables > Actions`.
4. Add a new repository secret:
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Secret**: _(Paste your generated token from Cloudflare)_

Once set, pushing to `main` will automatically build your SvelteKit node-agnostic dependencies and dispatch them via Wrangler directly to your Edge network!
