export interface World { W: number; H: number; tiles: Uint8Array; blk: Uint8Array; soft: Float32Array; rects: number[][]; ecol: Map<number, number[][]>; meta: Record<string, unknown> }
export declare const FORMAT: number;
export declare const BODY: number;
export declare function makeWorld(o: { W: number; H: number; tiles: Uint8Array; blk: ArrayLike<number>; soft: ArrayLike<number>; rects: number[][]; meta?: Record<string, unknown> }): World;
export declare function tileAt(w: World, x: number, y: number): number;
export declare function canStand(w: World, x: number, y: number): boolean;
export declare function moveBy(w: World, pos: { x: number; y: number }, dx: number, dy: number): number;
export declare function nearestStand(w: World, x: number, y: number, maxR?: number): { x: number; y: number } | null;
export declare function hash(w: World): string;
export declare function encode(w: World): Uint8Array;
export declare function decode(buf: Uint8Array | ArrayBuffer): World;
