/**
 * Configures Node.js global fetch to use the sandbox HTTP proxy.
 * Must be imported BEFORE any @supabase/supabase-js usage.
 *
 * This is needed because the sandbox routes all outbound HTTPS
 * through an egress proxy. curl respects HTTPS_PROXY automatically,
 * but Node.js fetch does not — we need undici's ProxyAgent.
 */

const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;

if (proxy) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent, setGlobalDispatcher } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxy));
  } catch {
    // undici not available — fetch will work if there's no proxy needed
  }
}
