/**
 * Animated demonstration definitions, keyed by exercise slug.
 *
 * Each entry builds a looping keyframed motion from a base movement pattern (see src/lib/exercise-motion/patterns)
 * with exercise-specific parameters (equipment, stance, range, tempo). Slugs without an entry here — for example
 * exercises added to the catalog later — get a pattern-based fallback from `fallbackMotion()`, chosen from the
 * exercise's movement pattern, equipment and name.
 *
 * These are stylised illustrations of correct technique, not filmed video.
 */
import { goodMorning, kettlebellSwing, pull, squat } from "../lib/exercise-motion/patterns/lower";
import {
  armIsolation,
  benchPress,
  dips,
  frontArms,
  landminePress,
  latPulldown,
  machineChestPress,
  overheadPress,
  pikePushUp,
  pullUp,
  pushUp,
  rearDeltFly,
  row,
  straightArmPulldown,
} from "../lib/exercise-motion/patterns/upper";
import { carry, gait, jumpRope, lateralShuffle, standHold } from "../lib/exercise-motion/patterns/locomotion";
import { backExtension, bridge, calfRaise, hipAbduction, hackSquat, legMachine, legPress, nordic, seatSquat, singleLegRdl, splitSquat, stepUp } from "../lib/exercise-motion/patterns/lower2";
import { coreMove } from "../lib/exercise-motion/patterns/core";
import {
  battleRopes,
  bearCrawl,
  bike,
  boxing,
  burpee,
  jump,
  lateralBound,
  loadObject,
  medBall,
  mountainClimber,
  powerClean,
  rowing,
  wallDrill,
} from "../lib/exercise-motion/patterns/power";
import { pose, stanceLegs, both } from "../lib/exercise-motion/build";
import type { ExerciseMeta, MotionDef } from "../lib/exercise-motion/types";

type Builder = (id: string) => MotionDef;

const S = "Side view. ";
const F = "Front view. ";

