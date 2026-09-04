// Minimal Google Sheets v4 read client: service-account JWT bearer auth (same
// approach as read-pending-orders/google-sheets-read.ts, kept separate so each
// function is self-contained).

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

// Reads A2:E of the "Stock Sync" tab as the operator sees it (FORMATTED_VALUE so
// a price typed "$ 1.500" or a roll count "3" come back verbatim), skipping the
// header row. Column order: A PRODUCTO | B COLOR | C ROLLOS | D PRECIO | E SKU.
export async function readSheetRows(
  accessToken: string,
  sheetId: string,
  sheetTabName: string,
): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetTabName}!A2:E1000`)
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
