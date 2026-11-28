# Biblical AI: decisions for the founder

These were implemented as stated in the directive, or as the safest default. Each one is a setting or a small change.

| # | Decision | What is implemented | Why / alternative |
|---|---|---|---|
| D-1 | **Pricing.** Section 26 of the directive says "Pro monthly $19.99, Pro annual $149"; Section 0 says $24.99 / $149.99 | **$24.99 / $149.99**, unchanged (founder approval of 2026-11-27) | Section 0 is the verified baseline. No price was changed. Confirm. |
| D-2 | **Free tier gets Biblical AI** (directive: "three standard questions per day, configurable") | Free: 3 a day, 60 a month, quick and standard depths, $0.30 a month AI money cap | This is the first generative AI on Free since 2026-11-13. Set `BIBLICAL_AI_FREE_DAILY=0` to make Biblical AI Pro-only. |
| D-3 | **Legacy Plus** members | Get the Free allowance | Plus is a paid plan without AI. Giving it Pro allowances would change an existing subscription's terms. |
| D-4 | **Pro limits** | 40 a day, 400 a month, within the existing $1.40 per-member AI budget | Same as the existing Bible helper. Adjust with `BIBLICAL_AI_PRO_*`. |
| D-5 | **Deep studies on Sonnet** | Pro deep studies ask for the larger model | Uses the member's larger-model share; falls back to Haiku. Model choice must be confirmed by a live evaluation (`scripts/eval/run-biblical-ai-eval.ts`), which needs an approved API key and costs money. |
| D-6 | **Teacher material** | No teacher's material is loaded; all 11 are pending review. When approved, it informs one assistant's answers as internal knowledge, without naming the teacher | Licensing (SOURCES.md). The feature works on Scripture and the original-language data alone. |
| D-7 | **The saving shown for yearly** | Not part of this work | Unchanged. |
| D-8 | **Existing "Ask about the Bible" helper** | Unchanged and still at `/faith/ask`. While the flag is on, the Faith shortcut points to Biblical AI | Its history stays available. It could be retired after launch. |
| D-9 | **Personalized studies** | Stored as saved studies with day-by-day progress, not as reading journeys | Journeys are whole-book reading plans with a strict restart rule. Topic studies are lists of passages and should not inherit that rule. |
| D-10 | **Founders** | `FOUNDER_USER_IDS` (server setting) | Needed before any teacher's material can be approved. |
| D-11 | **Retention** | Biblical AI conversations follow `AI_CHAT_RETENTION_DAYS` like other AI chats. Saved studies stay until the member deletes them | Confirm, and state it in the privacy policy. |
| D-12 | **Privacy policy and Terms** | Not changed | They must mention Biblical AI before launch: questions sent to the AI provider, optional sharing of journal entries, and reports. |
| D-13 | **Teachers are internal** (founder clarification, 2026-11-28) | No teacher profiles, directory, menus, photographs, biographies or modes. The list is server-only. The model is told to answer as one voice; the checks remove any teacher name unless the member asks about that teacher and a document by them was used | Decided. Open: when a member asks "what does X teach?" and X's material is approved, the answer may summarise it by name. Set the rule stricter (never name) if preferred; it is one line in `teacherAttributions`. |
| D-14 | **Credits** | Shown only where a licence requires one (`attribution_required`), using the recorded text | The text is part of each licence review. |
