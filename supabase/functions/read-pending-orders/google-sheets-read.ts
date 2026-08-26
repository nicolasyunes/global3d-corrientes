// Minimal Google Sheets v4 read client: service-account JWT bearer auth (same
// approach as sync-order-to-sheet/google-sheets.ts, kept separate so this
// read-only function has no dependency on the write-path function).

import { SignJWT, importPKCS8 } from 'npm:jose@5'

const SHEETS_SCOPE_READONLY =
  'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function getAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'RS256')
  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({ scope: SHEETS_SCOPE_READONLY })
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
    throw new Error(
      `Google token exchange failed: ${res.status} ${await res.text()}`,
    )
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

// Reads A2:K of the given tab, formatted the way the sheet displays it (so
// dates/currency read exactly as an operator sees them in Sheets), skipping
// the header row.
export async function readSheetRows(
  accessToken: string,
  sheetId: string,
  sheetTabName: string,
): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetTabName}!A2:K1000`)
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}` +
    `?valueRenderOption=FORMATTED_VALUE`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { values?: string[][] }
  return data.values ?? []
}
