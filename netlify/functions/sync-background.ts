export default async (req: Request) => {
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL || "https://turbo-league-s2.netlify.app";

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return;
  }

  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized background sync request");
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/api/sync`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const body = await response.text();
    console.log(`Turbo League background sync: ${response.status} ${body}`);
  } catch (error) {
    console.error("Turbo League background sync failed", error);
  }
};

export const config = {
  background: true,
  path: "/api/background-sync",
};
