/**
 * Which chat the coach screen is showing, as a React key.
 *
 * A new chat starts at /coach and moves to /coach?c=<id> after the coach's first reply. That is still the same chat:
 * remounting it then would drop whatever happened in between (the result of a confirmed change, a half-typed
 * message). Picking another chat, or starting a new one, does start fresh.
 */
export interface ChatKeyState {
  /** The conversation the page last asked for (null = a new chat). */
  id: string | null;
  key: string;
  /** The id the on-screen new chat was given by the server, until the page catches up with it. */
  created: string | null;
  n: number;
}

export function initialChatKey(id: string | null): ChatKeyState {
  return { id, key: id ?? "new-0", created: null, n: 0 };
}

/** The on-screen new chat was saved and given this id. */
export function chatCreated(s: ChatKeyState, id: string): ChatKeyState {
  return { ...s, created: id };
}

/** The page now asks for conversation `id`. */
export function nextChatKey(s: ChatKeyState, id: string | null): ChatKeyState {
  if (id === s.id) return s;
  const n = s.n + 1;
  const sameChat = id != null && id === s.created;
  return { id, key: sameChat ? s.key : (id ?? `new-${n}`), created: null, n };
}