/** Hand-tuned motion per catalog exercise. */
export const EXERCISE_MOTIONS: Record<string, Builder> = {
  // ------------------------------------------------------------------ Squat
  "back-squat": (id) =>
    squat({ id, load: "back", label: `${S}Barbell on the upper back: sits down between the hips to just below parallel over two seconds, bar staying over mid-foot, then stands up in one second.`, props: [{ id: "rack", kind: "rack", at: [-70, 140], layer: "back" }] }),
  "front-squat": (id) => squat({ id, load: "front", knee: 135, shin: 40, label: `${S}Bar racked on the front of the shoulders with elbows high: squats straight down with an upright torso, then drives up.` }),
  "goblet-squat": (id) => squat({ id, load: "goblet", implement: "dumbbell", knee: 135, shin: 38, label: `${S}Dumbbell held vertically at the chest: squats deep with the chest up, pauses briefly, stands.`, holdBottom: 0.3 }),
  "bodyweight-squat": (id) => squat({ id, load: "arms-forward", label: `${S}Arms reach forward as the hips sit back and down to parallel, heels down, then stands tall.` }),
  "box-squat-to-chair": (id) => seatSquat(id, `${S}Reaches the arms forward and slowly sits back until lightly touching the chair, then leans forward and stands.`, { chair: true }),
  "leg-press": (id) => legPress(id, `${S}Seated in a 45° leg press: lowers the sled by bending the knees toward the chest, then presses back to straight-but-soft knees.`),
  "pause-squat": (id) => squat({ id, load: "back", holdBottom: 1.5, label: `${S}Back squat with a full pause at the bottom before driving up.` }),
  "tempo-squat": (id) => squat({ id, load: "back", down: 3, holdBottom: 0.6, label: `${S}Back squat with a slow three-second descent and a short pause at the bottom.` }),
  "box-squat": (id) => seatSquat(id, `${S}Barbell on the back: sits back to the box, pauses, and drives up keeping the shins near vertical.`, { barbell: true, seat: 50 }),
  "zercher-squat": (id) => squat({ id, load: "zercher", knee: 130, label: `${S}Bar held in the crook of the elbows: squats with an upright torso and stands.` }),
  "hack-squat": (id) => hackSquat(id, `${S}Back against the hack-squat pad: squats deep along the sled's path and presses back up.`),
  "deep-squat-hold": (id) => coreMove(id, `${S}Holds a deep, heels-down squat with the chest up and elbows inside the knees, breathing slowly.`, "deep-squat"),

  // ------------------------------------------------------------------ Hinge
  "conventional-deadlift": (id) => pull({ id, label: `${S}Pulls the bar from the floor in a straight line over mid-foot, hips and shoulders rising together, locks out tall, then lowers under control.` }),
  "sumo-deadlift": (id) => pull({ id, shin0: 4, barX: 2, label: `${S}Wide sumo stance (seen from the side): a more upright torso pulls the bar from the floor to lockout and back down.` }),
  "trap-bar-deadlift": (id) => pull({ id, implement: "trapBar", shin0: 20, barStart: 24, label: `${S}Standing inside a trap bar: bends the knees more, pulls to a tall lockout, lowers.` }),
  "romanian-deadlift": (id) => pull({ id, fromTop: true, barStart: 46, down: 2, up: 1.2, label: `${S}From standing, pushes the hips back with soft knees, sliding the bar down the thighs to just below the knees, then drives the hips forward.` }),
  "single-leg-rdl": (id) => singleLegRdl(id, `${S}Balancing on one leg, hinges forward while the free leg reaches back in line with the torso, dumbbell hanging under the shoulder, then returns.`),
  "kettlebell-swing": (id) => kettlebellSwing(id, `${S}Hikes the kettlebell back between the legs, snaps the hips forward to float it to chest height with straight arms, and lets it swing back.`),
  "hip-thrust": (id) => bridge(id, `${S}Upper back on a bench and bar across the hips: drives the hips up until the torso is level, squeezes, and lowers.`, { bench: true, barbell: true }),
  "glute-bridge": (id) => bridge(id, `${S}Lying on the back with knees bent: lifts the hips until shoulders, hips and knees line up, holds, and lowers.`),
  "deficit-deadlift": (id) =>
    pull({ id, platform: 6, shin0: 16, label: `${S}Standing on a low platform so the bar starts lower relative to the feet: deadlifts from the floor to lockout.`, props: [{ id: "plat", kind: "box", at: [0, 0], w: 54, h: 6, layer: "back" }] }),
  "block-pull": (id) =>
    pull({ id, barStart: 48, shin0: 4, label: `${S}Bar starts on blocks just below the knees: pulls to lockout and returns it to the blocks.`, props: [{ id: "blk", kind: "box", at: [2, 0], w: 34, h: 25.5, layer: "back" }] }),
  "good-morning": (id) => goodMorning(id, `${S}Bar on the upper back: hinges forward with soft knees until the torso is nearly level, then stands back up.`),
  "atlas-stone-load": (id) => loadObject(id, `${S}Hugs the stone off the floor, rolls it into the lap, stands and extends the hips to load it onto the platform.`, "stone"),
  "sandbag-load-over-bar": (id) => loadObject(id, `${S}Picks the sandbag up to the lap, then drives the hips through to load it onto the platform.`, "sandbag-platform"),
  "back-extension": (id) => backExtension(id, `${S}Hips on the pad and feet locked in at 45°: hinges down until the torso hangs, then lifts back to a straight line with the legs.`),
  "hip-abduction": (id) => hipAbduction(id, `${F}Seated with a band above the knees: pushes the knees apart, pauses, and returns slowly.`),
  "nordic-hamstring-curl": (id) => nordic(id, `${S}Kneeling with ankles held, lowers the body forward as slowly as possible, catches with the hands, and pushes back up.`),

  // ------------------------------------------------------------------ Isolation (legs)
  "leg-curl": (id) => legMachine(id, `${S}Lying face down on the leg-curl machine: curls the heels toward the glutes and lowers slowly.`, "lying-curl"),
  "leg-extension": (id) => legMachine(id, `${S}Seated in the leg-extension machine: straightens the knees to lift the pad, pauses, lowers.`, "extension"),
  "seated-leg-curl": (id) => legMachine(id, `${S}Seated leg curl: bends the knees to pull the pad down and under, then returns slowly.`, "seated-curl"),
  "standing-calf-raise": (id) => calfRaise(id, `${S}Rises onto the balls of the feet as high as possible, pauses, and lowers the heels under control.`),
  "seated-calf-raise": (id) => calfRaise(id, `${S}Seated with the pad on the knees: raises the heels, pauses, lowers into a stretch.`, { seated: true }),

  // ------------------------------------------------------------------ Lunge
  "walking-lunge": (id) => splitSquat(id, `${S}Dumbbells at the sides: steps into a lunge, lowers the back knee toward the floor, and drives back up.`, "walking", "dumbbells"),
  "reverse-lunge": (id) => splitSquat(id, `${S}Steps one foot back, lowers until the back knee nearly touches the floor, then returns to standing.`, "reverse"),
  "bulgarian-split-squat": (id) => splitSquat(id, `${S}Rear foot on a bench: lowers straight down on the front leg and drives back up.`, "bulgarian", "dumbbells"),
  "step-up": (id) => stepUp(id, `${S}Places one foot on the box, drives up to stand tall on it, and steps back down under control.`),

  // ------------------------------------------------------------------ Horizontal push
  "bench-press": (id) => benchPress({ id, label: `${S}Lying on a flat bench: lowers the bar to the lower chest over two seconds, touches, and presses it back over the shoulders.` }),
  "dumbbell-bench-press": (id) => benchPress({ id, implement: "dumbbell", grip: "dumbbell", label: `${S}Lowers two dumbbells to chest level with elbows about 45° from the body, then presses up.` }),
  "incline-dumbbell-press": (id) => benchPress({ id, implement: "dumbbell", grip: "dumbbell", incline: 35, label: `${S}On an incline bench: lowers the dumbbells to the upper chest and presses them up over the shoulders.` }),
  "close-grip-bench-press": (id) => benchPress({ id, grip: "close", label: `${S}Narrow grip with elbows tucked: lowers the bar to the lower chest and presses.` }),
  "paused-bench-press": (id) => benchPress({ id, holdBottom: 1.2, label: `${S}Bench press with a full pause with the bar on the chest before pressing.` }),
  "pin-press": (id) => benchPress({ id, pins: true, holdBottom: 0.8, label: `${S}Lowers the bar onto safety pins just above the chest, pauses, and presses from dead stop.` }),
  "machine-chest-press": (id) => machineChestPress(id, `${S}Seated chest press: pushes the handles forward to near-straight arms and returns slowly.`),
  "push-up": (id) => pushUp({ id, label: `${S}Body in a straight plank: lowers the chest to just above the floor with elbows back, then pushes up.` }),
  "incline-push-up": (id) => pushUp({ id, hands: 45, label: `${S}Hands on a box or bench: lowers the chest to the edge in a straight line and pushes away.` }),
  "wall-push-up": (id) => pushUp({ id, hands: "wall", label: `${S}Hands on a wall: leans in with a straight body until the nose nears the wall, then pushes back.` }),
  "cable-chest-fly": (id) => frontArms({ id, kind: "chest-fly", label: `${F}Standing between two cables: sweeps the arms in a wide arc to meet in front of the chest and opens back up.` }),

  // ------------------------------------------------------------------ Vertical push
  dips: (id) => dips(id, `${S}Supported on parallel bars: bends the elbows to lower until the upper arms are about level, leaning slightly forward, then presses up.`),
  "overhead-press": (id) => overheadPress({ id, label: `${S}Presses the bar from the front of the shoulders straight up past the face to lockout overhead, then lowers.` }),
  "seated-dumbbell-shoulder-press": (id) => overheadPress({ id, implement: "dumbbell", seated: true, label: `${S}Seated with back support: presses the dumbbells from shoulder height to overhead and lowers.` }),
  "pike-push-up": (id) => pikePushUp(id, `${S}Hips high in an inverted V: bends the elbows to lower the head toward the floor in front of the hands, then pushes back up.`),
  "landmine-press": (id) => landminePress(id, `${S}Half-kneeling: presses the end of the landmine bar up and forward from the shoulder to arm's length, then lowers.`),
  "push-press": (id) => overheadPress({ id, drive: true, label: `${S}Short dip at the knees, explosive leg drive, and the bar is pressed to lockout overhead, then lowered to the shoulders.` }),
  "log-press": (id) => overheadPress({ id, implement: "log", drive: true, clean: true, label: `${S}Lifts the log from the floor to the lap and chest, then dips and drives it overhead to lockout.` }),
  "axle-clean-and-press": (id) => overheadPress({ id, implement: "axle", drive: true, clean: true, label: `${S}Cleans the thick axle bar from the floor to the shoulders, then pushes it overhead.` }),
  "one-arm-dumbbell-push-press": (id) => overheadPress({ id, implement: "dumbbell", drive: true, oneArm: true, label: `${S}One dumbbell at the shoulder: dips and drives with the legs to press it overhead.` }),

  // ------------------------------------------------------------------ Shoulders / arms
  "lateral-raise": (id) => frontArms({ id, kind: "lateral-raise", label: `${F}Raises the dumbbells out to the sides to shoulder height with slightly bent elbows, then lowers slowly.` }),
  "cable-lateral-raise": (id) => frontArms({ id, kind: "cable-lateral-raise", label: `${F}One arm raises the cable handle from the opposite hip out to shoulder height and lowers.` }),
  "rear-delt-fly": (id) => rearDeltFly(id, `${S}Bent over with a flat back: lifts the dumbbells out to the sides (toward the camera) with soft elbows and lowers.`),
  "triceps-pushdown": (id) => armIsolation({ id, kind: "pushdown", label: `${S}Elbows pinned at the sides: pushes the cable down until the arms are straight, then lets it rise to about 90°.` }),
  "overhead-triceps-extension": (id) => armIsolation({ id, kind: "overhead-extension", label: `${S}Dumbbell held overhead: bends the elbows to lower it behind the head and extends back up.` }),
  "dumbbell-curl": (id) => armIsolation({ id, kind: "curl", label: `${S}Elbows by the sides: curls the dumbbells up toward the shoulders and lowers them slowly.` }),
  "hammer-curl": (id) => armIsolation({ id, kind: "hammer", label: `${S}Neutral (thumbs-up) grip: curls the dumbbells up and lowers under control.` }),
  "incline-dumbbell-curl": (id) => armIsolation({ id, kind: "incline-curl", label: `${S}Leaning back on an incline bench with arms hanging behind the body: curls the dumbbells and lowers.` }),
  "band-external-rotation": (id) => frontArms({ id, kind: "external-rotation", label: `${F}Elbow tucked at the side and bent 90°: rotates the forearm out against the band and back in.` }),
  "posing-practice": (id) => frontArms({ id, kind: "posing", label: `${F}Moves through relaxed front, front double-biceps and lat-spread poses, holding each.` }),

  // ------------------------------------------------------------------ Vertical pull
  "pull-up": (id) => pullUp({ id, label: `${S}Hanging with an overhand grip: pulls the chin over the bar, then lowers to full arm extension.` }),
  "band-assisted-pull-up": (id) => pullUp({ id, band: true, label: `${S}Knee in a band looped over the bar for assistance: pulls the chin over the bar and lowers.` }),
  "chin-up": (id) => pullUp({ id, grip: "underhand", label: `${S}Underhand grip: pulls up until the chin clears the bar, then lowers slowly.` }),
  "lat-pulldown": (id) => latPulldown(id, `${S}Seated with thighs under the pad: pulls the bar down to the upper chest with a slight lean back, then lets it rise.`),
  "straight-arm-pulldown": (id) => straightArmPulldown(id, `${S}Arms nearly straight: sweeps the cable down from overhead to the thighs, hinging slightly, and returns.`),
  "dead-hang": (id) => pullUp({ id, mode: "hang", label: `${S}Hangs from the bar with straight arms and a steady breath.` }),
  "hanging-knee-raise": (id) => pullUp({ id, mode: "knee-raise", label: `${S}Hanging from the bar: raises the knees toward the chest, curling the pelvis, and lowers without swinging.` }),

  // ------------------------------------------------------------------ Horizontal pull
  "barbell-row": (id) => row({ id, kind: "barbell", label: `${S}Hinged forward with a flat back: rows the bar to the lower ribs and lowers it to arm's length.` }),
  "one-arm-dumbbell-row": (id) => row({ id, kind: "dumbbell", label: `${S}One knee and hand on the bench: rows the dumbbell up toward the hip and lowers it.` }),
  "seated-cable-row": (id) => row({ id, kind: "cable", label: `${S}Seated with feet braced: pulls the handle to the stomach while sitting tall, then reaches forward.` }),
  "band-row": (id) => row({ id, kind: "band", label: `${S}Band anchored in front: rows the hands to the ribs squeezing the shoulder blades, then extends.` }),
  "inverted-row": (id) => row({ id, kind: "inverted", label: `${S}Hanging under a bar with heels on the floor and body straight: pulls the chest to the bar and lowers.` }),
  "face-pull": (id) => row({ id, kind: "face-pull", label: `${S}Cable at face height: pulls the rope toward the face with elbows high and out, then returns.` }),
  "band-pull-apart": (id) => frontArms({ id, kind: "pull-apart", label: `${F}Arms straight in front: pulls the band apart until the arms form a T, then returns.` }),
  "chest-supported-row": (id) => row({ id, kind: "chest-supported", label: `${S}Chest on an incline bench: rows the dumbbells up beside the ribs and lowers.` }),
  "arm-over-arm-sled-pull": (id) => row({ id, kind: "sled-pull", label: `${S}In an athletic stance: pulls the rope hand over hand, dragging the sled closer.` }),

  // ------------------------------------------------------------------ Core
  plank: (id) => pushUp({ id, forearms: true, label: `${S}Forearm plank: holds a straight line from head to heels with the core braced.` }),
  "side-plank": (id) => coreMove(id, `${F}Side plank on one forearm: holds the body in a straight line with hips lifted.`, "side-plank"),
  "dead-bug": (id) => coreMove(id, `${S}Lying on the back with arms up and knees over hips: extends one arm overhead and the opposite leg out, then switches.`, "dead-bug"),
  "bird-dog": (id) => coreMove(id, `${S}On hands and knees: reaches one arm forward and the opposite leg back, holds, then switches sides.`, "bird-dog"),
  "pallof-press": (id) => frontArms({ id, kind: "pallof", label: `${F}Standing side-on to a cable: presses the handle straight out from the chest, resists the rotation, and brings it back.` }),
  "cable-woodchop": (id) => coreMove(id, `${F}Pulls the cable handle diagonally from high on one side to low across the body, rotating through the trunk.`, "woodchop"),
  "ab-wheel-rollout": (id) => coreMove(id, `${S}Kneeling: rolls the wheel forward until the body is nearly straight, then pulls back to the start.`, "ab-wheel"),
  "copenhagen-plank": (id) => coreMove(id, `${F}Side plank with the top leg on a bench: holds the hips up using the inner thigh.`, "copenhagen"),
  "cable-crunch": (id) => coreMove(id, `${S}Kneeling under a high cable with the rope by the head: curls the trunk down toward the knees and returns.`, "cable-crunch"),

  // ------------------------------------------------------------------ Rotation / throws
  "medicine-ball-rotational-throw": (id) => coreMove(id, `${F}Loads the ball at one hip, rotates explosively to throw it into the wall, and catches the rebound.`, "rotational-throw"),
  "medicine-ball-scoop-toss": (id) => medBall(id, `${S}Squats with the ball low between the legs, then extends explosively to scoop-toss it up and forward.`, "scoop"),
  "medicine-ball-shot-put": (id) => coreMove(id, `${F}Ball held at the shoulder: steps and pushes it explosively away like a shot put.`, "shot-put"),
  "landmine-rotation": (id) => coreMove(id, `${F}Arms straight on the end of the landmine: arcs the bar from one hip to the other, turning through the hips and trunk.`, "landmine-rotation"),

  // ------------------------------------------------------------------ Carries
  "farmers-carry": (id) => carry(id, `${S}Walks tall with a heavy dumbbell in each hand at the sides.`, "farmer"),
  "suitcase-carry": (id) => carry(id, `${S}Walks tall with a single dumbbell in one hand, staying level.`, "suitcase"),
  "sandbag-bear-hug-carry": (id) => carry(id, `${S}Hugs the sandbag to the chest and walks with short, steady steps.`, "hug"),
  "yoke-carry": (id) => carry(id, `${S}Yoke across the upper back: walks with short, quick steps holding the uprights.`, "yoke"),
  "strongman-farmers-walk": (id) => carry(id, `${S}Picks up the long strongman handles and walks with them at the sides.`, "handles"),
  "trap-bar-carry": (id) => carry(id, `${S}Walks while holding a loaded trap bar at arm's length.`, "trap"),
  "keg-carry": (id) => carry(id, `${S}Bear-hugs the keg against the chest and walks.`, "keg"),
  "zercher-carry": (id) => carry(id, `${S}Bar held in the crooks of the elbows: walks tall with short steps.`, "zercher"),
  "sled-drag": (id) => carry(id, `${S}Strap from the hips to the sled: walks forward driving through each step, dragging the sled behind.`, "strap"),
  "sled-push": (id) => carry(id, `${S}Hands on the sled poles with the body leaning about 45°: drives the sled with powerful steps.`, "sled-push"),

  // ------------------------------------------------------------------ Power / plyometric
  "power-clean": (id) => powerClean(id, `${S}Pulls the bar from the floor, extends explosively onto the toes, and catches it on the front of the shoulders in a quarter squat.`),
  "box-jump": (id) => jump(id, `${S}Swings the arms back, jumps up onto the box, and lands softly in a quarter squat before standing.`, "box"),
  "broad-jump": (id) => jump(id, `${S}Counter-movement with an arm swing, jumps forward as far as possible, and sticks the landing.`, "broad"),
  "trap-bar-jump": (id) => jump(id, `${S}Holding a light trap bar: dips and jumps vertically, landing softly.`, "trap-bar"),
  "pogo-jumps": (id) => jump(id, `${S}Quick, stiff-ankle hops on the balls of the feet.`, "pogo"),
  "lateral-bound": (id) => lateralBound(id, `${F}Bounds sideways from one leg to the other, sticking each single-leg landing.`),
  "medicine-ball-slam": (id) => medBall(id, `${S}Lifts the ball overhead on the toes and slams it into the floor, then squats to pick it up.`, "slam"),
  "sandbag-to-shoulder": (id) => loadObject(id, `${S}Lifts the sandbag to the lap, then explodes the hips to pop it onto one shoulder.`, "sandbag-shoulder"),
  "a-skip": (id) => gait({ id, kind: "askip", label: `${S}Skipping rhythm with a high knee drive and the foot striking down under the hips.` }),
  "wall-drill": (id) => wallDrill(id, `${S}Leaning into a wall at about 45°: drives one knee up, then switches legs sharply.`),
  "acceleration-sprint": (id) => gait({ id, kind: "accel", label: `${S}Sprint start with a strong forward lean, powerful pushes and big arm drive.` }),
  "flying-sprint": (id) => gait({ id, kind: "sprint", label: `${S}Upright top-speed sprinting: high knees, feet striking under the hips, fast arms.` }),
  bounding: (id) => gait({ id, kind: "bound", label: `${S}Exaggerated running strides with long airborne phases.` }),

  // ------------------------------------------------------------------ Conditioning
  burpee: (id) => burpee(id, `${S}Squats, places the hands down, jumps the feet back to a plank, jumps them in, and jumps up with arms overhead.`, "jump"),
  "step-back-burpee": (id) => burpee(id, `${S}Hands down, steps one foot back at a time into a plank, steps back in, and stands — no jump.`, "step"),
  sprawl: (id) => burpee(id, `${S}From an athletic stance, drops the hands and shoots the legs back with hips low, then pops back up.`, "sprawl"),
  "mountain-climber": (id) => mountainClimber(id, `${S}Plank on the hands: drives the knees toward the chest one after the other.`),
  "bear-crawl": (id) => bearCrawl(id, `${S}Hands and feet on the floor with knees hovering: crawls forward moving opposite hand and foot.`),
  "jump-rope": (id) => jumpRope(id, `${S}Small bounces on the balls of the feet while the wrists turn the rope.`),
  "rowing-intervals": (id) => rowing(id, `${S}Rowing stroke: legs drive, then the body swings back and the arms pull the handle to the ribs; recovery reverses the order.`),
  "bike-intervals": (id) => bike(id, `${S}Pedalling a stationary bike at a steady cadence.`, false),
  "air-bike-sprint": (id) => bike(id, `${S}Air bike sprint: legs pedal hard while the arms push and pull the handles.`, true),
  "brisk-walk": (id) => gait({ id, kind: "walk", label: `${S}Brisk walking with a natural heel-to-toe roll and arm swing.` }),
  "standing-march": (id) => gait({ id, kind: "march", label: `${S}Marches in place, lifting each knee to about hip height.` }),
  shadowboxing: (id) => boxing(id, `${S}Boxing stance with hands up: throws a jab and a cross, returning to guard, light on the feet.`, false),
  "heavy-bag-rounds": (id) => boxing(id, `${S}Throws jab–cross combinations into a heavy bag, returning to guard.`, true),
  "battle-rope-waves": (id) => battleRopes(id, `${S}Half-squat stance: alternates arms up and down to send waves along the ropes.`),
  "lateral-shuffle": (id) => lateralShuffle(id, `${F}Athletic stance: shuffles sideways without crossing the feet, then back.`),
  "hip-escape": (id) => coreMove(id, `${S}Lying on the back: pushes off one foot and shrimps the hips away, then resets the feet.`, "hip-escape"),
  "zone-2-run": (id) => gait({ id, kind: "jog", label: `${S}Easy, relaxed running stride.` }),
  "run-walk-intervals": (id) => gait({ id, kind: "jog", cycle: 0.82, label: `${S}Easy jogging stride (alternated with walking breaks).` }),
  "running-intervals": (id) => gait({ id, kind: "jog", cycle: 0.68, stride: 1.1, lean: 10, label: `${S}Faster running stride for hard intervals.` }),
  "stair-climb": (id) => stepUp(id, `${S}Steps up onto a stair with one foot, drives to stand tall, and steps down (stair-climb pattern).`, { boxH: 22 }),
  "pro-agility-shuttle": (id) => lateralShuffle(id, `${F}Shuffles to one cone, touches the line, and changes direction to the other side.`, { touch: true, cones: true }),
  "t-drill": (id) => lateralShuffle(id, `${F}Side-shuffles between cones, touching each, then returns.`, { touch: true, cones: true, steps: 3 }),
  "three-cone-drill": (id) => lateralShuffle(id, `${F}Quick change of direction between cones with low hips and a touch at each.`, { touch: true, cones: true }),
  "agility-ladder-drills": (id) => gait({ id, kind: "ladder", label: `${S}Quick, short running steps through an agility ladder.` }),
  "reactive-mirror-drill": (id) => lateralShuffle(id, `${F}Mirrors a partner by shuffling quickly side to side in an athletic stance.`, { steps: 1 }),

  // ------------------------------------------------------------------ Mobility
  "cat-cow": (id) => coreMove(id, `${S}On hands and knees: arches the back with the head up, then rounds the spine with the chin tucked.`, "cat-cow"),
  "worlds-greatest-stretch": (id) => coreMove(id, `${S}Deep lunge with one hand down: drops the elbow toward the front foot, then reaches that arm up toward the ceiling.`, "worlds-greatest"),
  "90-90-hip-switch": (id) => coreMove(id, `${F}Seated with both knees bent 90°: rotates both knees from one side to the other.`, "90-90"),
  "thoracic-open-book": (id) => coreMove(id, `View from above. Lying on one side with knees stacked: sweeps the top arm open across the chest and back.`, "open-book"),
  "couch-stretch": (id) => coreMove(id, `${S}Back knee on the floor against a wall with the shin up the wall: tall torso, gently pushes the hips forward.`, "couch-stretch"),
  "supine-hamstring-stretch": (id) => coreMove(id, `${S}Lying on the back: a band around one foot draws the straight leg up toward vertical.`, "hamstring-stretch"),
  "childs-pose": (id) => coreMove(id, `${S}Kneeling, sits the hips back to the heels with arms reaching forward on the floor, breathing slowly.`, "childs-pose"),
  "ankle-knee-to-wall": (id) => coreMove(id, `${S}Front foot near a wall: drives the knee forward to touch the wall while the heel stays down.`, "knee-to-wall"),
  "band-pass-through": (id) => coreMove(id, `${S}Holding a band wide with straight arms: lifts it from the hips up over the head and back.`, "pass-through"),
  "figure-four-stretch": (id) => coreMove(id, `${S}Lying on the back with one ankle crossed over the other knee: draws the legs toward the chest.`, "figure-four"),
  "single-leg-balance": (id) => coreMove(id, `${S}Balances on one leg with the other knee lifted, making small corrections.`, "single-leg-balance"),

  // ------------------------------------------------------------------ Neck
  "neck-isometrics": (id) => coreMove(id, `${S}Presses the hands into the forehead, then the back of the head, while the neck resists without moving.`, "neck-iso"),
  "band-neck-training": (id) => coreMove(id, `${S}Band anchored in front and around the back of the head: nods forward, then extends back against the band.`, "neck-band"),
};

