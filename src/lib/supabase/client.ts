"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Returns a singleton browser client only after the public project settings exist. */
export function getSupabaseClient() {
  if (!url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}

