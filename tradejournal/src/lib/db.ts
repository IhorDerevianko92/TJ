import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

export type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const globalRef = globalThis as typeof globalThis & {
  __journalPool__?: pg.Pool;
};

function pool(): pg.Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL не задан. Добавь строку подключения Supabase.");
  }
  if (!globalRef.__journalPool__) {
    globalRef.__journalPool__ = new pg.Pool({
      connectionString: databaseUrl,
      ssl: /supabase\.(co|com)|neon\.tech|sslmode=require/i.test(databaseUrl)
        ? { rejectUnauthorized: false }
        : undefined,
      max: /[?&]pgbouncer=true|:6543\b/i.test(databaseUrl) ? 1 : 8,
    });
  }
  return globalRef.__journalPool__;
}

export async function getSql(): Promise<Sql> {
  const p = pool();
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      const res = await p.query(text, params);
      return res.rows as T[];
    },
  };
}
