(async () => {
  const S = window.__SF, P = S.P, SF = S.SF; const out = {};
  const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
  const btn = () => document.querySelector('#b-mcancel'); const vis = () => { S.update(.01); S.ACT.page && 0; document.querySelectorAll('.slot'); return !btn().hidden; };
  const refresh = () => { S.update(.01); window.dispatchEvent(new Event('resize')); };
  P.int = 100; if (P.base) P.base.int = 100;   // v0.30: creation stats stop at 60; this scenario needs 60+ mana
  out.hiddenIdle = (S.update(.05), btn().hidden);
  // during prep: interruption — reagents back, half mana spent
  P.mana = 60; const m0 = P.mana, pearls = SF.count(P.pack, 'black_pearl'); S.castSlot('magery.05'); out.reserved = Math.round((m0 - P.mana) * 10) / 10; step(.2); const mp = P.mana;
  out.shownPrep = btn() && (document.querySelector('#b-mcancel').click(), true); out.prepGone = !P.prep;
  out.prepLedger = { pearlsBack: SF.count(P.pack, 'black_pearl') === pearls, refundOnCancel: Math.round((P.mana - mp) * 10) / 10 };
  // during hold: let go unreleased, charge spent, recovery applies
  step(.5); P.mana = 60; const m1 = P.mana; S.castSlot('magery.05'); step(.6); out.held = !!P.held; const pearls2 = SF.count(P.pack, 'black_pearl');
  const mh = P.mana; S.ACT.mcancel(); out.heldGone = !P.held && !S.AIM; out.recovering = P.spellReadyAt > S.GT; out.holdLedger = { pearls: SF.count(P.pack, 'black_pearl') === pearls2, refundOnCancel: Math.round((P.mana - mh) * 10) / 10 };
  out.lastLog = S.LOG.slice(-1)[0].t;
  // Esc does the same and leaves the attack button alone otherwise
  step(.5); S.castSlot('magery.04'); step(.6); S.ACT.cancel(); out.escCleared = !P.held;
  return out;
})()
