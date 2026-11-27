-- Program library clean-up (docs/programs/PROGRAM_LIBRARY_AUDIT.md), 2026-11-14.
--
-- Text only: 44 curated programs get a clearer name and/or a one-line "who it's for" summary, matching the catalog
-- source (src/data) and the regenerated supabase/seed.sql, so existing databases agree with new ones without having
-- to re-run the seed. Slugs, ids, weeks, days, exercises, tiers and is_published are NOT touched: every member's
-- enrollment (user_programs), logged workout (workout_sessions.program_day_id), calendar move
-- (planned_session_overrides) and training adjustment keeps pointing at the same rows, and renamed programs show
-- their new name everywhere they are listed.
--
-- The 4-week/8-week mismatch: "4-Week Wave Strength: Training-Max Method" is stored, seeded and written as 8 weeks
-- (two 4-week waves: weeks 1-4 with 5 x 10 volume work, weeks 5-8 with 5 x 5 "first set last", each ending in a
-- deload). The content is right; the name was wrong. It becomes "Wave Strength: Training-Max Method" and keeps
-- duration_weeks = 8, so nobody part-way through loses weeks 5-8.
--
-- Retired programs (10, listed in src/data/program-retirements.ts) are deliberately not changed here. They stay
-- is_published = true: training_programs_read, can_view_program, program_of_week/program_of_day and
-- check_member_reference all require a published (or own) program, so unpublishing would hide an enrolled member's
-- plan, weeks and days and block logging workouts against them. The app leaves them out of browsing instead.
--
-- Idempotent (plain updates by slug); safe to run before or after the seed.
--
-- ROLLBACK (restores the previous names and summaries; nothing else changed):
--   update public.training_programs set name = '4-Week Wave Strength: Training-Max Method', summary = 'One main lift a day in 4-week waves of 65–95% of a training max, with 5×10 or 5×5 supplemental work and a deload every fourth week.' where slug = 'wave-strength-training-max' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Twelve weeks of 4-day upper/lower training in three waves — accumulate, intensify, realize — from a training max, ending with a top-set test.' where slug = 'intermediate-strength-builder-upper-lower' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three days a week — a volume day, a recovery day and a heavy day — with weekly records instead of session-to-session jumps.' where slug = 'intermediate-weekly-undulating' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Alternate two short barbell workouts three times a week and add weight every session.' where slug = 'barbell-strength-foundations' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Eight weeks of three full-body barbell sessions: learn the squat, bench, deadlift, press, rows and chin-ups, then test a new 5-rep best.' where slug = 'beginner-strength-foundations-8-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'A full-body strength plan that progresses load — not just reps — three days a week.' where slug = 'womens-strength-progression' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Two glute-focused lower days and two upper days — heavy hip thrusts and squats plus real upper-body strength.' where slug = 'womens-glute-strength' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Ten weeks, two lower-body days and two upper days a week: glutes, hamstrings and quads get most of the volume and build through two blocks, with a 3-day option.' where slug = 'lower-body-glute-development' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'A calm four-week introduction to a commercial gym: machines and dumbbells, two easy sets to start, technique before load.' where slug = 'first-30-days-in-the-gym' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Eight weeks of three full-body strength sessions, each ending with a short conditioning finisher — dumbbells, machines and bodyweight.' where slug = 'full-body-fitness-foundations' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three slow-tempo sessions a week that teach the six basic movement patterns with bodyweight first, then light dumbbells.' where slug = 'movement-quality-foundations' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three full-body sessions a week with a pair of adjustable dumbbells and a bench.' where slug = 'dumbbell-home-strength' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three 30–35-minute sessions a week with resistance bands and your bodyweight — travel- and apartment-friendly.' where slug = 'band-bodyweight-total-body' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three dumbbell sessions a week that fit in 30 minutes including the warm-up — supersets and a short finisher circuit.' where slug = 'busy-schedule-30-minute-workouts' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three full-body sessions a week on machines, dumbbells and cables, plus squats and Romanian deadlifts — your first eight weeks of building muscle.' where slug = 'beginner-muscle-builder' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Full-Body Hypertrophy: 3 Days', summary = 'Three full-body sessions a week: every muscle trained three times with about 10 hard sets per muscle that build through the block.' where slug = 'full-body-hypertrophy-3-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Four sessions a week for 12 weeks: three mesocycles of three loading weeks and a deload, with new exercise variations each mesocycle.' where slug = 'upper-lower-hypertrophy-12-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Two heavy days and two hypertrophy days a week: get stronger on the big lifts while building muscle everywhere.' where slug = 'powerbuilding-4-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Two heavy power days and three body-part hypertrophy days with speed work — high volume for experienced lifters.' where slug = 'power-hypertrophy-5-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Five days a week for experienced lifters: three four-week blocks, each prioritising different muscles — back and delts, then chest and arms, then legs.' where slug = 'advanced-bodybuilding-5-day' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Push / Pull / Legs: 6 Days', summary = 'Push, pull and legs twice a week: a heavy lift with a last-set rep target, then bodybuilding volume.' where slug = 'push-pull-legs-6-day' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Push/Pull/Legs', summary = 'Push, pull and legs twice a week for 12 weeks: two six-week blocks that build volume and end in deloads, with a 3-day option.' where slug = 'push-pull-legs-12-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Twelve weeks of low-impact strength with balance practice every session and sit-to-stand progressions from supported to loaded.' where slug = 'active-aging-strength-and-balance' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Two progressive strength sessions a week that build from light sets of 12 to heavier sets of 6–8.' where slug = 'active-aging-strength-2-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three chair-based sessions a week for strength, posture and mobility when standing exercise is hard.' where slug = 'seated-strength-mobility' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Walk to Run: 6 Weeks to Your First 20-Minute Jog', summary = 'Three gentle sessions a week take you from brisk walking with short jogs to 20 minutes of continuous easy jogging.' where slug = 'walk-to-run-beginner' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Beginner Run/Walk to 5K: 10 Weeks', summary = 'Three run/walk sessions a week for ten weeks — a slower build than most couch-to-5K plans, finishing with 30 minutes of continuous easy running.' where slug = 'beginner-run-walk-5k-10-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Eight weeks, three runs a week: easy running, one quality session, a long run, a cutback week and a race-week taper.' where slug = '5k-training' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Aerobic Endurance Builder: 8 Weeks', summary = 'Three core aerobic sessions a week plus up to two optional easy days: about 45% more weekly endurance time in eight weeks, mostly at talk-test effort — run, ride, row or walk.' where slug = 'aerobic-endurance-builder-8-week' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Hybrid: Strength & 5K–10K Running', summary = 'Two full-body strength days and three runs a week, spaced so hard runs never land next to heavy leg days.' where slug = 'hybrid-strength-and-run' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Hybrid Strength + Running: 12-Week Strength-Priority Plan', summary = 'Three strength sessions and two runs a week for 12 weeks, with hard days separated and a lighter week every fourth week.' where slug = 'hybrid-strength-run-12-week' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Full-Body Mobility: 6-Week Routine', summary = 'Five short mobility sessions a week (or four) for hips, spine, shoulders and ankles, with holds that grow every week.' where slug = 'full-body-mobility-6-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Four gentle sessions a week (five optional) of easy walking or cycling and relaxed stretching to help you feel looser and recover between workouts.' where slug = 'flexibility-recovery-routines' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'A planned easy week: lighter loads, mobility and easy cardio.' where slug = 'recovery-deload-week' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Core Strength & Stability: 8 Weeks' where slug = 'core-strength-stability-8-week' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'Off-Camp Strength for Fighters (2 Days)', summary = 'Two short strength & power sessions a week that build a base without stealing from skills training.' where slug = 'mma-off-camp-2-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Strength and energy-system work to support skill training — not replace it.' where slug = 'mma-fight-conditioning' and owner_id is null and source = 'curated';
--   update public.training_programs set name = 'MMA Fight Camp: 8 Weeks (3 Days)', summary = 'Three S&C sessions a week periodized into a fight: base, specific preparation, peak and fight week.' where slug = 'mma-fight-camp-3-day' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Ten weeks, three days: jumps, throws and power cleans at full rest paired with squat, bench and trap-bar strength, with a deload and a test week.' where slug = 'power-and-athletic-strength-10-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Strength to protect muscle plus sustainable cardio to support fat loss.' where slug = 'lean-and-conditioned' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Twelve weeks of four strength-first sessions a week to keep your muscle while you diet, each with low-impact conditioning.' where slug = 'strength-for-fat-loss' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three interval-circuit sessions a week: every-minute-on-the-minute strength, timed work:rest rounds and a short finisher.' where slug = 'kettlebell-circuit-intervals' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Three interval sessions a week — bike, kettlebell-and-bodyweight circuits and rower — with work:rest ratios that tighten over eight weeks.' where slug = 'conditioning-intervals-8-week' and owner_id is null and source = 'curated';
--   update public.training_programs set summary = 'Varied mixed-modal workouts that build strength and a big engine.' where slug = 'functional-engine' and owner_id is null and source = 'curated';

