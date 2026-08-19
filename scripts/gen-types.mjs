// Generates `src/lib/database.types.ts` from the live Supabase schema.
//
// This is the local replacement for `supabase gen types --local`, which needs a
// Docker daemon, and for `--linked` / `--project-id`, which need a Supabase
// access token. It connects directly to Postgres over the session pooler and
// introspects `pg_catalog` to emit the same `Database` shape (Tables / Views /
// Functions / Enums / CompositeTypes).
//
// Usage:
//   node scripts/gen-types.mjs --db-url "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
//
// The connection string is read from --db-url, then $DATABASE_URL, then
// $SUPABASE_DB_URL. The database password is a secret: never commit it.
//
// Regenerating against the live schema is deterministic, so the drift gate
// (`gen:types` then `git diff --exit-code -- src/lib/database.types.ts`) stays
// meaningful.

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../src/lib/database.types.ts')

function resolveDbUrl() {
  const flag = process.argv.indexOf('--db-url')
  if (flag !== -1) return process.argv[flag + 1]
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null
}

const dbUrl = resolveDbUrl()
if (!dbUrl) {
  console.error(
    'Missing connection string: pass --db-url or set DATABASE_URL / SUPABASE_DB_URL.',
  )
  process.exit(1)
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

// ---------------------------------------------------------------------------
// Introspection queries
// ---------------------------------------------------------------------------
const ENUMS_SQL = `
  select t.typname as name, e.enumlabel as value
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder`

const TABLES_SQL = `
  select c.relname as name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`

const COLUMNS_SQL = `
  select
    a.attnum as attnum,
    a.attname as name,
    a.attnotnull as not_null,
    t.typname as type_name,
    t.typtype as type_category,
    t.typelem as type_elem,
    pg_get_expr(ad.adbin, ad.adrelid) as default_expr
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where n.nspname = 'public' and c.relname = $1
    and a.attnum > 0 and not a.attisdropped
  order by a.attnum`

// Base FK graph (source/target column numbers as int2[] arrays).
const FOREIGN_KEYS_SQL = `
  select
    src.relname as table_name,
    con.conname as constraint_name,
    con.conkey as conkey,
    dst.relname as referenced_table,
    con.confkey as confkey
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class dst on dst.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  where con.contype = 'f' and n.nspname = 'public'
  order by src.relname, con.conname`

// Unique index column sets (for the isOneToOne flag). One-to-one = the FK
// columns exactly match a unique/PK index on the source table.
const UNIQUE_INDEXES_SQL = `
  select
    c.relname as table_name,
    i.indkey::int2[] as attnums
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where i.indisunique and n.nspname = 'public'`

// Column names of every FK target (public and auth schemas), so referenced
// columns resolve even when the target table is outside the public schema.
const REFERENCED_COLUMNS_SQL = `
  select distinct
    dst.relname as table_name,
    a.attnum as attnum,
    a.attname as name
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class dst on dst.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  join pg_attribute a on a.attrelid = dst.oid and a.attnum = any (con.confkey)
  where con.contype = 'f' and n.nspname = 'public' and not a.attisdropped
  order by dst.relname, a.attnum`

const FUNCTIONS_SQL = `
  select
    p.proname as name,
    pg_get_function_result(p.oid) as result_type,
    pg_get_function_identity_arguments(p.oid) as identity_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
  order by p.proname`

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------
function tsScalar(typeName) {
  switch (typeName) {
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
    case 'money':
      return 'number'
    case 'bool':
      return 'boolean'
    case 'json':
    case 'jsonb':
      return 'Json'
    case 'date':
    case 'timestamp':
    case 'timestamptz':
    case 'time':
    case 'timetz':
    case 'uuid':
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'name':
    case 'citext':
    default:
      return 'string'
  }
}

function tsType(col) {
  let name = col.type_name
  let isArray = false
  if (col.type_category === 'b' && col.type_elem !== 0) {
    isArray = true
    name = name.replace(/^_/, '')
  }
  let base
  if (col.type_category === 'e') {
    base = `Database["public"]["Enums"]["${name}"]`
  } else {
    base = tsScalar(name)
  }
  return isArray ? `${base}[]` : base
}

function quote(value) {
  return JSON.stringify(value)
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
async function main() {
  await client.connect()
  try {
    const enumsRes = await client.query(ENUMS_SQL)
    const tablesRes = await client.query(TABLES_SQL)
    const fksRes = await client.query(FOREIGN_KEYS_SQL)
    const uniqRes = await client.query(UNIQUE_INDEXES_SQL)
    const refColsRes = await client.query(REFERENCED_COLUMNS_SQL)
    const fnsRes = await client.query(FUNCTIONS_SQL)

    // Enums: name -> ordered list of values
    const enums = new Map()
    for (const row of enumsRes.rows) {
      if (!enums.has(row.name)) enums.set(row.name, [])
      enums.get(row.name).push(row.value)
    }

    // Referenced column names: table_name -> Map(attnum -> name)
    const refCols = new Map()
    for (const row of refColsRes.rows) {
      if (!refCols.has(row.table_name)) refCols.set(row.table_name, new Map())
      refCols.get(row.table_name).set(row.attnum, row.name)
    }

    // Unique index column sets: table_name -> list of sorted attnum arrays
    const uniqueSets = new Map()
    for (const row of uniqRes.rows) {
      if (!uniqueSets.has(row.table_name)) uniqueSets.set(row.table_name, [])
      uniqueSets
        .get(row.table_name)
        .push([...row.attnums].sort((a, b) => a - b))
    }

    // Relationships: table_name -> list of relationship objects
    const relationships = new Map()
    for (const row of fksRes.rows) {
      if (!relationships.has(row.table_name))
        relationships.set(row.table_name, [])
      const sourceCols = [...row.conkey]
      const sourceNames = sourceCols.map((attnum) => attnum)
      const refNames = [...row.confkey].map(
        (attnum) =>
          refCols.get(row.referenced_table)?.get(attnum) ?? String(attnum),
      )
      const sorted = [...row.conkey].sort((a, b) => a - b)
      const isOneToOne = (uniqueSets.get(row.table_name) ?? []).some(
        (set) =>
          set.length === sorted.length && set.every((v, i) => v === sorted[i]),
      )
      relationships.get(row.table_name).push({
        constraint_name: row.constraint_name,
        columns: sourceNames,
        referenced_table: row.referenced_table,
        referenced_columns: refNames,
        is_one_to_one: isOneToOne,
      })
    }

    const tableSections = []
    const columnNames = new Map() // table_name -> Map(attnum -> name)
    for (const table of tablesRes.rows) {
      const colsRes = await client.query(COLUMNS_SQL, [table.name])
      const attnumToName = new Map()
      const rowFields = []
      const insertFields = []
      const updateFields = []
      for (const col of colsRes.rows) {
        attnumToName.set(col.attnum, col.name)
        const nullable = !col.not_null
        const hasDefault = col.default_expr !== null
        const type = tsType(col)
        const nullSuffix = nullable ? ' | null' : ''

        rowFields.push(`      ${col.name}: ${type}${nullSuffix}`)
        insertFields.push(
          `      ${col.name}${hasDefault || nullable ? '?' : ''}: ${type}${nullSuffix}`,
        )
        updateFields.push(`      ${col.name}?: ${type}${nullSuffix}`)
      }
      columnNames.set(table.name, attnumToName)

      // Resolve source FK column names now that attnum -> name is known.
      const rels = (relationships.get(table.name) ?? []).map((rel) => {
        const cols = rel.columns
          .map(
            (attnum) =>
              columnNames.get(table.name)?.get(attnum) ?? String(attnum),
          )
          .map(quote)
          .join(', ')
        const refColsStr = rel.referenced_columns.map(quote).join(', ')
        return `        {
          foreignKeyName: ${quote(rel.constraint_name)}
          columns: [${cols}]
          isOneToOne: ${rel.is_one_to_one}
          referencedRelation: ${quote(rel.referenced_table)}
          referencedColumns: [${refColsStr}]
        }`
      })
      const relSection = rels.length
        ? `        Relationships: [\n${rels.join('\n')}\n        ]`
        : '        Relationships: []'

      tableSections.push(`      ${table.name}: {
        Row: {
${rowFields.join('\n')}
        }
        Insert: {
${insertFields.join('\n')}
        }
        Update: {
${updateFields.join('\n')}
        }
${relSection}
      }`)
    }

    const enumEntries = [...enums.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, values]) =>
          `      ${name}: ${values.map((v) => quote(v)).join(' | ')}`,
      )

    const fnEntries = fnsRes.rows.map((fn) => {
      const args =
        fn.identity_args === ''
          ? 'Record<PropertyKey, never>'
          : `{ ${fn.identity_args} }`
      return `      ${fn.name}: {
        Args: ${args}
        Returns: ${fn.result_type === 'boolean' ? 'boolean' : 'unknown'}
      }`
    })

    const output = `${HEADER}

export type Database = {
  public: {
    Tables: {
${tableSections.join('\n')}
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
${fnEntries.length ? fnEntries.join('\n') : '      [_ in never]: never'}
    }
    Enums: {
${enumEntries.join('\n')}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
${HELPERS}`

    writeFileSync(OUT, output)
    console.log(`Generated ${OUT}`)
  } finally {
    await client.end()
  }
}

const HEADER = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
`

const HELPERS = `
type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
`

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
