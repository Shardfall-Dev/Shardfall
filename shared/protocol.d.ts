export declare const PROTOCOL_VERSION: number;
export declare const MAX_MESSAGE_BYTES: number;
export declare const TICK_MS: number;
export declare const HEARTBEAT_MS: number;
export declare const RECONNECT_GRACE_MS: number;
export declare const CLOSE: { NORMAL: number; GOING_AWAY: number; POLICY: number; TOO_BIG: number; TRY_LATER: number; UNAUTHORIZED: number; FORBIDDEN: number; TAKEN_OVER: number; PROTOCOL: number; RATE_LIMIT: number; SESSION_ENDED: number };
export declare const CLIENT: string[];
export declare const SERVER: string[];
export declare const RESERVED: string[];
export interface ClientMessage { type: 'hello' | 'ping' | 'resync'; id?: string; p: Record<string, any> }
export declare function isUuid(s: unknown): s is string;
export declare function parseClient(text: unknown): { ok: true; msg: ClientMessage } | { ok: false; code: string; message: string; id?: string };
export declare function parseServer(text: string): { ok: true; msg: any } | { ok: false; code: string };
export declare function encode(type: string, payload?: object, opts?: { id?: string; seq?: number }): string;
export declare function presenceOf(c: any): { characterId: string; name: string; body: string; appearance: any; town: string; title: string | null };
