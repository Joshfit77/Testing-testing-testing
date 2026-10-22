/**
 * Integration tests run against a real Supabase stack (local `supabase start` by default).
 * They are skipped automatically when the stack isn't reachable.
 * Env must be set before any app module is imported (serverEnv reads process.env at import).
 */
const LOCAL_URL = "http://127.0.0.1:54321";
// Standard public demo keys of the local Supabase CLI stack (not secrets).
const LOCAL_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY ?? LOCAL_ANON;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE;
// Dummy credentials: these tests never call Stripe or Anthropic over the network.
process.env.STRIPE_SECRET_KEY = "sk_test_integration_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration_dummy";
process.env.STRIPE_PRICE_PLUS = "price_test_plus";
process.env.STRIPE_PRICE_PRO = "price_test_pro";
process.env.STRIPE_PRICE_PRO_YEARLY = "price_test_pro_yearly";
process.env.STRIPE_PRICE_PLUS_YEARLY = "price_test_plus_yearly";
process.env.STRIPE_PRICE_PLUS_LEGACY = "price_old_plus_a, price_old_plus_b";
process.env.STRIPE_PRICE_PRO_LEGACY = "price_old_pro";
process.env.ANTHROPIC_API_KEY = "sk-ant-integration-dummy";
// RevenueCat: a local stand-in for its REST API (started by store-billing.test.ts); nothing reaches RevenueCat.
process.env.REVENUECAT_SECRET_API_KEY = "sk_rc_integration_dummy";
process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer rc-webhook-integration";
process.env.REVENUECAT_API_BASE_URL = "http://127.0.0.1:4611";
