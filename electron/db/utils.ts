import { eq, isNull, sql, type SQLWrapper } from 'drizzle-orm'
import { integer, uuid, varchar, text as pgText, timestamp, boolean, date as pgDate, bigint } from 'drizzle-orm/pg-core'

type ReorderItemPayload = {
  id: string
  idx: number
}[]

type IdOptions = {
  name?: string
  req?: boolean
  defaultRandom?: boolean
}

type ColumnOptions = {
  name: string
  req?: boolean
  val?: any
}

type TextColumnOptions = ColumnOptions & {
  length?: number
}

type TimestampOptions = {
  name: string
  defaultNow?: boolean
  req?: boolean
}

type ForeignKeyOptions = {
  name: string
  refs: any
  req?: boolean
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action'
}

/**
 * Creates a UUID column, typically used for primary keys
 * @returns UUID column definition
 */
function id({ 
    name = 'id', 
    req = true,
    defaultRandom = true 
  }: IdOptions = {}) {

    const column = uuid(name)
    column.primaryKey()
    if (defaultRandom) column.defaultRandom()
    if (req) column.notNull()

    return column
}

/**
 * Creates a foreign key column
 * @returns Foreign key column definition
 */
function fk({ 
    name, 
    refs, 
    req = true,
    onDelete = 'cascade' 
  }: ForeignKeyOptions) {
    const referenceFn = typeof refs === 'function' ? refs : () => refs
    const column = uuid(name).references(referenceFn, { onDelete })

    if (req) column.notNull()

    return column
}

/**
 * Creates an integer column
 * @param options Configuration options
 * @returns Integer column definition
 */
function int({ 
  name, 
  req = true, 
  val = undefined 
}: ColumnOptions) {
  const column = integer(name)
  if (req) column.notNull()
  if (val !== undefined) column.default(val)
  return column
}

/**
 * Creates a bigint column for large integer values
 * @param options Configuration options
 * @returns Bigint column definition
 */
function bigInt({ 
  name, 
  req = true, 
  val = undefined 
}: ColumnOptions) {
  const column = bigint(name, { mode: 'number' })
  if (req) column.notNull()
  if (val !== undefined) column.default(val)
  return column
}

/**
 * Creates a varchar column with configurable length
 * @param options Configuration options
 * @returns Varchar column definition
 */
function str({ 
  name, 
  length = 100, 
  req = true, 
  val = undefined 
}: TextColumnOptions) {
  const col = varchar(name, { length })
  if (req) col.notNull()
  if (val !== undefined) col.default(val)

  return col
}

/**
 * Creates a text column for longer string content
 * @param options Configuration options
 * @returns Text column definition
 */
function text({ 
  name, 
  req = true,  
  val = undefined 
}: ColumnOptions) {
  const col = pgText(name)
  if (req) col.notNull()
  if (val !== undefined) col.default(val)

  return col
}

function timeStamp({ 
  name, 
  defaultNow = false, 
  req = true 
}: TimestampOptions) {
  const column = timestamp(name)

  if (defaultNow) column.defaultNow()
  if (req) column.notNull()

  return column
}

function date({ 
  name, 
  defaultNow = false, 
  req = true 
}: TimestampOptions) {
  const column = pgDate(name)

  if (defaultNow) column.defaultNow()
  if (req) column.notNull()

  return column
}

/**
 * Creates a boolean column
 * @param options Configuration options
 * @returns Boolean column definition
 */
function bool({ 
  name, 
  val = undefined 
}: ColumnOptions) {
  const column = boolean(name)
  if (val !== undefined) column.default(val)
  return column
}


/**
 * Checks to see if both are equal where both values can be null.
 * @param left   Nullable right
 * @param right  Nullable left
 * @returns 
 */
function nullEq(left: any, right: string | null | SQLWrapper) {
  return right === null ? isNull(left) : eq(left, right)
}

/**
 * Creates a SQL COALESCE expression to handle null values
 * @param column The column to check for null
 * @param val Value to use if column is null
 * @returns SQL COALESCE expression
 */
function coalesce(column: any, val = 0) {
  return sql`COALESCE(${column}, ${val})`
}

/**
 * Creates a set of ordering columns for different view types
 * @param prefix Prefix for the column names
 * @returns Object containing three ordering columns
 */
function orderColumns(prefix: string) {
  return {
    [`${prefix}_order_default`]: integer(`${prefix}_order_default`).default(0),
    [`${prefix}_order_status`]: integer(`${prefix}_order_status`).default(0),
    [`${prefix}_order_tag`]: integer(`${prefix}_order_tag`).default(0),
  }
}

export {
  id,
  fk,
  int,
  bigInt,
  str,
  text,
  timeStamp,
  date,
  bool,
  coalesce,
  orderColumns,
  nullEq,
  ReorderItemPayload
}
