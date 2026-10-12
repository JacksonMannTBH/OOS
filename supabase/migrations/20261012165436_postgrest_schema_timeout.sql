-- PostgREST's schema and timezone metadata queries can exceed eight seconds
-- under database load. Allow its internal cache to recover instead of serving
-- PGRST002/503 for every request.
ALTER ROLE authenticator SET statement_timeout = '120s';

-- Keep application service requests at their previous inherited limit.
ALTER ROLE service_role SET statement_timeout = '8s';
NOTIFY pgrst, 'reload config';
