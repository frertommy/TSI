// Server-only admin client — re-exports the same pg-backed client.
// In Supabase production this would use the service role key to bypass RLS.
// With local PostgreSQL, RLS is not enforced so both clients are equivalent.
export { supabase as supabaseAdmin } from './supabase';
