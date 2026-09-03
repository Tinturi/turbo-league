import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "This sync route is retired. Season 3 synchronization runs through GitHub Actions.",
    },
    { status: 410 },
  );
}
