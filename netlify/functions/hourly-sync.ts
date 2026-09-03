export default async () => {
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || "https://turbo-league-s2.netlify.app";

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }

  const response = await fetch(`${siteUrl}/api/background-sync`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  console.log(`Turbo League 10-minute scheduler: ${response.status}`);

  if (!response.ok && response.status !== 202) {
    return new Response("Failed to start background sync", { status: response.status });
  }

  return new Response("Background sync started", { status: 200 });
};

export const config = {
  schedule: "*/10 * * * *",
};
