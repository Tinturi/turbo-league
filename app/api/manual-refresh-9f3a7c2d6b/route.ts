import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || "https://turbo-league-s2.netlify.app";

  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const response = await fetch(`${siteUrl}/api/sync`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
