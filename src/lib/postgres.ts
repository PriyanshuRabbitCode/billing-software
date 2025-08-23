import { Pool, QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL env var is required for PostgreSQL connection');
  }

  pool = new Pool({ connectionString });
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const client = await getPool().connect();
  try {
    const res = await client.query<T>(text, params);
    return { rows: res.rows };
  } finally {
    client.release();
  }
}



