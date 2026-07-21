"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hasValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Invalid or incomplete public configuration must never crash the study sheet. */
export const isSupabaseConfigured = Boolean(key && hasValidSupabaseUrl(url));

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Returns a singleton browser client only after the public project settings exist. */
export function getSupabaseClient() {
  if (!isSupabaseConfigured || !url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}
