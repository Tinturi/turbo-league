export const players = [
  { id: "1", name: "Артём", dotaId: "261238708", rating: 1000, wins: 0, losses: 0 },
  { id: "2", name: "Денчик", dotaId: "152657599", rating: 1000, wins: 0, losses: 0 }
];

export type Match = {
  id: string;
  playerId: string;
  hero: string;
  result: "win" | "loss";
  delta: number;
  ratingAfter: number;
  date: string;
};

export const matches: Match[] = [];
