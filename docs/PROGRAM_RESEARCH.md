# Program research, audit and rebuild

This document records the research behind the training-program library, an audit of every library program and every "Build my program" type before the rebuild, and what changed. It is general fitness guidance, not medical advice, and **it has not been reviewed by a qualified coach** (see "What is not verified" at the end).

**How the research was done.** Web search worked for this pass. Each claim below cites a link I retrieved. Most retrieved pages were abstracts, PubMed/PMC records, or secondary summaries rather than full papers, so the numbers come from those pages and are marked "(secondary)" where the summary was all I had. Items marked **[background knowledge]** come from well-established literature I already knew and did not re-fetch. Program-template details (for example 5/3/1 percentages or GZCLP stages) come from practitioner and app pages, not peer-reviewed sources, because that is where those templates are published.

Re-run the audit at any time:

```bash
npx tsx scripts/audit-programs.ts            # every library program: week 1 and deload weeks
npx tsx scripts/audit-programs.ts <slug>     # every week of one program
npx tsx scripts/audit-custom-programs.ts     # every "Build my program" type × goal × days
```

The audit logic is in `src/lib/domain/program-audit.ts`, and the session-length estimate is in `src/lib/domain/session-time.ts`. It counts weekly **fractional hard sets**, the counting method in Pelland et al.'s meta-regression: a set counts 1 toward the exercise's first primary muscle and 0.5 toward any other primary muscle. Speed sets (3 or fewer reps under 70% of a max) count as 0.

---

## 1. Research summary

### 1.1 Cross-cutting evidence (hypertrophy and strength variables)

