import type { World } from './collision';
export interface MoveInput { x: number; y: number; want: number; sprint?: boolean }
export interface MoveState { x: number; y: number; stam: number; lastDrain?: number; sect?: number; t?: number }
export interface MoveCtx { walk: number; sprint: number; drain: number; regen: number; delay: number; stamMax: number; armourSpd: number; enc: { speed: number; stam: number; run: boolean }; ghost: boolean }
export declare const STEP: number;
export declare const MOVE_SCALE: number;
export declare const SHALLOWS: number;
export declare function cleanInput(i: unknown): { x: number; y: number; want: number; sprint: boolean };
export declare function facing(sect: number | undefined, vx: number, vy: number): number | undefined;
export declare function step(world: World, s: MoveState, input: MoveInput, ctx: MoveCtx, COL: any): { moved: number; speed: number; sprinting: boolean };
export declare function ctxFor(SF: any, ch: any): MoveCtx;
