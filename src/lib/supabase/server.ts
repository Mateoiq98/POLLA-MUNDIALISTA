import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

export function createServerClient() {
  if (serverClient) return serverClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return createClient("https://placeholder.supabase.co", "placeholder");
  }

  serverClient = createClient(supabaseUrl, supabaseServiceKey);
  return serverClient;
}
