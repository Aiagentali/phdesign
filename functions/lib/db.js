// Portable DB abstraction - D1 today, MySQL tomorrow
// All queries go through this layer. To port to MySQL, replace only this file.

export async function q(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.all();
}
export async function q1(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.first();
}
export async function exec(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.run();
}
export function nowSec() { return Math.floor(Date.now() / 1000); }
export function uuid() { return crypto.randomUUID(); }

// For MySQL port: replace q/q1/exec with mysql2/promise equivalents
// Example MySQL:
// export async function q(pool, sql, params){ const [rows]=await pool.execute(sql.replace(/\?/g,'?'), params); return {results:rows} }
