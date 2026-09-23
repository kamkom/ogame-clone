// The typed fetch wrapper. Every call goes through `apiFetch`, which parses JSON, throws a
// typed `ApiError` on any non-2xx, and flags 401s so the app can fall back to the auth screen
// (spec story 15). `fetchImpl` is injectable so the wrapper is unit-testable without a browser.

import type {
  BuildSlotSnapshot,
  PlanetSnapshot,
  Player,
  ResearchEntrySnapshot,
  ShipyardOrderSnapshot,
} from '#shared/snapshot.ts';

// The wire types live in shared, so the server and the screens agree on them.
export type { PlanetSnapshot, Player };
export type BuildSlotView = BuildSlotSnapshot;
export type ResearchEntryView = ResearchEntrySnapshot;
export type ShipyardOrderView = ShipyardOrderSnapshot;

/** The signed-in Player, from login and /api/auth/me. */
export interface Session {
  player: Player;
}

/** Register also returns the new Planet, so the game renders without a second request. */
export interface Registration {
  player: Player;
  snapshot: PlanetSnapshot;
}

export type FieldErrors = { username?: string; password?: string };

export interface ApiErrorBody {
  error: string;
  fields?: FieldErrors;
  /** A single validation code, e.g. from a failed Planet rename ('length' | 'chars' | 'spaces'). */
  code?: string;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get unauthorized(): boolean {
    return this.status === 401;
  }
}

type FetchImpl = typeof fetch;

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const res = await fetchImpl(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) throw new ApiError(res.status, body);
  // A 204 (logout) has no body; callers typed `void` ignore the null.
  return body as T;
}

function post<T>(path: string, payload: unknown, fetchImpl?: FetchImpl): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(payload) }, fetchImpl);
}

export interface Health {
  status: string;
  serverNow: number;
  universeSpeed: number;
}

export const api = {
  health: (fetchImpl?: FetchImpl) => apiFetch<Health>('/api/health', {}, fetchImpl),
  me: (fetchImpl?: FetchImpl) => apiFetch<Session>('/api/auth/me', {}, fetchImpl),
  planet: (fetchImpl?: FetchImpl) => apiFetch<PlanetSnapshot>('/api/planet', {}, fetchImpl),
  register: (username: string, password: string, fetchImpl?: FetchImpl) =>
    post<Registration>('/api/auth/register', { username, password }, fetchImpl),
  login: (username: string, password: string, fetchImpl?: FetchImpl) =>
    post<Session>('/api/auth/login', { username, password }, fetchImpl),
  logout: (fetchImpl?: FetchImpl) => post<void>('/api/auth/logout', {}, fetchImpl),
  renamePlanet: (name: string, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>('/api/planet/rename', { name }, fetchImpl),
  upgradeStructure: (key: string, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>(`/api/structures/${key}/upgrade`, {}, fetchImpl),
  cancelBuildSlot: (slot: number, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>(`/api/build-slots/${slot}/cancel`, {}, fetchImpl),
  enqueueResearch: (technology: string, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>('/api/research', { technology }, fetchImpl),
  placeShipyardOrder: (ship: string, quantity: number, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>('/api/shipyard/orders', { ship, quantity }, fetchImpl),
  cancelResearch: (entryId: number, fetchImpl?: FetchImpl) =>
    post<PlanetSnapshot>(`/api/research/${entryId}/cancel`, {}, fetchImpl),
};
