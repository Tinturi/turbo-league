"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import WeeklyHeroSelection from "@/app/components/WeeklyHeroSelection";

export default function Season4ProfileEnhancer() {
  const pathname = usePathname();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const playerId = Number(pathname.match(/^\/player\/(\d+)/)?.[1] ?? 0);

  useEffect(() => {
    if (!playerId) return;
    const page = document.querySelector<HTMLElement>(".player-profile-page");
    if (!page) return;

    const oldHeroSection = [...page.querySelectorAll<HTMLElement>("section.card")].find((element) =>
      element.textContent?.includes("ЗАБЛОКИРОВАНЫ НА ЭТОЙ ИГРОВОЙ НЕДЕЛЕ")
    );

    const host = document.createElement("div");
    host.dataset.season4WeeklyHeroes = "true";
    if (oldHeroSection?.parentElement) {
      oldHeroSection.style.display = "none";
      oldHeroSection.parentElement.insertBefore(host, oldHeroSection);
    } else {
      const stats = page.querySelector(".profile-stats");
      stats?.insertAdjacentElement("afterend", host);
    }
    setMount(host);

    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (!node.nodeValue) continue;
      node.nodeValue = node.nodeValue
        .replaceAll("Season 3", "Season 4")
        .replaceAll("третьего сезона", "четвёртого сезона")
        .replaceAll("Третьего сезона", "Четвёртого сезона");
    }

    return () => {
      oldHeroSection?.style.removeProperty("display");
      host.remove();
      setMount(null);
    };
  }, [playerId]);

  if (!playerId || !mount) return null;
  return createPortal(<WeeklyHeroSelection playerId={playerId} />, mount);
}
