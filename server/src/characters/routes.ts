/* /api/realms, /api/characters — the online roster. Creation takes only the creation choices; the server answers with the
   authoritative character (stats, skills, starter equipment with server item ids). */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { makeGuards } from '../auth/guard';
import { fail } from '../auth/guard';
import { sha256 } from '../auth/crypto';
import type { Characters } from './service';
import type { RulesApi } from '../../../shared/game-rules-adapter';
import P = require('../../../shared/protocol');

const REALM = { type: 'string', pattern: '^[a-z0-9-]{2,32}$' } as const;
const UUID = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' } as const;
// the creation payload: exactly the choices a player makes in the creator. Unknown fields (gold, items, skill values…) are refused.
const LOOK = { type: 'object', additionalProperties: false, required: ['body', 'skinTone', 'hairStyle', 'hairColor', 'facialHairStyle', 'facialHairColor', 'clothingColor', 'cloak'],
  properties: Object.fromEntries(['body', 'skinTone', 'hairStyle', 'hairColor', 'facialHairStyle', 'facialHairColor', 'clothingColor', 'cloak'].map(k => [k, { type: 'string', maxLength: 24 }])) } as const;
const CREATE = { type: 'object', additionalProperties: false, required: ['name', 'look', 'str', 'dex', 'int', 'skills', 'town'], properties: {
  name: { type: 'string', maxLength: 64 }, look: LOOK, str: { type: 'integer' }, dex: { type: 'integer' }, int: { type: 'integer' },
  skills: { type: 'array', maxItems: 8, items: { type: 'array', minItems: 2, maxItems: 2, items: [{ type: ['string', 'null'], maxLength: 40 }, { type: 'integer' }] } },
  town: { type: 'string', maxLength: 24 } } } as const;

// per signed-in browser rather than per IP (players behind one address do not share a budget); unauthenticated: per IP
const perSession = (req: any) => { const c = req.cookies || {}; const t = c['__Host-sf_session'] || c.sf_session; return t ? 'sess:' + sha256(String(t)).toString('hex').slice(0, 32) : 'ip:' + req.ip; };

export function registerCharacterRoutes(app: FastifyInstance, chars: Characters, rules: RulesApi, guards: ReturnType<typeof makeGuards>, onCharacterGone: (id: string) => void) {
  app.get('/api/creation-options', async () => rules.creationOptions());

  app.get('/api/realms', { preHandler: guards.requireSession() }, async req => ({ realms: await chars.realms(req.sess!.account_id) }));

  app.get<{ Params: { realmId: string } }>('/api/realms/:realmId/characters', { preHandler: guards.requireSession(), schema: { params: { type: 'object', properties: { realmId: REALM } } } },
    async (req) => chars.roster(req.sess!.account_id, req.params.realmId));

  app.post<{ Params: { realmId: string }; Body: unknown }>('/api/realms/:realmId/characters', { preHandler: guards.requireSession(), config: { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: perSession } },
    schema: { params: { type: 'object', properties: { realmId: REALM } }, body: CREATE, headers: { type: 'object', properties: { 'idempotency-key': UUID } } } },
    async (req, reply) => {
      const key = req.headers['idempotency-key']; const creationKey = typeof key === 'string' && P.isUuid(key) ? key : null;
      const r = await chars.create(req.sess!.account_id, req.params.realmId, req.body, creationKey);
      reply.code(r.replayed ? 200 : 201);
      return { character: r.character, replayed: r.replayed, notes: (r as any).notes || [] };
    });

  app.get<{ Params: { id: string } }>('/api/characters/:id', { preHandler: guards.requireSession(), schema: { params: { type: 'object', properties: { id: UUID } } } },
    async (req) => {
      const c = await chars.snapshot(req.sess!.account_id, req.params.id); if (!c) throw fail(404, 'not_found', 'Character not found.');
      return { character: c };
    });

  app.post<{ Params: { id: string }; Body: { confirmName: string } }>('/api/characters/:id/delete', { preHandler: guards.requireSession(), schema: { params: { type: 'object', properties: { id: UUID } }, body: { type: 'object', additionalProperties: false, required: ['confirmName'], properties: { confirmName: { type: 'string', maxLength: 64 } } } } },
    async (req) => {
      const r = await chars.remove(req.sess!.account_id, req.params.id, req.body.confirmName); onCharacterGone(req.params.id); return r;
    });

  app.post<{ Params: { id: string } }>('/api/characters/:id/restore', { preHandler: guards.requireSession(), schema: { params: { type: 'object', properties: { id: UUID } } } },
    async (req) => chars.restore(req.sess!.account_id, req.params.id));
}
