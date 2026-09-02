export default async () => {
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || "https://turbo-league-s2.netlify.app";

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }

  const response = await fetch(`${siteUrl}/api/sync`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = await response.text();

  console.log(`Turbo League 30-minute sync: ${response.status} ${body}`);

  if (!response.ok) {
    return new Response(body, { status: response.status });
  }

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const config = {
  schedule: "*/30 * * * *",
};
