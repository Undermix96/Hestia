/** Paths of the clima screens. */
export const CLIMA_STANZA_PATH = '/clima/stanza';
export const CLIMA_TUTTE_PATH = '/clima/tutte';

/** Path of the Stanza screen of `roomId` (or the Stanza index without one). */
export function stanzaPath(roomId?: string | null): string {
  return roomId ? `${CLIMA_STANZA_PATH}/${encodeURIComponent(roomId)}` : CLIMA_STANZA_PATH;
}
