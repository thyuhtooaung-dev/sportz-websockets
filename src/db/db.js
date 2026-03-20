import "dotenv/config"
import {drizzle} from "drizzle-orm/node-postgres"
import pg from "pg"

if (!process.env.DATABASE_URL) {
    throw new Error ("DATABASE_URL environment variable is missing")
}

export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
})

export const db = drizzle(pool)
