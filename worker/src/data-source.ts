export interface EnvSource {
  SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}

export type Row = Record<string, unknown>;

let cachedToken: { token: string; expiresAt: number } | null = null;

function rows(values: unknown[][]): Row[] {
  const header = (values[0] || []).map(String);
  return values
    .slice(1)
    .filter((r) => r.some((v) => v !== '' && v != null))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
}

function base64Url(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').trim();
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(env: EnvSource): Promise<string> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    let detail = '';
    try {
      const body = (await tokenResponse.json()) as {
        error?: string;
        error_description?: string;
      };
      detail = body.error_description || body.error || '';
    } catch {}
    throw new Error(
      `Google OAuth ${tokenResponse.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  const tokenBody = (await tokenResponse.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = {
    token: tokenBody.access_token,
    expiresAt: now + (tokenBody.expires_in || 3600),
  };
  return tokenBody.access_token;
}

export async function readSheet(
  env: EnvSource,
  sheet: string,
  range: string,
): Promise<Row[]> {
  if (!env.SHEET_ID) throw new Error('SHEET_ID is not configured');

  const accessToken = await getAccessToken(env);
  const a1 = encodeURIComponent(`${sheet}!${range}`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SHEET_ID)}/values/${a1}` +
    '?valueRenderOption=UNFORMATTED_VALUE';

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ? `: ${body.error.message}` : '';
    } catch {}
    throw new Error(`Google Sheets ${response.status}${detail}`);
  }

  const body = (await response.json()) as { values?: unknown[][] };
  return rows(body.values || []);
}
