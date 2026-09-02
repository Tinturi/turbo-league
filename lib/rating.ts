export const START_RATING = 1000;
export const WIN_DELTA = 20;
export const LOSS_DELTA = -20;

export function ratingDelta(won: boolean) {
  return won ? WIN_DELTA : LOSS_DELTA;
}
