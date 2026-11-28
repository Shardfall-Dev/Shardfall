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
  itemName(id: string): string; townName(id: string): string; title(ch: any): string;
}
export declare function load(srcDir?: string): RulesApi;
