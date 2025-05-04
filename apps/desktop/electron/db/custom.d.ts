declare module "drizzle-orm" {
  export const eq: any;
  export const desc: any;
  export const sql: any;
}

declare module "drizzle-orm/better-sqlite3" {
  export function drizzle(db: any, options?: any): any;
}

declare module "drizzle-orm/better-sqlite3/migrator" {
  export function migrate(db: any, options: { migrationsFolder: string }): Promise<void>;
}

declare module "drizzle-orm/sqlite-core" {
  export function integer(name: string): any;
  export function text(name: string): any;
  export function sqliteTable(name: string, columns: Record<string, any>): any;
}
