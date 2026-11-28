import "server-only";

/**
 * The eleven approved modern teachers (founder's list, 2026-11-28): internal theological knowledge sources for the one
 * Narrow Gate Biblical AI assistant. Server-only and never shown to members: there are no teacher profiles, directories,
 * selection menus or teacher-specific modes. Their verified, licensed material (biblical_ai_source_documents, managed
 * in the restricted admin backend) informs answers that the assistant writes in its own words; Scripture stays the
 * final authority. The answer checks use these names to remove any mention of a teacher that the member didn't ask
 * about, and any attribution without a verified document (src/lib/biblical-ai/answer.ts).
 */
export const APPROVED_TEACHERS: { slug: string; name: string; ministry: string | null }[] = [
  { slug: "john-macarthur", name: "John MacArthur", ministry: "Grace to You" },
  { slug: "ray-comfort", name: "Ray Comfort", ministry: "Living Waters" },
  { slug: "john-piper", name: "John Piper", ministry: "Desiring God" },
  { slug: "paul-washer", name: "Paul Washer", ministry: "HeartCry Missionary Society" },
  { slug: "tim-conway", name: "Tim Conway", ministry: "I'll Be Honest" },
  { slug: "voddie-baucham", name: "Voddie Baucham", ministry: null },
  { slug: "billy-graham", name: "Billy Graham", ministry: "Billy Graham Evangelistic Association" },
  { slug: "alistair-begg", name: "Alistair Begg", ministry: "Truth For Life" },
  { slug: "mark-spence", name: "Mark Spence", ministry: "Living Waters" },
  { slug: "frank-turk", name: "Frank Turk", ministry: null },
  { slug: "jeff-durbin", name: "Jeff Durbin", ministry: "Apologia Studios / Apologia Church" },
];
