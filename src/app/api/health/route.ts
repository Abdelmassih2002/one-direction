import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return NextResponse.json(
    { status: "ok", supabaseConfigured: configured, time: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}
