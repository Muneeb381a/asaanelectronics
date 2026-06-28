import { env } from '../../config/env.js';

export interface NadraResult {
  status:   'OK' | 'UNAVAILABLE' | 'NOT_FOUND' | 'INVALID' | 'ERROR';
  cnic?:    string;
  name?:    string;
  alive?:   boolean;
  message?: string;
}

export function isNadraConfigured(): boolean {
  return !!(env.NADRA_API_URL && env.NADRA_API_KEY);
}

export async function verifyCnic(rawCnic: string): Promise<NadraResult> {
  const cnic = rawCnic.replace(/-/g, '');

  if (!/^\d{13}$/.test(cnic)) {
    return { status: 'INVALID', message: 'CNIC must be 13 digits' };
  }

  if (!isNadraConfigured()) {
    return {
      status: 'UNAVAILABLE',
      message: 'NADRA integration not configured — add NADRA_API_URL and NADRA_API_KEY to .env',
    };
  }

  try {
    const url = `${env.NADRA_API_URL}/verify?cnic=${cnic}&api_key=${env.NADRA_API_KEY}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) return { status: 'NOT_FOUND', message: 'CNIC not found in NADRA database' };
    if (res.status === 401 || res.status === 403) return { status: 'ERROR', message: 'NADRA API authentication failed — check NADRA_API_KEY' };
    if (!res.ok) return { status: 'ERROR', message: `NADRA API returned HTTP ${res.status}` };

    const data = await res.json() as {
      name?: string;
      full_name?: string;
      alive?: boolean;
      is_alive?: boolean;
      status?: string;
    };

    return {
      status: 'OK',
      cnic,
      name:  data.name ?? data.full_name,
      alive: data.alive ?? data.is_alive ?? true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { status: 'ERROR', message: 'NADRA API request timed out' };
    }
    return { status: 'UNAVAILABLE', message: 'NADRA API unreachable' };
  }
}
