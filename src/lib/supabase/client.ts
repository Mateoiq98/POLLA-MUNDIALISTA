import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  if (typeof window === "undefined") {
    return createClient("https://placeholder.supabase.co", "placeholder");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !isValidUrl(supabaseUrl)
  ) {
    return createClient("https://placeholder.supabase.co", "placeholder");
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
