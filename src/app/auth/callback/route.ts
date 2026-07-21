import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/sheet";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = new URL("/sheet", url.origin);
      destination.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
