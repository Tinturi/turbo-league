import { supabase } from "@/lib/supabase";
import SeasonAnnouncementModal from "@/app/components/SeasonAnnouncementModal";

export default async function SeasonAnnouncement() {
  const { data } = await supabase
    .from("league_announcements")
    .select("starts_at,ends_at")
    .eq("id", "season3-complete")
    .maybeSingle();

  const now = Date.now();
  if (!data || now < Date.parse(data.starts_at) || now >= Date.parse(data.ends_at)) return null;

  return <SeasonAnnouncementModal />;
}
