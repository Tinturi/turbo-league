export const START_RATING = 1000;
export const CALIBRATION_MATCHES = 5;
export const CALIBRATION_WIN_DELTA = 50;
export const CALIBRATION_LOSS_DELTA = -50;
export const WIN_DELTA = 25;
export const LOSS_DELTA = -25;

export function ratingDelta(won: boolean, seasonMatchIndex = CALIBRATION_MATCHES) {
  const calibration = seasonMatchIndex < CALIBRATION_MATCHES;
  if (calibration) return won ? CALIBRATION_WIN_DELTA : CALIBRATION_LOSS_DELTA;
  return won ? WIN_DELTA : LOSS_DELTA;
}
