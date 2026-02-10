/**
 * Supabase-compatible client backed by a local PostgreSQL connection.
 *
 * Implements the subset of the Supabase JS client API used by our API routes:
 *   .from(table).select(cols).eq(col, val).gte(col, val).order(col, opts).limit(n).single()
 *   .from(table).select(cols, { count: 'exact', head: true }).eq(col, val)
 *   .from(table).upsert(rows, { onConflict: 'col' })
 *   .from(table).insert(rows)
 *   .from(table).delete().neq(col, val)
 *
 * All queries return { data, error, count? } — never throw.
 */

import { Pool, types } from 'pg';

// Parse NUMERIC/DECIMAL as JavaScript numbers (pg returns strings by default).
// OID 1700 = NUMERIC, 20 = INT8/BIGINT, 701 = FLOAT8
types.setTypeParser(1700, (val: string) => parseFloat(val));

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: parseInt(process.env.PGPORT ?? '5432', 10),
  user: process.env.PGUSER ?? 'postgres',
  database: process.env.PGDATABASE ?? 'tsi_oracle',
});

// ─── Query Builder ──────────────────────────────────────────────────

type FilterOp = { column: string; op: string; value: unknown };
type OrderSpec = { column: string; ascending: boolean };

interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
  count?: number | null;
}

class QueryBuilder {
  private table: string;
  private columns: string;
  private filters: FilterOp[] = [];
  private orders: OrderSpec[] = [];
  private limitVal: number | null = null;
  private isSingle = false;
  private countMode: 'exact' | null = null;
  private headMode = false;

  // Mutation state
  private mode: 'select' | 'insert' | 'upsert' | 'delete' = 'select';
  private rows: Record<string, unknown>[] = [];
  private conflictCol: string | null = null;

  constructor(table: string) {
    this.table = table;
    this.columns = '*';
  }

  select(cols?: string, opts?: { count?: 'exact'; head?: boolean }): this {
    this.mode = 'select';
    this.columns = cols ?? '*';
    if (opts?.count === 'exact') this.countMode = 'exact';
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = 'insert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): this {
    this.mode = 'upsert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.conflictCol = opts?.onConflict ?? null;
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, op: '=', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, op: '!=', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, op: '>=', value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  single(): this {
    this.isSingle = true;
    this.limitVal = 1;
    return this;
  }

  // ── Execute (thenable) ─────────────────────────────────────────

  async then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute(): Promise<QueryResult> {
    try {
      switch (this.mode) {
        case 'select':
          return await this.executeSelect();
        case 'insert':
          return await this.executeInsert();
        case 'upsert':
          return await this.executeUpsert();
        case 'delete':
          return await this.executeDelete();
        default:
          return { data: null, error: { message: `Unknown mode: ${this.mode}` } };
      }
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }

  private async executeSelect(): Promise<QueryResult> {
    const params: unknown[] = [];
    let paramIdx = 1;

    const selectCols = this.columns === '*' ? '*' : this.columns;

    const whereParts: string[] = [];
    for (const f of this.filters) {
      whereParts.push(`"${f.column}" ${f.op} $${paramIdx++}`);
      params.push(f.value);
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const orderParts = this.orders.map(
      (o) => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`,
    );
    const orderClause = orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : '';

    const limitClause = this.limitVal !== null ? `LIMIT ${this.limitVal}` : '';

    // Count query
    let count: number | null = null;
    if (this.countMode === 'exact') {
      const countSql = `SELECT COUNT(*) FROM "${this.table}" ${whereClause}`;
      const countResult = await pool.query(countSql, params);
      count = parseInt(countResult.rows[0].count, 10);
    }

    if (this.headMode) {
      return { data: null, error: null, count };
    }

    const sql = `SELECT ${selectCols} FROM "${this.table}" ${whereClause} ${orderClause} ${limitClause}`;
    const result = await pool.query(sql, params);

    if (this.isSingle && result.rows.length === 0) {
      return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count };
    }

    const data = this.isSingle ? result.rows[0] : result.rows;
    return { data, error: null, count };
  }

  private async executeInsert(): Promise<QueryResult> {
    if (this.rows.length === 0) return { data: null, error: null };

    const cols = Object.keys(this.rows[0]);
    const params: unknown[] = [];
    let paramIdx = 1;

    const valueSets = this.rows.map((row) => {
      const placeholders = cols.map((col) => {
        params.push(row[col]);
        return `$${paramIdx++}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    const sql = `INSERT INTO "${this.table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`;
    await pool.query(sql, params);
    return { data: null, error: null };
  }

  private async executeUpsert(): Promise<QueryResult> {
    if (this.rows.length === 0) return { data: null, error: null };

    const cols = Object.keys(this.rows[0]);
    const params: unknown[] = [];
    let paramIdx = 1;

    const valueSets = this.rows.map((row) => {
      const placeholders = cols.map((col) => {
        params.push(row[col]);
        return `$${paramIdx++}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    const conflictTarget = this.conflictCol ? `("${this.conflictCol}")` : `("${cols[0]}")`;
    const updateSet = cols
      .filter((c) => c !== this.conflictCol)
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    const sql = `INSERT INTO "${this.table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')} ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateSet}`;
    await pool.query(sql, params);
    return { data: null, error: null };
  }

  private async executeDelete(): Promise<QueryResult> {
    const params: unknown[] = [];
    let paramIdx = 1;

    const whereParts: string[] = [];
    for (const f of this.filters) {
      whereParts.push(`"${f.column}" ${f.op} $${paramIdx++}`);
      params.push(f.value);
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `DELETE FROM "${this.table}" ${whereClause}`;
    await pool.query(sql, params);
    return { data: null, error: null };
  }
}

// ─── Supabase-compatible client ────────────────────────────────────

const client = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};

export const supabase = client;
