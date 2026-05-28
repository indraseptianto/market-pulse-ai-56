import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (bypass RLS with service role key)
// Only import on server
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Browser Supabase client (respects RLS via anon key)
function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: true,
    },
  });
}

// Export singleton instances
let _browserClient: ReturnType<typeof createBrowserClient> | null = null;
let _serverClient: ReturnType<typeof createServerClient> | null = null;

export function getSupabaseBrowser() {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowser() called on server");
  }
  if (!_browserClient) {
    _browserClient = createBrowserClient();
  }
  return _browserClient;
}

export function getSupabaseServer() {
  if (!_serverClient) {
    _serverClient = createServerClient();
  }
  return _serverClient;
}

// Check if Supabase is configured
export function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Graceful fallback for when Supabase is not configured
export const supabase = {
  get browser() {
    try {
      return getSupabaseBrowser();
    } catch {
      return null;
    }
  },
  get server() {
    try {
      return getSupabaseServer();
    } catch {
      return null;
    }
  },
  get configured() {
    return isSupabaseConfigured();
  },
};