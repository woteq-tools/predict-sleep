// Sleep Predictor - pure time helpers (skeleton)

export function predictBedtime(wakeMs, awakeMinutes) {
  return wakeMs + awakeMinutes * 60 * 1000;
}
