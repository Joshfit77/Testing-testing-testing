/** The verse's opening clause for image cards, marked with an ellipsis when it doesn't complete the verse. */
export function verseExcerpt(text: string, max = 70): string {
  const full = text.trim();
  let cut = full.split(/[:;,.?!]/)[0]!.trim();
  if (cut.length > max) cut = cut.slice(0, max - 3).trimEnd();
  return cut.length >= full.replace(/[.,;:]$/, "").length ? full : `${cut}…`;
}
