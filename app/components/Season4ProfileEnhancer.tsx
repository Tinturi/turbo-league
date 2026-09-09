"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import WeeklyHeroSelection from "@/app/components/WeeklyHeroSelection";

export default function Season4ProfileEnhancer() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const playerId = Number(pathname.match(/^\/player\/(\d+)/)?.[1] ?? 0);

  useEffect(() => {
    if (!playerId) return;
    const page = document.querySelector<HTMLElement>(".player-profile-page");
    if (!page) return;

    const oldHeroSection = [...page.querySelectorAll<HTMLElement>("section.card")].find((element) =>
      element.textContent?.includes("ЗАБЛОКИРОВАНЫ НА ЭТОЙ ИГРОВОЙ НЕДЕЛЕ")
    );
    if (oldHeroSection) oldHeroSection.style.display = "none";

    const stats = page.querySelector<HTMLElement>(".profile-stats");
    const doubleDown = stats?.nextElementSibling;
    const root = rootRef.current;
    if (root && doubleDown && doubleDown.parentElement === page) {
      page.insertBefore(root, doubleDown);
    }

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

    setReady(true);
    return () => {
      oldHeroSection?.style.removeProperty("display");
    };
  }, [playerId]);

  if (!playerId) return null;

  return (
    <div ref={rootRef} style={{ display: ready ? "block" : "none", marginBottom: 24 }}>
      <WeeklyHeroSelection playerId={playerId} />
    </div>
  );
}
