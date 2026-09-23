import { ApiError } from './api.ts';

// How the client reacts to failed requests. A 401 means the session is gone (back to the login
// screen); 4xx answers are final, so they aren't retried and aren't "can't reach the server";
// network failures and 5xx are retried with the red banner showing meanwhile.

/** A 401: the session is missing or expired. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Whether a failure means the server couldn't be reached (network failure or 5xx). */
export function showsServerBanner(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  return !(error instanceof ApiError && error.status < 500);
}

/** A TanStack `retry` function: retry up to `maxRetries` times, never for a client error. */
export function retryPolicy(maxRetries: number) {
  return (failureCount: number, error: unknown): boolean =>
    showsServerBanner(error) && failureCount < maxRetries;
}
