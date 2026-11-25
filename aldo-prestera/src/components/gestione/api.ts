// Chiamate del pannello a /api/gestione/*: il browser parla solo col sito, mai con ordini-api.
export async function api(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) location.assign('/gestione/login'); // sessione scaduta
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
