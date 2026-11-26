// Damage preview for the Shardfall ruleset. Distributions are conditional on a
// successful cast, before an encounter cap, missing health or an outside buff.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function resistChance(circle, magery, resistance) {
  return clamp(Math.max(resistance / 5, resistance - ((magery - 20) / 5 + circle * 5)) / 100, 0, 1);
}

export function focusScale(focus, resistance) {
  const difference = focus - resistance;
  return 1 + difference / (difference < 0 ? 200 : 500);
}

// Distribution indexed by integer outcome. Accumulating independent dice makes
// common hits more probable than the theoretical envelope's extreme values.
function dice(sides, offset = 0) {
  let weights = new Map([[offset, 1]]);
  for (const faces of sides) {
    const next = new Map();
    for (const [total, count] of weights) {
      for (let face = 1; face <= faces; face++) {
        const sum = total + face;
        next.set(sum, (next.get(sum) ?? 0) + count);
      }
    }
    weights = next;
  }
  return weights;
}

function one(value) { return new Map([[value, 1]]); }

const models = {
  'magery.04': s => dice([6], Math.floor(s.magery / 10)),
  'magery.05': () => dice([4]),
  'magery.12': () => dice([4, 4]),
  'magery.13': () => dice([4, 4]),
  'magery.18': s => dice([6], Math.floor(s.magery / 8)),
  'magery.28': () => one(2),
  'magery.29': s => dice([10], Math.floor(s.magery * 0.4)),
  'magery.30': () => dice([8, 8, 8]),
  'magery.37': s => one(Math.floor(Math.abs(s.casterInt - s.targetInt) / 4)),
  'magery.42': () => dice([8, 8, 8, 8, 8, 3], -1),
  'magery.43': () => dice([8, 8, 8, 8, 8, 3], -1),
  'magery.49': () => dice([8, 8, 8, 8, 8, 8]),
  'magery.51': () => dice([8, 8, 8, 8, 8, 8], 2),
  'magery.55': () => dice([8, 8, 8, 8, 8, 8]),
  'magery.57': s => one(Math.floor(s.currentHP / 2))
};
export const previewableIds = Object.freeze(Object.keys(models));
export function splitShare(pool, recipients, rank) {
  if (!Number.isInteger(recipients) || recipients < 1 || !Number.isInteger(rank) || rank < 0 || rank >= recipients) throw new RangeError('Invalid target count or rank');
  return Math.floor(pool / recipients) + (rank < pool % recipients ? 1 : 0);
}

export function impactPreview(spell, settings) {
  const model = models[spell.id];
  if (!model) throw new RangeError('A direct impact preview is unavailable for this spell');
  const weights = model(settings);
  const shared = spell.damage.kind === 'shared';
  const focusMode = spell.resistMode === 'half_then_focus';
  const half = focusMode || spell.resistMode === 'half_only';
  const scale = focusMode ? focusScale(settings.focus, settings.resistance) : 1;
  const chance = half ? resistChance(spell.circle, settings.magery, settings.resistance) : 0;
  let totalWeight = 0, sum = 0;
  const normal = [], resisted = [];
  for (const [raw, weight] of weights) {
    const share = shared ? splitShare(raw, settings.recipients, settings.rank ?? 0) : raw;
    const full = Math.floor(share * scale + 1e-9);
    const reduced = half ? Math.floor(share * 0.5 * scale + 1e-9) : full;
    normal.push(full);
    resisted.push(reduced);
    totalWeight += weight;
    sum += weight * (full * (1 - chance) + reduced * chance);
  }
  const bounds = values => [Math.min(...values), Math.max(...values)];
  return { raw: bounds([...weights.keys()]), normal: bounds(normal), resisted: bounds(resisted),
    resistChance: chance, canResist: half, mean: sum / totalWeight,
    recipient: spell.id === 'magery.37' && settings.casterInt < settings.targetInt ? 'caster' : 'target',
    heals: spell.role === 'Heal' };
}