update public.training_programs set name = 'Wave Strength: Training-Max Method', summary = 'For intermediates who want slow, steady strength gains: two 4-week training-max waves (8 weeks), one main lift a day at 65–95%, the last set for max good reps, and a deload ending each wave.'
  where slug = 'wave-strength-training-max' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For intermediates who want a 12-week block that peaks: 4-day upper/lower in three waves — accumulate, intensify, realize — from a training max, ending with a top-set test.'
  where slug = 'intermediate-strength-builder-upper-lower' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For lifters whose session-to-session gains have stalled: three days a week — a volume day, a recovery day and a heavy day — with weekly records instead.'
  where slug = 'intermediate-weekly-undulating' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For brand-new barbell lifters who want the simplest plan: alternate two short workouts three times a week and add weight every session.'
  where slug = 'barbell-strength-foundations' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners who''d rather progress by effort than add weight every session: learn the squat, bench, deadlift, press, rows and chin-ups, then test a new 5-rep best.'
  where slug = 'beginner-strength-foundations-8-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For women who want to get genuinely strong: a full-body barbell and dumbbell plan that progresses load — not just reps — three days a week.'
  where slug = 'womens-strength-progression' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners prioritising glutes: two glute-focused lower days — heavy hip thrusts and squats — and two upper days for real upper-body strength.'
  where slug = 'womens-glute-strength' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For intermediates prioritising glutes, hamstrings and quads: two lower and two upper days a week, building through two blocks, with a 3-day option.'
  where slug = 'lower-body-glute-development' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For your first month in a gym: a calm introduction to machines and dumbbells — two easy sets to start, technique before load.'
  where slug = 'first-30-days-in-the-gym' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners who want all-round fitness: three full-body strength sessions a week on dumbbells and machines, each ending with a short conditioning finisher.'
  where slug = 'full-body-fitness-foundations' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For complete beginners or anyone returning after a long break: slow-tempo sessions that teach the six basic movement patterns, bodyweight first, then light dumbbells.'
  where slug = 'movement-quality-foundations' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners training at home with adjustable dumbbells and a bench: three full-body sessions a week.'
  where slug = 'dumbbell-home-strength' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For home or travel with only resistance bands: three 30–35-minute total-body sessions a week with bands and your bodyweight.'
  where slug = 'band-bodyweight-total-body' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For busy weeks with a pair of dumbbells: three sessions that fit in 30 minutes including the warm-up — supersets and a short finisher circuit.'
  where slug = 'busy-schedule-30-minute-workouts' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners whose main goal is muscle: three full-body sessions a week on machines, dumbbells and cables, plus squats and Romanian deadlifts.'
  where slug = 'beginner-muscle-builder' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Full-Body Hypertrophy: 3-Day', summary = 'For lifters with some gym experience who want size on three days: every muscle three times a week, about 10 hard sets each, building through the block.'
  where slug = 'full-body-hypertrophy-3-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For intermediates who want size on four days: an upper/lower split in three 4-week mesocycles, with new exercise variations each one.'
  where slug = 'upper-lower-hypertrophy-12-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For intermediates who want strength and size together on four days: two heavy days and two hypertrophy days a week, in two waves.'
  where slug = 'powerbuilding-4-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For experienced lifters with five days: two heavy power days plus three body-part hypertrophy days with speed work.'
  where slug = 'power-hypertrophy-5-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For experienced lifters on five days: three 4-week blocks, each prioritising different muscles — back and delts, then chest and arms, then legs.'
  where slug = 'advanced-bodybuilding-5-day' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Push/Pull/Legs: Strength & Size', summary = 'For intermediates on six days who want their main lifts to climb: a heavy lift with a last-set rep target each session, then bodybuilding volume.'
  where slug = 'push-pull-legs-6-day' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Push/Pull/Legs: Hypertrophy', summary = 'For intermediates on six days with muscle as the main goal: two 6-week volume blocks, each ending in a deload, with a 3-day option.'
  where slug = 'push-pull-legs-12-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For older adults starting out: three low-impact sessions a week with balance practice every time and sit-to-stand progressions from supported to loaded.'
  where slug = 'active-aging-strength-and-balance' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For adults 50+ who can train twice a week: dumbbell strength that builds from light sets of 12 to heavier sets of 6–8.'
  where slug = 'active-aging-strength-2-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For anyone who needs or prefers to exercise seated: three chair-based sessions a week for strength, posture and mobility.'
  where slug = 'seated-strength-mobility' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Walk to Run: Your First 20-Minute Jog', summary = 'For non-runners starting from walking: brisk walks with short jogs that build to 20 minutes of continuous easy jogging.'
  where slug = 'walk-to-run-beginner' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Beginner Run/Walk to 5K', summary = 'For new runners aiming at a first 5K: three run/walk sessions a week and a gentle build, with two easier weeks, to 30 minutes of continuous running.'
  where slug = 'beginner-run-walk-5k-10-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For runners who can already run 30 minutes: easy running, one quality session, a long run, a cutback week and a race-week taper.'
  where slug = '5k-training' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Aerobic Endurance Builder', summary = 'For building an aerobic base on any machine or on foot: about 45% more weekly endurance time in eight weeks, mostly at talk-test effort.'
  where slug = 'aerobic-endurance-builder-8-week' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Hybrid: Running Focus', summary = 'For runners who also lift: three runs (easy, intervals, long) and two full-body strength days a week, spaced so hard sessions never collide.'
  where slug = 'hybrid-strength-and-run' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Hybrid: Strength Focus', summary = 'For lifters who also run: three strength sessions and two runs a week, with hard days separated and a lighter week every fourth week.'
  where slug = 'hybrid-strength-run-12-week' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Full-Body Mobility', summary = 'For anyone who feels stiff: short sessions five days a week (or four) for hips, spine, shoulders and ankles, with holds that grow every week.'
  where slug = 'full-body-mobility-6-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For easy days between hard training: four gentle sessions a week of easy walking or cycling and relaxed stretching.'
  where slug = 'flexibility-recovery-routines' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For one planned easy week between training blocks: lighter loads, mobility and easy cardio, then back to your program.'
  where slug = 'recovery-deload-week' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Core Strength & Stability'
  where slug = 'core-strength-stability-8-week' and owner_id is null and source = 'curated';
