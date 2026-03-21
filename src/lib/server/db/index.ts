import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(db?: D1Database) {
    if (!db) {
        throw new Error("No database configuration found.");
    }
    return drizzle(db, { schema });
}

export type DrizzleClient = ReturnType<typeof getDb>;
