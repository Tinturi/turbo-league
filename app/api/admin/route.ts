import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type AdminBody = {
  password?: string;
  action?: "list" | "update";
  playerId?: number;
  rating?: number;
};

function authorized(password?: string) {
  const adminSecret = process.env.ADMIN_SECRET;
  return Boolean(adminSecret && password && password === adminSecret);
}

export async function POST(req: NextRequest) {
  let body: AdminBody;

  try {
    body = (await req.json()) as AdminBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_SECRET не настроен в Netlify" },
      { status: 500 },
    );
  }

  if (!authorized(body.password)) {
    return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }

  if (body.action === "list") {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("id,name,account_id,rating,wins,losses")
      .eq("active", true)
      .order("rating", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, players: data ?? [] });
  }

  if (body.action === "update") {
    if (!Number.isInteger(body.playerId) || !Number.isInteger(body.rating)) {
      return NextResponse.json(
        { ok: false, error: "Игрок или рейтинг указаны неверно" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({ rating: body.rating })
      .eq("id", body.playerId)
      .select("id,name,rating")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, player: data });
  }

  return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400 });
}
