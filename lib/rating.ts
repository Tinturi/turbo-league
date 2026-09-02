export const START_RATING = 1000;
export const WIN_DELTA = 25;
export const LOSS_DELTA = -25;

export function ratingDelta(won: boolean) {
  return won ? WIN_DELTA : LOSS_DELTA;
}
