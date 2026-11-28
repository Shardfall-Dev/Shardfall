-- Local development / CI only: the roles Supabase Auth (GoTrue) expects on a plain PostgreSQL. On supabase.co and with the
-- Supabase CLI these already exist; never run this against a real project.
create role supabase_admin login createrole createdb replication bypassrls password 'supabase_admin_dev';
create role supabase_auth_admin noinherit createrole login noreplication password 'auth_dev_password';
create schema if not exists auth authorization supabase_auth_admin;
grant create on database postgres to supabase_auth_admin;
alter role supabase_auth_admin set search_path = 'auth';
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role dashboard_user nocreatedb createrole replication;
grant anon, authenticated, service_role to supabase_auth_admin;
