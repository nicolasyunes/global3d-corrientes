// Minimal Google Sheets v4 client: service-account JWT bearer auth (no
// external Google SDK — `npm:jose` handles RS256 signing) + upsert-by-column-K.

import { SignJWT, importPKCS8 } from 'npm:jose@5'
import { resolveTargetRow } from './row-target.ts'

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function getAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'RS256')
  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({ scope: SHEETS_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccountEmail)
    .setSubject(serviceAccountEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

// Finds the row whose column K equals `orderId` and rewrites it in place; when
// there's no match, writes to the first row after the last existing one. Both
// paths are an explicit `values.update` over `A:K` — never `values.append`,
// whose table detection starts writing at the first non-empty column and so
// shifts every field left when the leading "Columna 1" (A) is blank. Never
// matches by name/position — the exact failure mode ("Marce Paso" logged 4
// different ways) this sync exists to avoid.
export async function upsertOrderRow(
  accessToken: string,
  sheetId: string,
  sheetTabName: string,
  orderId: string,
  rowValues: string[],
): Promise<'updated' | 'appended'> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  // Read CLIENTE..id (B:K) rather than K:K: CLIENTE is filled on every real
  // row, so the row count is exact even though old hand-typed rows have an
  // empty id in K. The order id is index 9 within B:K.
  const scanRange = encodeURIComponent(`${sheetTabName}!B:K`)
  const getRes = await fetch(`${base}/values/${scanRange}`, { headers: authHeader })
  if (!getRes.ok) {
    throw new Error(`Sheets read failed: ${getRes.status} ${await getRes.text()}`)
  }
  const getData = (await getRes.json()) as { values?: string[][] }
  const { row, mode } = resolveTargetRow(getData.values ?? [], orderId)

  const range = encodeURIComponent(`${sheetTabName}!A${row}:K${row}`)
  const writeRes = await fetch(
    `${base}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowValues] }),
    },
  )
  if (!writeRes.ok) {
    throw new Error(`Sheets write failed: ${writeRes.status} ${await writeRes.text()}`)
  }
  return mode
}