update public.training_programs set name = 'Fighter Off-Camp Strength: 2-Day', summary = 'For fighters between camps: two short strength and power sessions a week that build a base without stealing from skills training.'
  where slug = 'mma-off-camp-2-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For fighters with no fight booked yet: three sessions a week of strength and energy-system work that support skill training, not replace it.'
  where slug = 'mma-fight-conditioning' and owner_id is null and source = 'curated';
update public.training_programs set name = 'MMA Fight Camp: 8-Week Countdown', summary = 'For fighters with a fight eight weeks out: three S&C sessions a week periodized into the fight — base, specific preparation, peak and fight week.'
  where slug = 'mma-fight-camp-3-day' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For athletes who want to jump, sprint and throw harder: jumps, throws and power cleans at full rest paired with squat, bench and trap-bar strength, ending in a test week.'
  where slug = 'power-and-athletic-strength-10-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners losing fat who like variety: two dumbbell strength circuits, one steady cardio day and one interval day a week.'
  where slug = 'lean-and-conditioned' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For beginners dieting who want to keep their muscle: four strength-first gym sessions a week, each with low-impact conditioning.'
  where slug = 'strength-for-fat-loss' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For conditioning with a kettlebell at home or in the gym: every-minute-on-the-minute strength, timed work:rest rounds and a short finisher.'
  where slug = 'kettlebell-circuit-intervals' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For conditioning on a bike and rower: three interval sessions a week — bike, kettlebell-and-bodyweight circuit, rower — with work:rest ratios that tighten.'
  where slug = 'conditioning-intervals-8-week' and owner_id is null and source = 'curated';
update public.training_programs set summary = 'For experienced trainees who like mixed-modal workouts: barbell strength plus varied conditioning to build a big engine.'
  where slug = 'functional-engine' and owner_id is null and source = 'curated';
