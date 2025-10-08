
export async function run(db: D1Database, sql: string, bindings: any[] = []) {
  return db.prepare(sql).bind(...bindings).run()
}
export async function one<T = any>(db: D1Database, sql: string, bindings: any[] = []) {
  const r = await db.prepare(sql).bind(...bindings).first<T>()
  return r as T | null
}
export async function all<T = any>(db: D1Database, sql: string, bindings: any[] = []) {
  const r = await db.prepare(sql).bind(...bindings).all<T>()
  return r.results as unknown as T[]
}
