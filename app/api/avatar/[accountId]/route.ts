import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/auth";
import { imageType } from "@/lib/avatar-input";

export const dynamic = "force-dynamic";

type OpenDotaProfile = {
  profile?: {
    avatarfull?: string | null;
    avatarmedium?: string | null;
    avatar?: string | null;
  };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const numericAccountId = Number(accountId);

  if (!Number.isFinite(numericAccountId)) {
    return NextResponse.json({ avatar: null }, { status: 400 });
  }

  try {
    const { data: player } = await supabaseAdmin.from("players").select("id").eq("account_id", numericAccountId).maybeSingle();
    if (player) {
      const { data: custom } = await supabaseAdmin.from("player_avatars").select("image").eq("player_id", player.id).maybeSingle();
      if (custom) return NextResponse.json({ avatar: custom.image }, { headers: { "Cache-Control": "no-store" } });
    }
    const response = await fetch(
      `https://api.opendota.com/api/players/${numericAccountId}`,
      {
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { avatar: null },
        { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
      );
    }

    const data = (await response.json()) as OpenDotaProfile;
    const avatar =
      data.profile?.avatarfull ??
      data.profile?.avatarmedium ??
      data.profile?.avatar ??
      null;

    return NextResponse.json(
      { avatar },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } },
    );
  } catch {
    return NextResponse.json(
      { avatar: null },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params;
    const id = Number(accountId);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Некорректный игрок" }, { status: 400 });
    const { data: player } = await supabaseAdmin.from("players").select("id").eq("account_id", id).eq("active", true).maybeSingle();
    if (!player) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    const denied = await requireOwner(request, Number(player.id));
    if (denied) return denied;
    if (Number(request.headers.get("content-length")) > 512 * 1024) return NextResponse.json({ error: "Максимальный размер — 512 КБ" }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Выберите изображение" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 512 * 1024) { await reader.cancel(); return NextResponse.json({ error: "Максимальный размер — 512 КБ" }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const mime = imageType(bytes);
    if (!mime) return NextResponse.json({ error: "Допустимы только PNG, JPEG и WebP" }, { status: 400 });
    const { error } = await supabaseAdmin.from("player_avatars").upsert({ player_id: player.id, image: `data:${mime};base64,${bytes.toString("base64")}`, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Не удалось сохранить аватар" }, { status: 503 }); }
}
