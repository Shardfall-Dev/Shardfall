/* Local development / CI only: the anon and service_role keys for the dev Supabase Auth in docker-compose.yml.
   They are HS256 JWTs signed with that compose file's public dev secret. Real projects take theirs from the Supabase
   dashboard (Project Settings → API keys). Usage: node --import tsx server/dev/keys.ts */
import crypto = require('node:crypto');
export const DEV_JWT_SECRET = 'shardfall-local-dev-jwt-secret-not-for-production-use';
export function devJwt(role: 'anon' | 'service_role', secret = DEV_JWT_SECRET) {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000); const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ role, iss: 'shardfall-dev', iat: now, exp: now + 10 * 365 * 86400 })}`;
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
if (require.main === module) { console.log('SUPABASE_ANON_KEY=' + devJwt('anon')); console.log('SUPABASE_SERVICE_ROLE_KEY=' + devJwt('service_role')); }
