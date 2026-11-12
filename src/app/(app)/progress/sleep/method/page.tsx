import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { SLEEP_DEBT_VERSION } from "@/lib/domain/sleep-debt";
import { SLEEP_ENERGY_VERSION } from "@/lib/domain/sleep-energy";
import { SLEEP_SCHEDULE_VERSION } from "@/lib/domain/sleep-schedule";
import { SLEEP_SCORE_VERSION } from "@/lib/domain/sleep-score";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "How sleep figures are worked out" };

/** The member-facing version of docs/SLEEP_METHOD.md. Keep the two in step. */
export default async function SleepMethodPage() {
  await requireOnboardedUser();
  const card = "rounded-2xl border border-border bg-card p-5 space-y-2 text-sm text-muted-foreground";
  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="How the figures are worked out" description="Everything here is calculated from what you logged or imported from a health platform. The app itself measures nothing, and anything assumed is labelled." />

      <section className={card} aria-labelledby="m-nights">
        <h2 id="m-nights" className="font-display text-lg font-bold uppercase text-foreground">
          Nights and time asleep
        </h2>
        <p>Time in bed is from getting into bed to getting up. Time asleep subtracts the time before you fell asleep, after your final wake-up and any minutes awake, when you entered them. If you entered none of that, time asleep is shown as time in bed and labelled that way.</p>
        <p>Times are kept as real instants, so a clock change counts the hours that actually passed. A night belongs to the day you got up. Naps are listed on their own day and never counted in nightly figures.</p>
      </section>

      <section className={card} aria-labelledby="m-score">
        <h2 id="m-score" className="font-display text-lg font-bold uppercase text-foreground">
          Nightly score (version {SLEEP_SCORE_VERSION})
        </h2>
        <p>A 0–100 description of one night as logged, from up to four parts. A part is only counted when you entered what it needs, and the parts that exist are averaged by their weight, so leaving something out never lowers your score. The label beside the score says what it was based on.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Time asleep vs your goal (50):</strong> full marks at your goal or more, none at half your goal or less.
          </li>
          <li>
            <strong className="text-foreground">Sleep efficiency (20):</strong> time asleep divided by time in bed; full marks at 90% or more, none at 60% or less. Needs when you fell asleep, your final wake-up or minutes awake.
          </li>
          <li>
            <strong className="text-foreground">Timing vs your usual (20):</strong> how far your bedtime and wake time were from your own typical times over the previous two weeks; full marks within 30 minutes, none at two hours or more. Needs three earlier nights.
          </li>
          <li>
            <strong className="text-foreground">Wake-ups (10):</strong> full marks for one or none, none at six or more.
          </li>
        </ul>
        <p>80 and over reads as restful, 60–79 as fair, below 60 as a short or broken night. The thresholds are round numbers chosen to be readable, not medical cut-offs. The score is not sleep debt, not a recovery measure and not a diagnosis.</p>
      </section>

      <section className={card} aria-labelledby="m-rhythm">
        <h2 id="m-rhythm" className="font-display text-lg font-bold uppercase text-foreground">
          Your typical times
        </h2>
        <p>With three or more nights in the last two weeks: the middle value of your bedtimes and of your wake times (worked out around the clock, so 11:30 PM and 12:30 AM average to around midnight) and how far nights typically stray from it. Within 30 minutes is steady, within an hour variable, beyond that irregular.</p>
      </section>

      <section className={card} aria-labelledby="m-debt">
        <h2 id="m-debt" className="font-display text-lg font-bold uppercase text-foreground">
          Estimated sleep debt (version {SLEEP_DEBT_VERSION}, Pro)
        </h2>
        <p>A rolling estimate over your last 14 nights. A night under your goal adds the whole shortfall. A night over it pays back half of the extra, and only what is still owed, so sleeping in doesn&apos;t cancel lost sleep hour for hour. Nights you didn&apos;t log change nothing. Up to an hour behind is on track, up to three hours a little behind, more than that a deficit. It is an estimate from your entries, not a measurement, and it is separate from the nightly score.</p>
      </section>

      <section className={card} aria-labelledby="m-patterns">
        <h2 id="m-patterns" className="font-display text-lg font-bold uppercase text-foreground">
          Patterns from check-ins
        </h2>
        <p>Nights with a habit you reported (caffeine from 2 PM, alcohol, a large late meal, evening screens, evening training, travel, a disturbance) are compared with nights without it: average time asleep and average restedness. A comparison only appears with at least three nights on each side and a difference of 15 minutes or half a rating point, and it is always a pattern in your own entries, never a claim about cause.</p>
      </section>

      <section className={card} aria-labelledby="m-windows">
        <h2 id="m-windows" className="font-display text-lg font-bold uppercase text-foreground">
          Suggested windows (version {SLEEP_SCHEDULE_VERSION}, Pro)
        </h2>
        <p>The wake-up window is 15 minutes either side of the wake time you chose, or your typical one. The bedtime window counts back from it: your goal, plus how long you typically take to fall asleep (15 minutes if you never entered it), plus ten minutes to settle, then 30 minutes either side. When your usual bedtime is more than half an hour from the window, the plan moves it 15 minutes a night with the wake time held fixed. None of this measures your body clock.</p>
      </section>

      <section className={card} aria-labelledby="m-energy">
        <h2 id="m-energy" className="font-display text-lg font-bold uppercase text-foreground">
          Estimated daily energy (version {SLEEP_ENERGY_VERSION}, Pro)
        </h2>
        <p>An hour-by-hour sketch from stated assumptions: alertness is highest a few hours after waking and falls as the day goes on; there&apos;s a dip six to eight hours after waking; and the last two hours before bed wind down. A short night and an estimated sleep debt lower the whole curve, by at most 40% together. It ignores caffeine, light, meals and training, which is why what you actually report is shown next to it.</p>
      </section>

      <section className={card} aria-labelledby="m-habits">
        <h2 id="m-habits" className="font-display text-lg font-bold uppercase text-foreground">
          Habit tips
        </h2>
        <p>Ten plain rules over your last two weeks of nights and check-ins, each shown with the entries it came from and one thing to try. At most three appear at a time; dismiss any and it stays hidden until you restore it. The tips are general sleep-habit guidance, never advice about medication.</p>
      </section>

      <section className={card} aria-labelledby="m-compare">
        <h2 id="m-compare" className="font-display text-lg font-bold uppercase text-foreground">
          Comparisons over longer ranges
        </h2>
        <p>Sleep history shows time asleep night by night over 7 days, weekly averages over 30 and 90 days and monthly averages over a year; a week or month with nothing logged is an empty slot, never zero. Weekday and weekend nights (Pro) are compared on nights logged, average time asleep, nights at goal and typical bedtime and wake time. A night counts as a weekend night when it ends on a Saturday or Sunday; typical times need three nights on each side; differences under 10 minutes read as &ldquo;about the same&rdquo;.</p>
      </section>

      <section className={card} aria-labelledby="m-training">
        <h2 id="m-training" className="font-display text-lg font-bold uppercase text-foreground">
          Sleep and training (Pro)
        </h2>
        <p>Three plain comparisons over your last 28 days, each needing at least three nights on both sides: time asleep before training days against rest days, logged effort (RPE) after short nights against the rest (a difference of 0.4 or more is reported), and restedness on training days against the rest (0.5 points or more). They describe your own entries side by side and are not proof that one causes the other. The easier-day suggestion goes through the same accept-or-decline cards as every other training suggestion and never changes your plan on its own.</p>
      </section>

      <section className={card} aria-labelledby="m-alarm">
        <h2 id="m-alarm" className="font-display text-lg font-bold uppercase text-foreground">
          Wake-up alarm
        </h2>
        <p>A fixed time on the days you choose, saved to your account. The phone app schedules it as one repeating notification per day with Snooze and I&apos;m up; a web browser can&apos;t sound it. The &ldquo;next alarms&rdquo; list is worked out in your profile time zone from the saved settings. No alarm ever sounds before the time you set: a smart window would need the phone to watch your sleep in the background, which isn&apos;t built. The alarm hasn&apos;t been tested on a physical phone yet.</p>
      </section>

      <section className={card} aria-labelledby="m-goal">
        <h2 id="m-goal" className="font-display text-lg font-bold uppercase text-foreground">
          Your goal
        </h2>
        <p>A target you choose between 4 and 12 hours (8 to begin with). It isn&apos;t a measurement of what your body needs. Goal completion is time asleep divided by the goal, and a long night can read over 100%.</p>
      </section>
    </div>
  );
}