| Variable | What the evidence says | Sources |
|---|---|---|
| **Volume (sets per muscle per week)** | Graded dose-response. Hypertrophy rises across <5, 5–9 and 10+ weekly sets. Later work suggests 12–20 sets is a "sufficient" range for trained lifters, with diminishing returns above that. Strength needs much less volume than hypertrophy (diminishing returns after only a few sets). | Schoenfeld, Ogborn & Krieger 2017 ([PDF](https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf)); Pelland et al. meta-regression, preprint ([SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/460)); critique of the 10+ set comparison ([PainScience](https://www.painscience.com/biblio/statistically-insignificant-evidence-that-more-is-better-at-the-gym.html)) |
| **Volume landmarks (RP: MV/MEV/MAV/MRV)** | Practical model: start a block near the minimum effective volume (~6–10 sets) and add about a set per muscle per week toward the maximum adaptive volume (~12–20). Deload when recovery fails. The landmarks are individual. The numbers are coaching heuristics, not trial results. | (secondary) [Arvo: volume landmarks](https://arvo.guru/resources/volume-landmarks), [Arvo: RP training](https://arvo.guru/resources/methods/rp-training) |
| **Frequency** | Training each muscle at least twice a week is a sensible default (Schoenfeld 2016). When volume is equated, frequency adds little for hypertrophy, but it clearly helps strength: about 3% more strength gain per extra weekly session in Pelland et al. | (secondary) [Built With Science summary](https://builtwithscience.com/how-often-to-train/); [Pelland preprint](https://sportrxiv.org/index.php/server/preprint/view/460) |
| **Proximity to failure (RIR)** | Hypertrophy improves as sets get closer to failure (Robinson 2024). Strength barely depends on it. Training to momentary failure has no clear advantage over stopping just short (Refalo 2023). Practical rule: 0–3 reps in reserve (RIR) for hypertrophy work, with isolation closer to failure than heavy compounds. | Refalo et al. 2023 ([AUT repository](https://openrepository.aut.ac.nz/items/78679612-6ff4-4d00-95d1-7920d072a760/full)); Robinson et al. 2024 ([SportRxiv](https://sportrxiv.org/index.php/server/preprint/view/295)); [FAU news](https://www.fau.edu/newsdesk/articles/muscle-growth-strength-study) |
| **RPE/RIR scale** | An RIR-based RPE scale (RPE 10 = 0 RIR, RPE 9 = 1 RIR) is valid for autoregulating load. Experienced lifters rate it more accurately. | Zourdos et al. 2016 ([AUT repository](https://openrepository.aut.ac.nz/items/efef3b25-6701-4fb5-bb82-55fcd2a26027/full)); [Stronger by Science on RIR](https://www.strongerbyscience.com/reps-in-reserve) |
| **Rep ranges / load** | Light loads (≤60% 1RM) taken close to failure build similar muscle to heavy loads. Heavy loads build more 1RM strength. ACSM: novices 8–12RM; intermediate/advanced use 1–12RM periodized, with an emphasis on 1–6RM and 3–5 min rests for strength. | Schoenfeld et al. 2017 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/28834797/)); ACSM 2009 position stand ([PDF](https://www.sportgeneeskunde.com/wp-content/uploads/ACSM-Position-Stand-Progression-Models-in-Resistance-Training-for-Healthy-Adults.pdf)) |
| **Lengthened partials / stretch** | Training at long muscle lengths tends to grow more muscle: leg extensions in the lengthened range (Pedrosa 2022), calf raises in the lengthened range (Kassiano), and overhead vs. neutral triceps extensions (Maeo 2022). The Wolf 2023 meta-analysis favours lengthened partials, but mostly in untrained people. A 2025 trial in trained lifters found them roughly equal to full range. | (secondary) [Frontiers 2025 summary of Pedrosa/Kassiano](https://www.frontiersin.org/articles/10.3389/fpsyg.2025.1494323/full); [Biolayne](https://biolayne.com/reps/issue-34/again-lengthened-partials-appear-comparable-to-full-rom-training/); [Wolf preprint](https://sportrxiv.org/index.php/server/preprint/view/455) |
| **Rest intervals** | Small hypertrophy benefit to resting more than 60 s, and no detectable difference beyond about 90 s (Singer 2024). Strength work benefits from 3–5 min (ACSM). | Singer et al. 2024 ([Frontiers](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/text)) |
| **Deloads** | International Delphi consensus: a deload is a period of reduced training stress to reduce fatigue and improve preparedness. Coaches mostly cut volume and effort. There is no single prescribed interval. In practice, coaches deload every 4–8 weeks. | Bell et al. 2023 ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10511399/)) |
| **Sex differences** | Women gain muscle and lower-body strength at similar relative rates to men, and gain *more* relative upper-body strength (Roberts 2020). There is no basis for "lighter by default" programming. | Roberts, Nuckols & Krieger 2020 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/32218059/)); [Refalo 2025, PeerJ](https://peerj.com/articles/19042) |

### 1.2 Novice linear progression (Starting Strength / StrongLifts 5×5 / GZCLP style)

- **Structure.** Two alternating full-body barbell workouts (A/B) three times a week. Squat every session; alternate bench and press; deadlift 1×5 (Starting Strength) or 5×5 with rows (StrongLifts). Starting Strength uses 3×5, StrongLifts 5×5. ([FitnessVolt comparison](https://fitnessvolt.com/starting-strength-vs-stronglifts-5x5/), [Outlift](https://outlift.com/starting-strength-vs-stronglifts-5x5/))
- **Why it works.** Untrained lifters can recover from and adapt to a small overload within 48–72 h. Frequent practice of a few lifts builds skill and strength fast. **[background knowledge]**
- **Who it suits.** True beginners, or lifters returning after a long layoff. People with more than about 6 months of consistent training stall quickly.
- **Progression and deload.** Add 2.5 kg (5 lb) per session (deadlift 5 kg), with smaller jumps on the presses. After three failed sessions at the same weight, reset that lift by about 10% and build back up. The 10% reset is common practice, but I didn't find a primary source for StrongLifts' exact rule. Two resets means it's time for an intermediate program. There are no planned deloads.
- **GZCLP (tiered).** T1 5×3+ → 6×2+ → 10×1+ → retest a 5RM and restart at 85%; T2 3×10 → 3×8 → 3×6; T3 3×15+, adding weight when the last set reaches 25 reps. Days: squat-T1/bench-T2, press-T1/deadlift-T2, bench-T1/squat-T2, deadlift-T1/press-T2. Sources disagree on whether T1 starts at 5×3+ or 3×5+. ([Boostcamp/Cody Lefever](https://www.boostcamp.app/coaches/cody-lefever/gzcl-program-gzclp), [The Fitness Wiki archive](https://thefitness.wiki/reddit-archive/gzcl-method-novice-to-elite/))
- **Common mistakes.** Jumps that are too big; skipping food and sleep; grinding through form breakdown; running the program long after progress stops; adding lots of accessories.

### 1.3 Intermediate strength

- **Texas Method (weekly undulating).** Monday volume (5×5 at about 90% of Friday's 5RM; sources range 80–90%), Wednesday recovery (squat 2×5 at about 80% of Monday, the other press, chins/back work), Friday intensity (a new 5RM, or 2×3 / 3×2 when 5s stall). Progress is weekly rather than every session. ([Barbell Logic](https://barbell-logic.com/?p=4520), [FitnessVolt](https://fitnessvolt.com/strength-gains-texas-method/), [Starting Strength forum](https://startingstrength.com/resources/forum/general-programming/28373-volume-amount-texas-method-9.html)). Common mistakes: volume day too heavy (Friday then fails), and not resting enough.
- **5/3/1 (Wendler).** Training max (TM) = 90% of 1RM. Week 1: 65/75/85% ×5,5,5+; week 2: 70/80/90% ×3,3,3+; week 3: 75/85/95% ×5,3,1+; week 4: deload at 40/50/60%. Add 5 lb (upper) or 10 lb (lower) to the TM each cycle. Supplements: Boring But Big (5×10 at roughly 50–60% TM) and First Set Last (sets of 5 at the first-set percentage). ([Arvo](https://arvo.guru/resources/methods/wendler-531), [Lift Vault calculator](https://liftvault.com/resources/531-calculator/)). Why it works: submaximal TM, built-in AMRAP autoregulation, and slow, sustainable progression. Common mistakes: TM set too high; grinding AMRAPs; skipping deloads.
- **nSuns 5/3/1 LP.** 9-set T1 sessions ending in a 1+ AMRAP at about 95% TM, plus an 8-set T2. The AMRAP result sets next week's TM (0–1 reps: no change; 2–3: +5 lb; and so on). High volume; suits late novices with good recovery. ([The Fitness Wiki](https://thefitness.wiki/routines/nsuns-lp/), [Boostcamp](https://www.boostcamp.app/methodology/nsuns)). Not added as a template: its 17 main-lift sets per session overlap with the wave and tiered programs and are hard to fit into the logger's one-row-per-exercise model.

### 1.4 Powerlifting

- **Sheiko-style high frequency.** Competition lifts 3–4×/week at submaximal loads (most work at 70–85%, some sources say 70–80%), with 16-week cycles moving from preparatory to accumulation to heavier to peaking. Bench volume grows faster than deadlift volume. ([Powerlifting to Win review](https://powerliftingtowin.com/sheiko), [FitnessVolt](https://fitnessvolt.com/powerlifting/programs/sheiko/))
- **Block periodization.** Accumulation (volume, moderate %), then intensification (heavier, less volume), then realization/peak. **[background knowledge: Issurin; Stone et al.]**
- **RTS / RPE-based training.** Prescribe top sets by RPE and back-off sets by % or fatigue drop. Accuracy improves with experience (see Zourdos 2016 above).
- **Juggernaut-style waves.** 10s, 8s, 5s and 3s waves, each running accumulation → intensification → realization (an AMRAP that sets the next TM) → deload. Sources disagree on the exact percentages. ([Arvo](https://arvo.guru/resources/methods/juggernaut-method), [Powerlifting to Win review](https://www.powerliftingtowin.com/?p=1791))
- **Peaking and taper.** Travis et al. 2020 review: a taper of about 2 weeks or less, with volume-load cut by about 30–70% (≈50%) and intensity held. Step tapers are the most common; a survey found powerlifters cut volume 41–50% over 7–10 days. Most lifters take the last heavy deadlift 7–10 days out. ([PMC7552788](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7552788/))
- **Attempt selection.** Coaching convention, not controlled research: opener about 90–92% (a weight you could triple on a bad day), second 95–97%, third 100–103% only if the second moved well. ([PowerliftingTechnique](https://powerliftingtechnique.com/how-to-pick-attempts-for-powerlifting/), [FitnessVolt](https://fitnessvolt.com/powerlifting/guides/attempt-selection-guide/))
- **Conjugate / Westside.** Max-effort days work up to a 1–3RM on a variation that rotates every 1–3 weeks. Dynamic-effort days: box squats at 50–60% for 10–12×2 and bench at about 50% for 8–9×3, in 3-week waves. Heavy accessory volume. Critics say the template is hard to evaluate because it changes from version to version. ([Westside: max-effort day](https://www.westside-barbell.com/blogs/2004-articles/training-methods-part-2-max-effort-day), [Powerlifting to Win critique](https://www.powerliftingtowin.com/?p=1817))
- **Common mistakes.** Testing maxes too often; tapering too long (strength detrains) or too little; openers that are too heavy; specialization blocks that let the other lifts fall too far behind.

### 1.5 Hypertrophy programs

- **PHUL** (Brandon Campbell): upper/lower power days (3–5 reps) plus upper/lower hypertrophy days (8–15 reps); 4 days; each muscle twice a week. Suits intermediates. ([Boostcamp](https://www.boostcamp.app/coaches/brandon-campbell/phul-4-day-split), [Hevy](https://www.hevyapp.com/phul-power-hypertrophy-upper-lower/))
- **PHAT** (Layne Norton): 2 power days and 3 hypertrophy days that open with speed sets at about 65–70% of the power-day weights; 5 days; high volume. ([Biolayne](https://biolayne.com/articles/training/phat-power-hypertrophy-adaptive-training/), [StrengthLog](https://www.strengthlog.com/phat-workout-routine/))
- **Reddit PPL** (u/metallicadpa): 6 days (PPL-PPL-rest). The main lift each day is 4×5 or 5×5 with a last-set AMRAP (deadlift 1×5+) and linear progression, then 8–12 rep accessories. Designed for beginners who want more upper-body volume. ([Fitness Wiki archive](https://thefitness.wiki/reddit-archive/a-linear-progression-based-ppl-program-for-beginners/), [Lift Vault](https://liftvault.com/programs/strength/metallicadpa-ppl-template/))
- **Upper/lower and full-body.** Both meet the "2+ times a week, 10–20 hard sets" target efficiently. Full-body suits beginners and busy people; upper/lower suits 4-day schedules.
- **Bro splits** (one body part a day): weekly volume can still be adequate, but frequency is once a week. That's fine for hypertrophy when volume is equated, but each session's volume gets very high. Already offered as a "Build my program" goal.
- **Common mistakes.** Too much junk volume far from failure; never adding load; no deloads; neglecting lengthened-position work for hamstrings, triceps and calves; pushing far more than pulling.

### 1.6 Bodybuilding contest prep

- Lose about **0.5–1% of body weight per week** to protect muscle; protein about 2.3–3.1 g/kg of lean mass; fat 15–30% of calories. Dehydration "can be dangerous and may not improve appearance." (Helms, Aragon & Fitschen 2014, [PMC4033492](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/))
- **Training in a deficit.** Keep the heavy loads that signal muscle retention, hold volume moderately, and expect strength to dip late in prep. Cardio and steps rise gradually. **[background knowledge: Helms et al. 2014 training companion paper]**
- **Peak week.** Carbohydrate, water and sodium manipulation are common, but the evidence behind many of these practices is thin and individual responses vary widely (Escalante et al. 2021, [PMC8201693](https://pmc.ncbi.nlm.nih.gov/articles/PMC8201693)). The app defers peak week to a qualified coach and never prescribes water or sodium manipulation.

### 1.7 Strongman and powerbuilding

- **Strongman.** In a 167-competitor survey, 80% periodize their training, and the farmer's walk, log press and stones are the most-trained events (Winwood, Keogh & Harris 2011, [AUT repository](https://openrepository.aut.ac.nz/handle/10292/1227)); strongman athletes also taper before contests ([PMC5686420](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5686420/)). A typical week has a max-effort overhead day (log/axle), a max-effort deadlift day (often an above-knee or 18-inch pull), a squat/volume day and 1–2 event days with moving events written as distance and target time. Contest prep rehearses contest weights 2–3 weeks out and uses only light openers in contest week. **[structure partly background knowledge]**
- **Powerbuilding.** Heavy compound work at 3–6 reps plus bodybuilding volume at 8–20 reps (as in PHUL and PHAT). It works because strength and hypertrophy respond to different doses of load and proximity to failure, so one week can serve both.

### 1.8 MMA and combat sports S&C

- **Energy systems.** MMA taxes all three energy systems, and its longer rounds lean more on aerobic capacity than most combat sports. Fighters also need anaerobic capacity and buffering for flurries. Block and undulating periodization can be combined across a camp. ([Lahti 2016 thesis, Univ. Jyväskylä](https://jyx.jyu.fi/handle/123456789/49013))
- **Concurrent training.** Schumann 2022 (43 studies): concurrent aerobic and strength training doesn't blunt maximal strength or hypertrophy, but it does blunt explosive strength (ES −0.28). Wilson 2012 found more interference from running than from cycling, and from more frequent and longer endurance sessions. Practical rules: separate sessions by 6 h or more, put lifting after skills work, use cycling for conditioning when possible, and keep lifting submaximal. ([Schumann 2022, JCU](https://researchonline.jcu.edu.au/71546/); [Wilson 2012 summary, PMC5407958](https://pmc.ncbi.nlm.nih.gov/articles/PMC5407958))
- **Neck and injury prevention.** In 6,662 high-school athletes, greater neck strength predicted lower concussion odds (about 5% lower per pound of strength). This is observational and doesn't prove that neck training prevents concussion. (Collins 2014, [Springer](https://www.springermedicine.com/neck-strength-a-protective-factor-reducing-risk-for-concussion-i/21683656)). Copenhagen planks for groin injuries and Nordic curls for hamstrings: see 1.10.
- **Fight-camp periodization.** General prep (strength base, aerobic power) → specific prep (max strength, fight-pace rounds, glycolytic intervals) → peak (power, fight simulation) → fight-week taper. Alactic sprints at a 1:8+ work-to-rest ratio. Never schedule glycolytic work next to hard sparring. **[structure: background knowledge, consistent with the thesis above]**

### 1.9 General fitness, women's strength and active aging

- **WHO 2020.** All adults: 150–300 min of moderate (or 75–150 min of vigorous) aerobic activity per week, plus muscle strengthening for all major muscle groups on 2 or more days. Adults 65+: multicomponent balance and strength work on 3 or more days to prevent falls. ([PMC7719906](https://pmc.ncbi.nlm.nih.gov/articles/7719906/), [University of Sydney summary](https://www.sydney.edu.au/news-opinion/news/2020/11/26/new-global-guidelines-on-physical-activity-and-sedentary-behavio.html))
- **ACSM progression models.** Novices 8–12RM, 2–3 days a week; progress by load, then volume. ([ACSM 2009 PDF](https://www.sportgeneeskunde.com/wp-content/uploads/ACSM-Position-Stand-Progression-Models-in-Resistance-Training-for-Healthy-Adults.pdf); ACSM has since published an update: [news](https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/))
- **Older adults lifting heavy.** LIFTMOR (Watson 2018): 8 months of supervised 5×5 at >85% 1RM, twice weekly, improved spine and hip bone density in postmenopausal women with low bone mass, with no fractures. It shows that supervised, progressive heavy lifting can be safe for this group. ([JBMR](https://academic.oup.com/jbmr/article/33/2/211/7605709))
- **Women's strength.** See Roberts 2020 above. Glute-focused programs are popular. Lengthened-position hip work and abduction for the upper glutes are reasonable choices. **[background knowledge]**

### 1.10 Running, speed, agility and mobility

- **Couch-to-5K style.** 9 weeks, 3 runs a week. Week 1 alternates 60 s jogging with 90 s walking for 20 minutes, then each week builds. Many beginners repeat a week, and most early quitting comes from doing too much too soon. ([BDA](https://bda.org.uk/what-is-couch-to-5k/), [Redditch BC](https://www.redditchbc.gov.uk/things-to-do/active-redditch/health-and-exercise/couch-to-5k)). I found no evidence base for the "10% rule".
- **80/20 (polarized) training.** Successful endurance athletes do about 80% of sessions at low intensity and a small share very hard (Seiler). It's widely used but still debated, and isn't proven superior in every context. ([Fast Talk Labs](https://www.fasttalklabs.com/pathways/polarized-training/); Seiler 2010 **[background knowledge]**)
- **Sprint and change-of-direction work.** Sprint phases are acceleration, max velocity and deceleration (Haugen et al. 2019, *Sports Med Open*). Short maximal sprints need long recoveries (about 1:10 work:rest for efforts under 6 s) so quality holds. ([JSSM](https://www.jssm.org/jssm-23-475.xml-abst)). Train fresh, and stop when reps slow. Reactive (decision-making) agility is distinct from planned change of direction. **[background knowledge]**
- **Nordic hamstring curls.** Van Dyk 2019 (15 studies, 8,459 athletes): programs that include Nordic curls cut hamstring injuries by up to about 51%. A later reappraisal calls the effect inconclusive. ([BJSM](https://bjsm.bmj.com/content/53/21/1362), [reappraisal summary](https://physio-network.com/research-reviews/thigh/why-methods-matter-in-a-meta-analysis-a-reappraisal-showed-inconclusive-injury-preventive-effect-of-nordic-hamstring-exercise))
- **Mobility.** Range of motion improves with regular, longer holds and practice. Mobility work causes little fatigue. **[background knowledge]**

---

## 2. Audit: what was wrong (before)

Method: `scripts/audit-programs.ts` (library) and `scripts/audit-custom-programs.ts` (builder: every type × goal × days for an intermediate lifter with a full gym). "Est." uses the session-length model in `session-time.ts`.

### 2.1 Cross-cutting problems found

1. **Progression text didn't match what the app actually prescribed.** Generic expansion only changed RPE (`linear_rpe`), alternated sets up and down (`volume_wave`: 3, 4, 3, 4), or did nothing (`steady`). Meanwhile the descriptions promised other things: "week 4 drops volume" (powerlifting base block), "add 5 min of cardio every other week" (Lean & Conditioned, show prep), "add one sprint rep a week" (speed, agility), "plyo contacts increase" (athletic power).
2. **Density progression applied to strength work and all-out sprints.** In MMA, functional and grappling programs, rest on heavy trap-bar deadlifts and front squats fell by 30 s and a set was added. The 8 s/90 s alactic bike sprints went to 8 s/60 s, breaking the 1:8+ work-to-rest ratio their own note requires.
3. **RPE could climb to 9.5 on multi-set work** (for example bench 5×3 at RPE 9.5 by week 5) while the intensity text stayed "~80–85% 1RM".
4. **Stated session minutes were inflated.** Many sessions were stated 20–35 min longer than the prescription. For example, the powerlifting base block squat day was stated at 75 min against about 38 min of work, and deload days still claimed full-length sessions.
5. **No free program in 5 of 7 disciplines.** Strength, strongman, physique, combat and speed & agility had nothing free.
6. **The library was missing the most proven templates.** There was no Texas-Method-style, 5/3/1-style, GZCL-style, PHUL/PHAT, PPL, full-body hypertrophy, conjugate, peaking block, strongman event program, fight camp, half-marathon, or heavier 50+ program. The library was also sorted alphabetically rather than beginner → advanced.

### 2.2 Per-program audit (before → after)

Sets are weekly fractional hard sets in the first loading week: chest/back/delts/quads/glutes+hams.

| Program | Before: problems | After |
|---|---|---|
| `foundations-full-body` (free) | Stated 45 min against ~31 min of work; delts 3 sets; deload kept the full-length stated time. | Band pull-aparts added (delts 5); 40 min stated; deload states a shorter session; ACSM/WHO framing in the description. |
| `home-bodyweight-strength` (free) | Sawtooth set changes (+1 set in weeks 2 and 4, then back down); no deload or reason. | Weeks 3–4 add a set; reason given for no deload (short block at RPE ≤ 7.5); minutes fixed. |
| `barbell-strength-foundations` | Called "Linear Progression" but was 3 fixed days (A, B, C) with RPE rising 7 → 9; the bench was trained twice and the press once every week; Plus tier. | Now **Novice Linear Progression: 3×5** (in the style of Starting Strength/StrongLifts): A/B alternation (A-B-A, then B-A-B), squat every session, per-session weight-jump rules, 10% reset after 3 stalls; **free**; 12 weeks; ~45 min. |
| `womens-strength-progression` | RPE could reach 9.5; no direct delt work; 55 min stated vs ~40. | Lateral raises added; RPE capped at 9; 50 min stated; description cites sex-difference research. |
| `powerlifting-base-block` | Generic RPE climb only; "week 4 drops volume" was never implemented; deadlift intensity text static; 75 min stated vs ~40. | Explicit 8-week percentage block: sets of 4–5 at 72.5–77.5% → deload → triples at 80–85% → deload/re-test; RPE alongside every %. |
| `bench-press-specialist` | Push:pull 22:14; RPE up to 9.5 on 5×3; % text didn't change as RPE rose. | Extra rows (push:pull 22:15 in a bench specialization); RPE capped at 9; %-of-1RM moved into notes as a guide. |
| `squat-specialist`, `deadlift-specialist` | RPE up to 9.5; minutes inflated. | RPE capped at 9; minutes recomputed. Content otherwise sound: squat 3×/wk, quads 21 sets; heavy deadlift once a week plus a variation. |
| `strongman-foundations` | No horizontal pressing; minutes inflated; Plus tier. | DB bench added; **free** (the strongman discipline's free option); beginner difficulty; RPE capped. |
| `athletic-power-development` | Progression text claimed plyo contacts increase, but nothing changed. | Text matches the evidence (constant low contacts, quality first); RPE capped; minutes fixed. |
| `mma-fight-conditioning` | Density shortened rest and added sets on trap-bar deadlifts and alactic sprints (8 s/60 s). | Density now applies only to timed conditioning over 10 s; deadlift rest/sets and the 8 s/90 s sprints stay fixed (unit-tested). |
| `boxing-round-ready`, `functional-engine` | Same density problem on strength sets; minutes inflated. | Fixed by the expansion change; functional couplet made timed so it progresses as conditioning. |
| `grappling-mat-endurance` | Push:pull 0:7 (no pressing for frames/posts); no neck work. | Landmine press and push-ups added, plus neck isometrics; push:pull 6:7. |
| `lean-and-conditioned` | Text said "+5 min cardio every other week"; nothing changed. | Explicit weeks: steady cardio 30 → 40 min, intervals 6 → 9, strength 3 → 4 sets, week 6 lighter. |
| `active-aging-low-impact` (free) | Sawtooth sets; only 20 min of walking; no WHO context or power cue. | 25 min walk, WHO 150–300 min + 3×/week balance guidance, "stand up briskly" power cue, reason given for no deload. |
| `daily-mobility-flow` (free) | Text promised longer holds; nothing changed. | Holds grow 5 s per week. |
| `recovery-deload-week`, `combat-conditioning-sessions`, `athletic-qualities-sessions` | Session libraries presented as weekly schedules (6 days per week). | Summaries say "pick 1–2 a week"; marked as exceptions with a reason. |
| `hypertrophy-upper-lower` | Sawtooth sets; biceps 3 sets; chest 10; progression text didn't match. | Two 3-week waves with deloads (weeks 4 and 8): +1 then +2 sets on key lifts, RIR 3 → 1; lengthened curls, overhead extensions and seated curls; chest 11, back 13, delts 9.5, quads 11, glutes/hams 17.5. |
| `physique-show-prep` | Chest and back only 10 sets each for an advanced competitor; cardio progression never implemented; 12 weeks without a lighter week. | Machine press and straight-arm pulldowns added (chest 11, back 11 → peak), LISS 20 → 35 min and posing 10 → 20 min built into each week, lighter week 7, taper week 12, 0.5–1%/week rate-of-loss guidance; same no-water/sodium-manipulation stance. |
| `speed-development` | "Add a rep or 5 m a week" not implemented. | Accelerations 5 → 8 reps and 10 → 30 m, flying sprints 3 → 5, Nordic curls, week 6 deload + test. |
| `agility-footwork` | Same mismatch; Plus tier. | Cone-drill reps 4 → 6, Copenhagen planks, week 6 test; **free** (the speed & agility discipline's free option). |
| `aerobic-base-run-walk` (free) | Only 2 runs a week (the middle session was a walk), unlike the 3 runs a week in couch-to-5K plans. | Renamed **First 5K: Run/Walk to 30 Minutes**; 3 run sessions a week starting at 60 s/90 s × 8, ending with 30 min continuous. |

### 2.3 "Build my program" audit

| Type / goal | Finding | Fix |
|---|---|---|
| bench (all goals) | Push:pull up to 19:12 | Vertical pull added to the heavy bench day (19:15); regression test. |
| show_prep (4 days, 75 min) | Late-prep sessions estimated at 94–98 min because cardio and posing couldn't fit | Surplus LISS moves to "a separate walk later in the day" so stated session length stays honest; regression test. |
| cardio / endurance (3–4 days) | No strength work at all | The description now recommends two short strength sessions (running economy and resilience). |
| strength / powerlifting / specialization | Within evidence: each main lift 1–3×/week, deload every 4–5 weeks, peaks are ≤2-week tapers with intensity held. Peaking 8-week blocks have 6 loading weeks before the peak and test weeks. | No change (documented). |
| mma, strongman, bodybuilding, speed, agility | Already tested for ≤3 S&C days, alactic/glycolytic work, neck, moving events by distance, 10–20 sets per muscle, etc. | No change. |
| All types | Session-time check with the new estimator: no generated session exceeded the requested length by more than 25% after the show-prep fix. | — |

---

## 3. After: new templates and library organisation

16 new programs (41 total, 24 categories; the new category is **Powerbuilding**, under Strength & Powerlifting). Names are generic; descriptions credit each method's origin.

| Program (slug) | Discipline | Tier | Level | Weeks × days | Key progression / deload |
|---|---|---|---|---|---|
| Tiered Strength: Heavy, Volume & Pump (`tiered-strength-program`) — GZCLP style | Strength | Plus | Beginner | 12 × 4 | T1 5×3+ → 6×2 → 10×1; T2 3×10 → 3×8 → 3×6; T3 add weight at 25 reps; deloads weeks 6 and 12 |
| Weekly Undulating Strength (`intermediate-weekly-undulating`) — Texas Method style | Strength | Plus | Intermediate | 8 × 3 | Volume 5×5 at 90% of intensity day; light day at 80%; weekly 5RM records, then 2×3 and 3×2; deloads weeks 4 and 8 |
| 4-Week Wave Strength: Training-Max Method (`wave-strength-training-max`) — 5/3/1 style | Strength | Plus | Intermediate | 8 × 4 | 65/75/85, 70/80/90, 75/85/95% TM with AMRAP last set; 40/50/60% deload; cycle 1 opposite-lift 5×10 (BBB variant), cycle 2 FSL 5×5; TM +2.5/5 kg per cycle |
| Powerbuilding 4-Day (`powerbuilding-4-day`) | Strength (Powerbuilding) | Plus | Intermediate | 8 × 4 | Two 3-week waves (+1/+2 sets, RIR 3 → 1), deloads weeks 4 and 8 |
| Conjugate 4-Day (`conjugate-4-day`) | Strength | Plus | Advanced | 8 × 4 | ME variation rotates every 2 weeks; DE squat 50/55/60%, DE bench 50/52.5/55% waves; deloads weeks 4 and 8 |
| 12-Week Powerlifting Peak (`powerlifting-peaking-12-week`) | Strength | Plus | Advanced | 12 × 4 | weeks 1–4 at 70 → 77.5% → deload → weeks 6–9 triples at 80 → 87.5% → peak singles at 92.5% → taper (volume −50%, opener at 90%) → meet day 90–92/95–97/100–103% |
| Strongman 4-Day: Statics & Events (`strongman-4-day-events`) | Strongman | Plus | Intermediate | 8 × 4 | Statics: triples then doubles/singles; events 20 m by target time, add load when every run beats it; deloads weeks 4 and 8 |
| Full-Body Hypertrophy: 3 Days (`full-body-hypertrophy-3-day`) | Physique | **Free** | Beginner | 6 × 3 | 5 loading weeks (+1/+2 sets, RIR 3 → 1) + deload |
| Glutes & Strength: 4-Day Upper/Lower (`womens-glute-strength`) | Strength (Women's) | Plus | Beginner | 6 × 4 | Same block; glutes/hams ~21 sets, upper body at productive maintenance |
| Power & Hypertrophy Upper/Lower (`power-hypertrophy-upper-lower`) — PHUL style | Physique | Plus | Intermediate | 6 × 4 | Same block |
| Push / Pull / Legs: 6 Days (`push-pull-legs-6-day`) — Reddit PPL style | Physique | Plus | Intermediate | 6 × 6 | Main lift 5+ AMRAP linear progression; accessories double progression; deload week 6 |
| Power-Hypertrophy 5-Day (`power-hypertrophy-5-day`) — PHAT style | Physique | Plus | Advanced | 6 × 5 | Power days + speed sets at 65–70% + hypertrophy volume |
| Off-Camp Strength for Fighters (`mma-off-camp-2-day`) | Combat | **Free** | Beginner | 8 × 2 | Sets of 5 → heavier triples; neck, Nordic, Copenhagen; deloads weeks 4 and 8 |
| MMA Fight Camp: 8 Weeks (`mma-fight-camp-3-day`) | Combat | Plus | Intermediate | 8 × 3 | GPP → SPP → peak (5×5-min fight simulation) → fight week (< half the volume, no glycolytic work) |
| Half Marathon: 80/20 Base to Race (`half-marathon-base-80-20`) | Endurance | Plus | Intermediate | 12 × 4 | Long run 60 → 105 min; hills → threshold → race pace; cutbacks weeks 4 and 8; race in week 12; hard running ≤ 25% of weekly time |
| Strong for Life: 2-Day Strength (50+) (`active-aging-strength-2-day`) | General | Plus | Beginner | 8 × 2 | 10–12 reps → 6–8 reps at 2–3 RIR (LIFTMOR-informed); lighter weeks 4 and 8 |

**Free programs per discipline (11 total).** Strength: Novice LP. Strongman: Strongman Foundations. Physique: Full-Body Hypertrophy. Combat: Off-Camp Strength. Endurance: First 5K. Speed & Agility: Agility & Footwork. General: Foundations, Home Strength, Active Aging, Daily Mobility, Recovery Week.

**Ordering.** `compareLibraryPrograms` (`src/lib/domain/disciplines.ts`) sorts each discipline beginner → intermediate → advanced, then by category order, then by name. The Train page uses it.

**Exercises added.** `hip-abduction` and `back-extension`. All existing slugs are unchanged.

### 3.1 After: weekly sets per major muscle (week 1)

Chest/back/delts/quads/glutes+hams fractional hard sets; push:pull = horizontal + vertical pushing vs. pulling sets.

| Program | Tier | Level | Weeks × days | Min | Deload weeks | Sets C/B/D/Q/GH | Push:pull |
|---|---|---|---|---|---|---|---|
| `foundations-full-body` | free | beginner | 6×3 | 40 | 6 | 6/10/5/8/9 | 9:11 |
| `home-bodyweight-strength` | free | beginner | 4×3 | 35 | — (reason given) | 4/5/5/10/8 | 7:6 |
| `active-aging-low-impact` | free | beginner | 6×3 | 40 | — (reason given) | 3/3/0/6/6 | 3:3 |
| `active-aging-strength-2-day` | plus | beginner | 8×2 | 30 | 4, 8 | 2/3/4/4/4 | 4:4 |
| `daily-mobility-flow` | free | beginner | 4×4 | 15 | — (reason given) | — | — |
| `recovery-deload-week` | free | beginner | 1×3 | 25 | (whole week) | 2/2/0/2/3 | 2:2 |
| `barbell-strength-foundations` | free | beginner | 12×3 | 45 | — (stall resets) | 6/9/3/9/8.5 | 9:9 |
| `tiered-strength-program` | plus | beginner | 12×4 | 40 | 6, 12 | 8/12/8/8/12 | 16:12 |
| `womens-strength-progression` | plus | beginner | 8×3 | 50 | 8 | 6/9/5/14/13 | 9:9 |
| `intermediate-weekly-undulating` | plus | intermediate | 8×3 | 40 | 4, 8 | 6/6/3/8/8 | 9:6 |
| `wave-strength-training-max` | plus | intermediate | 8×4 | 55 | 4, 8 | 11/11.5/14/11/16.5 | 19:13 |
| `powerbuilding-4-day` | plus | intermediate | 8×4 | 55 | 4, 8 | 9/14/9.5/13/17 | 10:15 |
| `powerlifting-base-block` | plus | intermediate | 8×4 | 50 | 4, 8 | 10/11.5/7.5/10/12 | 15:13 |
| `bench-press-specialist` | plus | intermediate | 8×4 | 50 | 8 | 16/13.5/9/5/5.5 | 22:15 |
| `squat-specialist` | plus | intermediate | 8×4 | 45 | 8 | 3/6/3/21/18 | 6:6 |
| `deadlift-specialist` | plus | intermediate | 8×3 | 50 | 8 | 4/8.5/6/4/15 | 7:10 |
| `conjugate-4-day` | plus | advanced | 8×4 | 50 | 4, 8 | 4.5/12.5/6/4.5/14.5 (speed sets excluded) | 15:14 |
| `powerlifting-peaking-12-week` | plus | advanced | 12×4 | 50 | 5, 12 | 11/10/5/7/12.5 | 14:11 |
| `strongman-foundations` | free | beginner | 6×3 | 55 | 6 | 2/7/5/4/17 | 5:5 |
| `strongman-4-day-events` | plus | intermediate | 8×4 | 55 | 4, 8 | 1.5/10/12/7/18.5 | 12:10 |
| `full-body-hypertrophy-3-day` | free | beginner | 6×3 | 45 | 6 | 8/9/8.5/9/12.5 | 11:9 |
| `womens-glute-strength` | plus | beginner | 6×4 | 45 | 6 | 6/13/7/9/21.5 | 9:14 |
| `hypertrophy-upper-lower` | plus | intermediate | 8×4 | 55 | 4, 8 | 11/13/9.5/11/17.5 | 12:14 |
| `power-hypertrophy-upper-lower` | plus | intermediate | 6×4 | 55 | 6 | 10/14/11.5/16/15.5 | 10:15 |
| `push-pull-legs-6-day` | plus | intermediate | 6×6 | 45 | 6 | 11/16.5/19/11/16.5 | 16:18 |
| `power-hypertrophy-5-day` | plus | advanced | 6×5 | 50 | 6 | 10/14/11.5/11/11.5 (speed sets excluded) | 19:19 |
| `physique-show-prep` | plus | advanced | 12×5 | 65 | 7, 12 | 11/11/14.5/13/12.5 | 12:9 |
| `mma-off-camp-2-day` | free | beginner | 8×2 | 35 | 4, 8 | 3/6/0/6/5 | 3:6 |
| `boxing-round-ready` | plus | beginner | 4×3 | 45 | 4 | 3/4.5/6/3/1.5 | 6:6 |
| `grappling-mat-endurance` | plus | intermediate | 4×3 | 45 | 4 | 4.5/9/3/3/5.5 | 6:7 |
| `mma-fight-conditioning` | plus | intermediate | 6×3 | 50 | 6 | 1.5/4/3/4/2 | 3:4 |
| `mma-fight-camp-3-day` | plus | intermediate | 8×3 | 40 | 8 (fight week) | 1.5/6/3/6/3 | 3:6 |
| `combat-conditioning-sessions` | plus | intermediate | 1×6 | 45 | — (pick-list) | — | — |
| `aerobic-base-run-walk` | free | beginner | 8×3 | 30 | — (reason given) | — | — |
| `lean-and-conditioned` | plus | beginner | 6×4 | 40 | 6 | 3/6/3/9/9.5 | 6:6 |
| `functional-engine` | plus | intermediate | 4×4 | 50 | 4 | 0/4/0/9/8.5 | 0:4 (push press counted as power) |
| `half-marathon-base-80-20` | plus | intermediate | 12×4 | 55 | 4, 8, 12 | — | — |
| `agility-footwork` | free | beginner | 6×3 | 35 | 6 | 0/0/0/9/7.5 | — |
| `speed-development` | plus | intermediate | 6×3 | 45 | 6 | 0/0/0/4/10 | — |
| `athletic-power-development` | plus | intermediate | 6×3 | 50 | 6 | 1.5/4/3/10/8 | 3:4 |
| `athletic-qualities-sessions` | plus | intermediate | 1×4 | 40 | — (pick-list) | 1.5/3/3/7/6.5 | 3:3 |

Strength, sport and conditioning programs are intentionally below hypertrophy volumes. The 6–24 sets-per-muscle bound and the push:pull ≤ 1.6:1 bound are enforced only for hypertrophy, show-prep, powerbuilding and glute programs.

### 3.2 Engine changes

- `program-expansion.ts`: `volume_wave` now adds a set in the second half of the block instead of alternating up and down. `density` only progresses timed conditioning over 10 s (strength and alactic work are untouched). Multi-set RPE is capped at 9. Stated minutes now track set changes, so deloads state shorter sessions.
- `ProgramSeed.noDeloadReason`: any program of 4+ weeks without a deload must say why.
- Seeds and `supabase/setup-all.sql` were regenerated (`npm run seed:generate`, `npm run db:bundle`).

### 3.3 Tests

- `tests/unit/program-library.test.ts` (27 tests). Every slug exists and legacy slugs are kept. Weeks match `weeks`. Database limits (reps ≤ 20 chars, intensity ≤ 60, notes ≤ 500, no duplicate exercise in a day, 5–240 min). Sets 1–10, RPE 4–9.5 on multi-set work. Every program has a deload/taper or a stated reason, with no more than 7 hard weeks in a row, and deloads are lighter. Stated minutes are within 15% (or 5 min) of the estimate. Hypertrophy programs have 6–24 sets per major muscle, at least 3 muscles at 9+, and push:pull ≤ 1.6. There is a free program per discipline, beginner-first ordering, and no trademarked names. Template specifics: TM waves 65/75/85 · 70/80/90 · 75/85/95 + 40/50/60 deload; GZCL tiers; Texas-style days; peak taper ≥ 40% with intensity ≥ 90% and meet attempts; conjugate rotation and DE waves; hypertrophy volume and RIR rise; PPL days; strongman distance/time events; fight-camp 1:8 alactic ratio and fight-week cut; density not touching strength; 80/20 hard share ≤ 25%; first-5K structure; speed/agility progression; show-prep conditioning and posing; active aging; plus the two builder fixes.
- `tests/unit/catalog.test.ts` was updated for 24 categories, the RPE cap and the A/B novice alternation.
- `e2e/program-library.spec.ts`: beginner-first ordering, the free program in each discipline can be started, the novice week-2 B/A order, and a locked → unlocked training-max program showing its percentages and deload.

## 4. What is not verified

- **No coach review.** Prescriptions follow the cited research and well-known templates but have not been checked by a certified strength coach, physio or registered dietitian.
- Several sources are secondary summaries or practitioner/app pages (template percentages, Sheiko structure, RP landmarks, attempt selection). The volume, frequency, failure, taper and contest-prep numbers come from abstracts or reviews, not full-text appraisal.
- Session lengths are model estimates (work + rest + set-up + 3 min of ramp-up per heavy lift + warm-up/cool-down). Real sessions vary with gym traffic and warm-up habits.
- Not run with real users. The offline phone edition (`standalone/index.html`) still embeds the previous library; it was outside this task's scope.

---

## 5. Stage 2B: categories that were missing or thin

The library was re-sorted into SPEC §5's 13 browse categories (`src/lib/domain/program-catalog.ts`). Programs were added only where a category was **Missing** or **Partial**: calisthenics (0 programs), home/dumbbell/band (1), functional/circuits (1, plus the circuit-based Lean & Conditioned), endurance and hybrid (no hybrid), and active aging (no seated program). The other categories were left alone. This pass had no web access, so every source below is **[background knowledge]**: well-known public methods and guidelines I did not re-fetch. Nothing here has been reviewed by a qualified coach.

| Program (slug) | Category | Based on | Key choices | Sources |
|---|---|---|---|---|
| Calisthenics Foundations (`calisthenics-foundations`) | Calisthenics | The r/bodyweightfitness Recommended Routine: paired pull/push, squat/hinge and core progressions, 3 sessions a week, double progression up a ladder of variations | 3 × 5–8/5–12 on band-assisted pull-ups, push-ups, split squats; A/B alternation; deloads weeks 4 and 8 | r/bodyweightfitness Recommended Routine (wiki); ACSM 2009 progression models **[background knowledge]** |
| Calisthenics Strength: Upper / Lower (`calisthenics-strength-upper-lower`) | Calisthenics | Upper/lower split for trainees with strict pull-ups and dips; add load (backpack) at the top of 5–8 reps, as in weighted-calisthenics practice | 4 × 5–8 pull-ups/chin-ups/dips, Nordic curls (eccentric hamstring work), Copenhagen planks | ACSM 2009; van der Horst et al. 2015 (Nordic hamstring programme) **[background knowledge]** |
| Dumbbell Home Strength (`dumbbell-home-strength`) | Home | Full-body A/B/C with dumbbells only, sets 1–3 reps short of failure | 3 × 8–12 per pattern, double progression; deload final week | Schoenfeld et al. 2017 (light loads near failure build similar muscle); ACSM 2009 **[background knowledge]** |
| Bands & Bodyweight Total Body (`band-bodyweight-total-body`) | Home | Band pulling/isolation plus bodyweight pressing and legs | 3 sessions × ~30–35 min; reps → heavier band → harder variation | Lopes et al. 2019 (elastic bands produce strength gains similar to conventional equipment) **[background knowledge]** |
| Kettlebell & Bodyweight Circuits (`kettlebell-circuit-intervals`) | Functional | EMOM strength blocks and 40:20 work:rest intervals | Density progression: more rounds or less rest on timed work only; strength sets keep full rest | ACSM HIIT guidance; Gibala et al. (low-volume interval training) **[background knowledge]** |
| Hybrid: Strength & 5K–10K Running (`hybrid-strength-and-run`) | Endurance & hybrid | Concurrent training with the interference effect managed: moderate strength volume, ~80% easy running, hard intervals two days from heavy legs | Mon heavy legs, Tue easy run, Thu intervals, Fri upper emphasis, Sat long easy run; deloads weeks 4 and 8 | Hickson 1980; Wilson et al. 2012 meta-analysis (interference mostly from high-frequency, long cardio); Seiler (80/20 intensity distribution) **[background knowledge]** |
| Seated Strength & Mobility (`seated-strength-mobility`) | Active aging | Chair-based exercise for adults who can't or prefer not to stand: sit-to-stand power, seated presses, band rows | 3 × ~30 min, RPE ≈ 6, volume wave; flagged for specialist review | WHO 2020 physical-activity guidelines (older adults); chair-based exercise reviews (e.g. Sexton et al. 2023) **[background knowledge]** |

**Near-duplicates (5.30).** `programSimilarity` in `src/lib/domain/program-audit.ts` compares first-week prescriptions (exercise, sets and reps/time), discounted unless days per week and level also match. Every pair in the library scores below 0.5; the highest is 0.28 (Powerbuilding 4-Day vs Hypertrophy Upper/Lower). `tests/unit/program-catalog.test.ts` enforces it, and a renamed copy scores 1.0.

**Specialist review (5.31).** `needsSpecialistReview` (and `training_programs.needs_specialist_review`) marks show prep, meet prep (the 12-week peak and built meet-prep programs), every combat program and the three active-aging programs. The app shows "Not yet reviewed by a qualified coach"; nothing claims a review happened.

**Session length (4.15, 4.16).** The builder, the onboarding starter and the library now all use `estimateSessionMinutes` (work, rest, about a minute per exercise for set-up and transitions, ramp-up sets before heavy lifts, warm-up and cool-down). `fitSessionToMinutes` trims accessory sets first, then long easy cardio, then whole accessories, then main-lift sets. Competition days (meet day, contest day) are exempt and labelled honestly.

**Combined goals (4.17).** `src/lib/domain/combined-goals.ts` places strength days and run days (taken from the first-5K or endurance builder) on weekdays so a hard run is never on, or the day before or after, a heavy leg day, and heavy leg days are never back to back. When that's impossible (e.g. three heavy full-body days plus intervals), the lightest heavy day is capped at RPE 7 with a note.
