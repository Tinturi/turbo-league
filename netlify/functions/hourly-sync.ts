import { createClient } from "@supabase/supabase-js";

export default async () => {
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || "https://turbo-league-s2.netlify.app";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!cronSecret || !supabaseUrl || !supabaseSecretKey) {
    console.error("Scheduler environment variables are not configured");
    return new Response("Scheduler environment variables are not configured", { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id,name")
    .eq("active", true)
    .order("id");

  if (error) {
    console.error(`Scheduler player lookup failed: ${error.message}`);
    return new Response("Failed to load players", { status: 500 });
  }

  const players = data ?? [];

  const results = await Promise.all(
    players.map(async (player) => {
      try {
        const response = await fetch(
          `${siteUrl}/api/background-sync?playerId=${encodeURIComponent(player.id)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${cronSecret}` },
          },
        );

        return `${player.name}:${response.status}`;
      } catch (error) {
        console.error(`Scheduler failed to dispatch ${player.name}`, error);
        return `${player.name}:dispatch-error`;
      }
    }),
  );

  console.log(`Turbo League per-player scheduler: ${results.join(", ")}`);

  return new Response(`Dispatched ${players.length} player syncs`, { status: 200 });
};

export const config = {
  schedule: "*/10 * * * *",
};
