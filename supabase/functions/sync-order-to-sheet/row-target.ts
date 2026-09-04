// Pure decision of which sheet row the order sync should write to. No network —
// deterministic and unit-testable, same philosophy as mapping.ts.
//
// Input is the current values of the "Pedidos" tab's B:K range (CLIENTE
// through the hidden id column), one array per row, header row included. The
// app order id lives in column K, which is index 9 within B:K.
//
// This exists to replace Sheets' `values.append`: append detects a "table"
// inside the range and starts writing at its first column, which mis-aligns
// every field when the leading "Columna 1" (A) is empty — the exact bug where
// a new quick order's customer name landed in the ESTADO column.

export interface RowTarget {
  row: number // 1-indexed sheet row
  mode: 'updated' | 'appended'
}

export function resolveTargetRow(
  bkRows: readonly string[][],
  orderId: string,
): RowTarget {
  const matchIndex = bkRows.findIndex((row) => row[9] === orderId)
  if (matchIndex >= 0) {
    return { row: matchIndex + 1, mode: 'updated' }
  }
  // CLIENTE (index 0) is filled on every real row, so bkRows.length is the
  // true last data row — unlike a K:K read, which stops at the last row that
  // carries an id (hand-typed rows have an empty K).
  return { row: bkRows.length + 1, mode: 'appended' }
}
