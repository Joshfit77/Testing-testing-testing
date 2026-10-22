/** The meal someone is most likely logging at this time of day (they can always change it). */
export function mealForTime(date: Date): "breakfast" | "lunch" | "dinner" | "snack" {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 14 * 60 + 30) return "lunch";
  if (minutes < 17 * 60) return "snack";
  if (minutes < 21 * 60) return "dinner";
  return "snack";
}
