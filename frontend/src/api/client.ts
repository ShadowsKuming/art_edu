const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8001'
const TOKEN_KEY = 'artbloom-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

/**
 * Optional per-request options.
 *
 * 2026-06-05 — `timeoutMs` was added after pilot teachers were
 * silently locked out of cross-device sync on classroom devices.
 *
 * Root cause: `fetch()` has no built-in deadline; on slow campus
 * networks the browser would happily hang the `/api/auth/login`
 * call for 30+ seconds, the SiteHeader catch-all would fire its
 * "fake login" fallback (now removed), and the teacher landed in a
 * tokenless dashboard that quietly returned an empty `/api/projects`
 * list. By giving `apiPost` an AbortController-backed timeout we
 * can (a) bound the wait, (b) surface a real `ApiError` to the UI
 * so the user sees what actually went wrong, and (c) let the
 * caller (`stores/user.ts → login`) retry once after a brief delay
 * — which usually succeeds because the first request warmed
 * Render's Free dyno from cold start.
 */
export interface RequestOptions {
  /** Abort the request after this many milliseconds. Default: unbounded (browser default). */
  timeoutMs?: number
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, `API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

/**
 * Build an AbortSignal that fires after `timeoutMs`. Returns
 * `undefined` when no timeout is requested so `fetch()` falls back
 * to the browser default.
 */
function timeoutSignal(timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs || timeoutMs <= 0) return undefined
  // `AbortSignal.timeout` is supported on every browser we target
  // (Safari ≥ 16, Chrome ≥ 103). The polyfill fallback below covers
  // older iPadOS classroom devices that still ship Safari 15.x.
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    return (AbortSignal as any).timeout(timeoutMs)
  }
  const ctl = new AbortController()
  setTimeout(() => ctl.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs)
  return ctl.signal
}

export function apiGet<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    signal: timeoutSignal(opts.timeoutMs),
  }).then(handleResponse<T>)
}

export function apiPost<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(opts.timeoutMs),
  }).then(handleResponse<T>)
}

export function apiPut<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(opts.timeoutMs),
  }).then(handleResponse<T>)
}

export function apiPatch<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutSignal(opts.timeoutMs),
  }).then(handleResponse<T>)
}

export function apiDelete(path: string, opts: RequestOptions = {}): Promise<void> {
  return fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
    signal: timeoutSignal(opts.timeoutMs),
  }).then(handleResponse<void>)
}
