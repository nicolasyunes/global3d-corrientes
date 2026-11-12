// Local calendar date as 'YYYY-MM-DD' (the format of <input type="date"> and
// of orders.due_date), without the UTC shift toISOString() would add.
export function toISODate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