// ------------------------------------------------------------------------------------------ Fallbacks

const has = (m: ExerciseMeta, ...eq: string[]) => eq.some((e) => m.equipment?.includes(e));
const named = (m: ExerciseMeta, re: RegExp) => re.test(`${m.slug} ${m.name ?? ""}`.toLowerCase());

/**
 * Pattern-based motion for an exercise without a hand-made definition. Uses the name first (most specific),
 * then the movement pattern and equipment, so new catalog entries still get a sensible demonstration.
 */
export function fallbackMotion(meta: ExerciseMeta): MotionDef {
  const id = meta.slug;
  const name = meta.name ?? meta.slug.replace(/-/g, " ");
  const L = (what: string, view = S) => `${view}${what} (pattern-based demonstration for ${name}).`;
  const m = meta;
  // Name-driven matches.
  if (named(m, /front squat/)) return squat({ id, load: "front", knee: 135, shin: 40, label: L("Front-rack squat") });
  if (named(m, /goblet/)) return squat({ id, load: "goblet", implement: has(m, "kettlebell") && !has(m, "dumbbell") ? "kettlebell" : "dumbbell", knee: 135, label: L("Goblet squat") });
  if (named(m, /overhead squat/)) return squat({ id, load: "overhead", knee: 130, shin: 40, label: L("Overhead squat with the bar locked out above mid-foot") });
  if (named(m, /split squat|lunge/)) return splitSquat(id, L("Split-stance lunge"), named(m, /bulgarian|rear.?foot/) ? "bulgarian" : "reverse", has(m, "dumbbell") ? "dumbbells" : "none");
  if (named(m, /step.?up|stair/)) return stepUp(id, L("Step-up"));
  if (named(m, /romanian|rdl|stiff/)) return pull({ id, fromTop: true, barStart: 46, implement: has(m, "barbell") ? "barbell" : "dumbbell", label: L("Hip hinge") });
  if (named(m, /good morning/)) return goodMorning(id, L("Good morning"));
  if (named(m, /deadlift|rack pull|block pull/)) return pull({ id, implement: has(m, "trap_bar") ? "trapBar" : "barbell", label: L("Deadlift") });
  if (named(m, /swing/)) return kettlebellSwing(id, L("Kettlebell swing"));
  if (named(m, /hip thrust/)) return bridge(id, L("Hip thrust"), { bench: true, barbell: has(m, "barbell") });
  if (named(m, /bridge/)) return bridge(id, L("Glute bridge"));
  if (named(m, /back extension|hyperextension/)) return backExtension(id, L("Back extension"));
  if (named(m, /abduction|clamshell/)) return hipAbduction(id, L("Hip abduction", F));
  if (named(m, /calf/)) return calfRaise(id, L("Calf raise"), { seated: named(m, /seated/) });
  if (named(m, /leg press/)) return legPress(id, L("Leg press"));
  if (named(m, /leg extension/)) return legMachine(id, L("Leg extension"), "extension");
  if (named(m, /leg curl|hamstring curl/)) return named(m, /nordic/) ? nordic(id, L("Nordic curl")) : legMachine(id, L("Leg curl"), named(m, /seated/) ? "seated-curl" : "lying-curl");
  if (named(m, /incline.*(press|bench)/)) return benchPress({ id, incline: 35, implement: has(m, "dumbbell") ? "dumbbell" : "barbell", grip: has(m, "dumbbell") ? "dumbbell" : "normal", label: L("Incline press") });
  if (named(m, /bench|floor press|chest press/)) return has(m, "machine") && !has(m, "barbell") ? machineChestPress(id, L("Chest press")) : benchPress({ id, implement: has(m, "dumbbell") && !has(m, "barbell") ? "dumbbell" : "barbell", grip: has(m, "dumbbell") && !has(m, "barbell") ? "dumbbell" : "normal", label: L("Bench press") });
  if (named(m, /push.?up|press.?up/)) return named(m, /pike|handstand/) ? pikePushUp(id, L("Pike push-up")) : pushUp({ id, hands: named(m, /incline|elevated/) ? 45 : named(m, /wall/) ? "wall" : 0, label: L("Push-up") });
  if (named(m, /dip/)) return dips(id, L("Dip"));
  if (named(m, /landmine/)) return named(m, /rotation|twist/) ? coreMove(id, L("Landmine rotation", F), "landmine-rotation") : landminePress(id, L("Landmine press"));
  if (named(m, /push press|jerk|thruster/)) return overheadPress({ id, drive: true, implement: has(m, "dumbbell") && !has(m, "barbell") ? "dumbbell" : "barbell", label: L("Push press") });
  if (named(m, /overhead press|shoulder press|military|arnold|log|axle/)) return overheadPress({ id, implement: named(m, /log/) ? "log" : has(m, "dumbbell") && !has(m, "barbell") ? "dumbbell" : "barbell", seated: named(m, /seated/), label: L("Overhead press") });
  if (named(m, /lateral raise|side raise/)) return frontArms({ id, kind: has(m, "cable") && !has(m, "dumbbell") ? "cable-lateral-raise" : "lateral-raise", label: L("Lateral raise", F) });
  if (named(m, /front raise/)) return armIsolation({ id, kind: "curl", label: L("Front raise") });
  if (named(m, /sprint|acceleration/)) return gait({ id, kind: named(m, /accel|start/) ? "accel" : "sprint", label: L("Sprint") });
  if (named(m, /\bfly\b|flye|\bflies\b/)) return named(m, /rear|reverse/) ? rearDeltFly(id, L("Rear-delt fly")) : frontArms({ id, kind: "chest-fly", label: L("Chest fly", F) });
  if (named(m, /face pull/)) return row({ id, kind: "face-pull", label: L("Face pull") });
  if (named(m, /pull.?apart/)) return frontArms({ id, kind: "pull-apart", label: L("Band pull-apart", F) });
  if (named(m, /external rotation|rotator/)) return frontArms({ id, kind: "external-rotation", label: L("External rotation", F) });
  if (named(m, /pushdown|kickback|skull|triceps|tricep/)) return armIsolation({ id, kind: named(m, /overhead|skull/) ? "overhead-extension" : "pushdown", label: L("Triceps extension") });
  if (named(m, /curl/)) return armIsolation({ id, kind: named(m, /hammer/) ? "hammer" : named(m, /incline/) ? "incline-curl" : has(m, "band") && !has(m, "dumbbell") ? "band-curl" : "curl", label: L("Biceps curl") });
  if (named(m, /chin.?up/)) return pullUp({ id, grip: "underhand", label: L("Chin-up") });
  if (named(m, /pull.?up/)) return pullUp({ id, band: named(m, /assist|band/), label: L("Pull-up") });
  if (named(m, /pulldown|pull.?down/)) return named(m, /straight/) ? straightArmPulldown(id, L("Straight-arm pulldown")) : latPulldown(id, L("Lat pulldown"));
  if (named(m, /hang/)) return pullUp({ id, mode: named(m, /knee|leg raise/) ? "knee-raise" : "hang", label: L("Hang") });
  if (named(m, /inverted row|ring row|tabletop row/)) return row({ id, kind: "inverted", label: L("Inverted row") });
  if (named(m, /row/))
    return row({
      id,
      kind: has(m, "rower") ? "cable" : has(m, "cable", "machine") ? "cable" : has(m, "band") && !has(m, "dumbbell", "barbell") ? "band" : has(m, "barbell") ? "barbell" : "dumbbell",
      label: L("Row"),
    });
  if (named(m, /plank/)) return named(m, /side|copenhagen/) ? coreMove(id, L("Side plank", F), named(m, /copenhagen/) ? "copenhagen" : "side-plank") : pushUp({ id, forearms: true, label: L("Plank") });
  if (named(m, /crunch/)) return coreMove(id, L("Crunch"), has(m, "cable") ? "cable-crunch" : "crunch");
  if (named(m, /sit.?up/)) return coreMove(id, L("Sit-up"), "sit-up");
  if (named(m, /leg raise|knee raise|toes to bar/)) return has(m, "pull_up_bar") ? pullUp({ id, mode: "knee-raise", label: L("Hanging raise") }) : coreMove(id, L("Leg raise"), "leg-raise");
  if (named(m, /dead.?bug/)) return coreMove(id, L("Dead bug"), "dead-bug");
  if (named(m, /bird.?dog/)) return coreMove(id, L("Bird dog"), "bird-dog");
  if (named(m, /rollout|ab wheel/)) return coreMove(id, L("Rollout"), "ab-wheel");
  if (named(m, /woodchop|chop|lift/) && has(m, "cable", "band")) return coreMove(id, L("Cable chop", F), "woodchop");
  if (named(m, /pallof|anti.?rotation/)) return frontArms({ id, kind: "pallof", label: L("Pallof press", F) });
  if (named(m, /slam/)) return medBall(id, L("Ball slam"), "slam");
  if (named(m, /scoop|toss/)) return medBall(id, L("Scoop toss"), "scoop");
  if (named(m, /throw|shot put/)) return coreMove(id, L("Rotational throw", F), named(m, /shot/) ? "shot-put" : "rotational-throw");
  if (named(m, /clean/)) return named(m, /press|jerk/) ? overheadPress({ id, clean: true, drive: true, implement: named(m, /axle/) ? "axle" : "barbell", label: L("Clean and press") }) : powerClean(id, L("Clean"));
  if (named(m, /snatch/)) return squat({ id, load: "overhead", label: L("Overhead squat (catch position)") });
  if (named(m, /box jump|step.?up jump/)) return jump(id, L("Box jump"), "box");
  if (named(m, /broad jump|long jump/)) return jump(id, L("Broad jump"), "broad");
  if (named(m, /pogo|hop|jumping jack|skater/)) return named(m, /skater|lateral/) ? lateralBound(id, L("Lateral bound", F)) : jump(id, L("Hops"), "pogo");
  if (named(m, /jump/)) return jump(id, L("Jump"), has(m, "trap_bar") ? "trap-bar" : "broad");
  if (named(m, /burpee/)) return burpee(id, L("Burpee"), named(m, /step/) ? "step" : "jump");
  if (named(m, /sprawl/)) return burpee(id, L("Sprawl"), "sprawl");
  if (named(m, /mountain climber/)) return mountainClimber(id, L("Mountain climber"));
  if (named(m, /crawl/)) return bearCrawl(id, L("Crawl"));
  if (named(m, /jump rope|skipping rope|double under/)) return jumpRope(id, L("Jump rope"));
  if (named(m, /row(ing)? machine|erg/) || has(m, "rower")) return rowing(id, L("Rowing stroke"));
  if (named(m, /bike|cycl|spin/) || has(m, "bike")) return bike(id, L("Pedalling"), named(m, /air|assault|fan/));
  if (named(m, /sprint|acceleration/)) return gait({ id, kind: named(m, /accel|start/) ? "accel" : "sprint", label: L("Sprint") });
  if (named(m, /run|jog/)) return gait({ id, kind: "jog", label: L("Running stride") });
  if (named(m, /walk|hike|ruck/) && !named(m, /lunge/)) return has(m, "dumbbell", "kettlebell") ? carry(id, L("Loaded carry"), "farmer") : gait({ id, kind: "walk", label: L("Walking stride") });
  if (named(m, /march/)) return gait({ id, kind: "march", label: L("March") });
  if (named(m, /skip/)) return gait({ id, kind: "askip", label: L("Skip") });
  if (named(m, /bound/)) return gait({ id, kind: "bound", label: L("Bounding") });
  if (named(m, /shuffle|agility|shuttle|cone|mirror|defensive/)) return lateralShuffle(id, L("Lateral shuffle", F), { cones: named(m, /cone|shuttle|drill/) });
  if (named(m, /box(ing)?|punch|shadow|bag|strike|kick/)) return boxing(id, L("Boxing combination"), has(m, "heavy_bag"));
  if (named(m, /rope/) && has(m, "battle_rope")) return battleRopes(id, L("Battle rope waves"));
  if (named(m, /sled/)) return named(m, /pull|rope/) ? row({ id, kind: "sled-pull", label: L("Sled pull") }) : carry(id, L("Sled work"), named(m, /drag/) ? "strap" : "sled-push");
  if (named(m, /yoke/)) return carry(id, L("Yoke carry"), "yoke");
  if (named(m, /keg/)) return carry(id, L("Keg carry"), "keg");
  if (named(m, /stone/)) return loadObject(id, L("Stone load"), "stone");
  if (named(m, /sandbag/)) return named(m, /carry/) ? carry(id, L("Sandbag carry"), "hug") : loadObject(id, L("Sandbag load"), named(m, /shoulder/) ? "sandbag-shoulder" : "sandbag-platform");
  if (named(m, /carry|farmer|suitcase|waiter/)) return carry(id, L("Loaded carry"), named(m, /suitcase/) ? "suitcase" : named(m, /zercher/) ? "zercher" : has(m, "trap_bar") ? "trap" : "farmer");
  if (named(m, /cat.?cow/)) return coreMove(id, L("Cat-cow"), "cat-cow");
  if (named(m, /child/)) return coreMove(id, L("Child's pose"), "childs-pose");
  if (named(m, /couch|hip flexor/)) return coreMove(id, L("Hip-flexor stretch"), "couch-stretch");
  if (named(m, /hamstring/)) return coreMove(id, L("Hamstring stretch"), "hamstring-stretch");
  if (named(m, /pigeon|figure|glute stretch|piriformis/)) return coreMove(id, L("Glute stretch"), "figure-four");
  if (named(m, /open book|thoracic|t-spine/)) return coreMove(id, L("Thoracic rotation", "View from above. "), "open-book");
  if (named(m, /90.?90/)) return coreMove(id, L("Hip switch", F), "90-90");
  if (named(m, /ankle/)) return coreMove(id, L("Ankle mobility"), "knee-to-wall");
  if (named(m, /pass.?through|dislocat/)) return coreMove(id, L("Shoulder pass-through"), "pass-through");
  if (named(m, /balance|single.?leg stand/)) return coreMove(id, L("Single-leg balance"), "single-leg-balance");
  if (named(m, /neck/)) return coreMove(id, L("Neck strength"), has(m, "band") ? "neck-band" : "neck-iso");
  if (named(m, /pose|posing/)) return frontArms({ id, kind: "posing", label: L("Posing", F) });
  if (named(m, /stretch|mobility|squat hold/)) return coreMove(id, L("Mobility hold"), named(m, /squat/) ? "deep-squat" : "worlds-greatest");
  if (named(m, /squat/)) return squat({ id, load: has(m, "barbell") ? "back" : has(m, "dumbbell", "kettlebell") ? "goblet" : "arms-forward", implement: has(m, "barbell") ? "barbell" : has(m, "dumbbell") ? "dumbbell" : has(m, "kettlebell") ? "kettlebell" : "none", label: L("Squat") });

  // Movement-pattern fallbacks.
  switch (meta.pattern) {
    case "squat":
      return squat({ id, load: has(m, "barbell") ? "back" : has(m, "dumbbell", "kettlebell") ? "goblet" : "arms-forward", implement: has(m, "barbell") ? "barbell" : has(m, "dumbbell") ? "dumbbell" : "none", label: L("Squat") });
    case "hinge":
      return has(m, "kettlebell") && !has(m, "barbell") ? kettlebellSwing(id, L("Hip hinge swing")) : pull({ id, fromTop: true, barStart: 46, implement: has(m, "barbell") ? "barbell" : "dumbbell", label: L("Hip hinge") });
    case "lunge":
      return splitSquat(id, L("Split-stance lunge"), "reverse", has(m, "dumbbell") ? "dumbbells" : "none");
    case "horizontal_push":
      return has(m, "bench") || has(m, "barbell") ? benchPress({ id, implement: has(m, "barbell") ? "barbell" : "dumbbell", grip: has(m, "barbell") ? "normal" : "dumbbell", label: L("Press") }) : pushUp({ id, label: L("Push-up") });
    case "vertical_push":
      return overheadPress({ id, implement: has(m, "barbell") ? "barbell" : "dumbbell", label: L("Overhead press") });
    case "horizontal_pull":
      return row({ id, kind: has(m, "cable", "machine") ? "cable" : has(m, "band") ? "band" : has(m, "barbell") ? "barbell" : "dumbbell", label: L("Row") });
    case "vertical_pull":
      return has(m, "pull_up_bar") ? pullUp({ id, label: L("Pull-up") }) : latPulldown(id, L("Pulldown"));
    case "core":
      return pushUp({ id, forearms: true, label: L("Core brace (plank)") });
    case "rotation":
      return has(m, "cable", "band") ? coreMove(id, L("Rotation", F), "woodchop") : coreMove(id, L("Rotational throw", F), "rotational-throw");
    case "carry":
      return carry(id, L("Loaded carry"), "farmer");
    case "power":
      return has(m, "medicine_ball") ? medBall(id, L("Ball slam"), "slam") : has(m, "barbell") ? powerClean(id, L("Clean")) : jump(id, L("Jump"), "broad");
    case "conditioning":
      return meta.category === "cardio" ? gait({ id, kind: "jog", label: L("Running stride") }) : burpee(id, L("Burpee"), "step");
    case "mobility":
      return coreMove(id, L("Mobility drill"), "worlds-greatest");
    case "isolation":
      return has(m, "cable", "band") ? armIsolation({ id, kind: "pushdown", label: L("Cable isolation") }) : armIsolation({ id, kind: "curl", label: L("Isolation curl") });
    default:
      return standHold(id, L("Standing hold"), pose({ ...stanceLegs(1, 3, 1), ...both({ sh: 6, el: 10 }) }));
  }
}
