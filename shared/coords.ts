// A Planet's address: `[galaxy:system:position]`. Shared so the server and the web client
// format Coordinates identically.

export interface Coordinates {
  galaxy: number;
  system: number;
  position: number;
}

/** `{ galaxy: 4, system: 212, position: 8 }` → `"[4:212:8]"`. */
export function formatCoordinates({ galaxy, system, position }: Coordinates): string {
  return `[${galaxy}:${system}:${position}]`;
}
