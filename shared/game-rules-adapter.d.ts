export interface ItemRecord { container: 'pack' | 'bank' | 'equip'; slot: string | null; position: number; item_def: string; qty: number; props: Record<string, unknown> }
export interface BuiltCharacter {
  name: string; nameKey: string; body: 'male' | 'female'; appearance: Record<string, string>;
  str: number; dex: number; int: number; statLocks: Record<string, string>; skills: Record<string, { v: number; lock: string }>;
  template: string; startingTown: string; boundShrine: string; hp: number; stam: number; mana: number;
  position: Record<string, unknown>; hotbar: unknown[]; spells: string[]; kitNotes: string[]; kit: { ok: boolean; weight: number; cap: number; stage: number };
  rulesVersion: Record<string, number>; items: ItemRecord[];
}
export interface CreationResult { ok: boolean; errors: string[]; field: Record<string, string[]>; value: any }
export interface RulesApi {
  SF: any; RULES_VERSION: Record<string, number>;
  nameKey(name: string): string;
  validateCreation(payload: unknown): CreationResult;
  buildCharacter(value: any): BuiltCharacter;
  checkStoredItem(row: { item_def: string; qty: number; container: string; slot: string | null }): string | null;
  creationOptions(): Record<string, unknown>;
  characterFromRows(row: any, items: any[]): any;
  itemName(id: string): string; townName(id: string): string; title(ch: any): string;
}
export declare function load(srcDir?: string): RulesApi;
export interface SimClock { hourAt(t: number): number; dayAt(t: number): number; periodAt(t: number): string; secondsPerHour(): number; readonly dayMinutes: number }
export interface SimFactions { hostile(a: string, b: string): boolean; friendly(a: string, b: string): boolean }
export interface SimApi {
  CLOCK: { dayMinutes: number; startHour: number };
  newClock(saved?: { dayMinutes?: number; offset?: number }, cfg?: { dayMinutes?: number; startHour?: number }): SimClock;
  lightAt(hour: number): { dark: number; period: string };
  activityOf(hours: string, period: string): 'active' | 'rest' | 'sleep';
  senseRange(p: { sight: number; hear: number; nightVision: number }, c: { dark: number; activity: string; alert: boolean }): { sight: number; hear: number };
  detect(p: { sight: number; hear: number; nightVision: number }, c: { dark: number; activity: string; alert: boolean }, d: number, o: { los: boolean; moving: boolean; noisy: boolean; hidden: boolean }): 'seen' | 'heard' | null;
  newFactions(rules: unknown, opt?: unknown): SimFactions; FACTION_RULES: unknown;
  stream(seed: number, name: string): () => number;
}
export declare function loadSim(srcDir?: string): SimApi;
