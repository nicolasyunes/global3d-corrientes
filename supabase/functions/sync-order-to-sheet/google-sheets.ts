// Minimal Google Sheets v4 client: service-account JWT bearer auth (no
// external Google SDK — `npm:jose` handles RS256 signing) + upsert-by-column-K.

import { SignJWT, importPKCS8 } from 'npm:jose@5'

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

// Finds the row whose column K equals `orderId` and updates it in place;
// appends a new row otherwise. Never matches by name/position — the exact
// failure mode ("Marce Paso" logged 4 different ways) this sync exists to avoid.
export async function upsertOrderRow(
  accessToken: string,
  sheetId: string,
  sheetTabName: string,
  orderId: string,
  rowValues: string[],
): Promise<'updated' | 'appended'> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`
  const authHeader = { Authorization: `Bearer ${accessToken}` }

  const colRange = encodeURIComponent(`${sheetTabName}!K:K`)
  const getRes = await fetch(`${base}/values/${colRange}`, { headers: authHeader })
  if (!getRes.ok) {
    throw new Error(`Sheets read failed: ${getRes.status} ${await getRes.text()}`)
  }
  const getData = (await getRes.json()) as { values?: string[][] }
  const column = getData.values ?? []
  const matchIndex = column.findIndex((row) => row[0] === orderId)

  if (matchIndex >= 0) {
    const sheetRow = matchIndex + 1 // K:K values are 1-indexed from row 1
    const range = encodeURIComponent(`${sheetTabName}!A${sheetRow}:K${sheetRow}`)
    const updateRes = await fetch(`${base}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowValues] }),
    })
    if (!updateRes.ok) {
      throw new Error(`Sheets update failed: ${updateRes.status} ${await updateRes.text()}`)
    }
    return 'updated'
  }

  const appendRange = encodeURIComponent(`${sheetTabName}!A:K`)
  const appendRes = await fetch(
    `${base}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowValues] }),
    },
  )
  if (!appendRes.ok) {
    throw new Error(`Sheets append failed: ${appendRes.status} ${await appendRes.text()}`)
  }
  return 'appended'
}
