import type { HabitActivity, HabitProgram, HabitWeek } from "@/lib/domain/habit-programs";
import { bibleHref, checkin, COMPLETION_80, FOOD_FIRST_NOTE, lesson, PROFESSIONAL_NOTE } from "./shared";

const workout: HabitActivity = {
  key: "workout",
  kind: "workout",
  title: "Workout",
  detail:
    "On your chosen days. Pick 2–4 days a week in your goals; days 1, 3 and 5 are the default suggestion. Any strength or cardio session from the app counts.",
  href: "/train",
  onDays: [1, 3, 5],
};
const extraWorkout: HabitActivity = {
  key: "workout-extra",
  kind: "workout",
  title: "Extra workout",
  detail: "Optional: a fourth session on your chosen day if your goal is four a week.",
  href: "/train",
  optional: true,
};
const steps: HabitActivity = {
  key: "steps",
  kind: "walk",
  title: "Reach your daily steps",
  detail: "Walk in short bouts if you like: after meals, at lunch, with family.",
  href: "/run",
};
const water: HabitActivity = { key: "water", kind: "water", title: "Reach your water goal", detail: "Keep a bottle in sight; a glass with each meal.", href: "/nutrition" };
const veg: HabitActivity = {
  key: "vegetables",
  kind: "vegetables",
  title: "Vegetables or fruit at two meals",
  detail: "Fresh, frozen or tinned all count.",
  href: "/nutrition",
};
const sleep: HabitActivity = {
  key: "sleep",
  kind: "sleep",
  title: "Wind down for your sleep goal",
  detail: "Same wake time daily; screens off and lights low 30 minutes before bed.",
  href: "/progress/sleep",
};
const protein: HabitActivity = {
  key: "protein",
  kind: "protein",
  title: "Protein at each meal",
  detail: "A palm-sized portion of eggs, dairy, fish, poultry, meat, beans, lentils or tofu.",
  href: "/nutrition",
};
const mobility: HabitActivity = {
  key: "mobility",
  kind: "mobility",
  title: "Ten minutes of mobility",
  detail: "Gentle stretches on non-workout days.",
  href: "/train",
  onDays: [2, 4, 6],
};
const prayer: HabitActivity = {
  key: "prayer",
  kind: "prayer",
  title: "A moment of prayer",
  detail: "Optional. A few minutes of thanks and asking for help with today.",
  href: "/faith",
  optional: true,
};

function faithWeekly(book: string, chapter: number, title: string, prompt: string): HabitActivity[] {
  return [
    { key: "scripture", kind: "scripture", title, detail: "Optional reading for the week.", href: bibleHref(book, chapter), optional: true },
    { key: "reflection", kind: "reflection", title: "Reflection", detail: `Optional, in your private prayer journal. ${prompt}`, href: "/faith/journal/new", optional: true },
  ];
}

const foundations = [workout, extraWorkout, steps, prayer];
const all = [...foundations, water, veg, sleep, protein, mobility];

function w(
  week: number,
  x: Omit<HabitWeek, "week" | "weekly"> & { extraWeekly?: HabitActivity[]; faith: Parameters<typeof faithWeekly>; questions: string[] },
): HabitWeek {
  return {
    week,
    title: x.title,
    objective: x.objective,
    lesson: x.lesson,
    milestone: x.milestone,
    daily: x.daily,
    weekly: [lesson(), ...(x.extraWeekly ?? []), ...faithWeekly(...x.faith), checkin(x.questions)],
  };
}

export const HEALTHY_HABITS_90: HabitProgram = {
  slug: "healthy-habits-90",
  name: "Ninety-Day Healthy Habits Journey",
  summary: "Ninety days to build an all-round healthy routine: movement, workouts, sleep, water, vegetables and protein, with optional faith practices.",
  description:
    "A personalised, all-levels journey in three phases. In the foundations phase (weeks 1–4) you start workouts on the days you choose and add walking, water, vegetables and sleep one at a time. In the build phase (weeks 5–8) you progress your training and add protein, meal planning and mobility. In the sustain phase (weeks 9–13) nothing new is piled on: you learn to keep your habits through busy weeks, social life and setbacks, and plan the next ninety days. Optional prayer, a weekly Psalm and journal reflections are there if you want them.",
  category: "lifestyle",
  level: "all",
  days: 90,
  schedule: "90 days in three phases: workouts on 2–4 days a week you choose, daily habits added one at a time, and a weekly check-in",
  equipment: ["Comfortable walking shoes", "Water bottle"],
  instructions: [
    "Set your goals first, including how many workouts a week (2–4). Days 1, 3 and 5 are suggested; train on whichever days suit you.",
    "Each week in weeks 1–8 adds one habit. Keep the earlier ones going as best you can; weeks 9–13 are about keeping them.",
    "Faith activities are optional and never count towards completion.",
    "A missed day is simply missed. Carry on tomorrow; nothing restarts.",
    "If you have a medical condition, are pregnant, or have a history of disordered eating, check with your doctor or a registered dietitian before changing your diet or exercise.",
  ],
  goalFields: [
    { key: "workouts_per_week", label: "Workouts per week", unit: "sessions", min: 2, max: 4, default: 3, help: "Pick what fits your life. Two strength sessions a week meets the guidelines; more is a bonus." },
    { key: "daily_steps", label: "Daily steps", unit: "steps", min: 2000, max: 20000, default: 7000, help: "Start near your current average and add 500–1,000 a day every week or two." },
    { key: "water_ml", label: "Water", unit: "ml/day", min: 1000, max: 5000, default: 2000, help: "1.5–2.5 litres of drinks suits most adults; more in heat or with exercise." },
    { key: "veg_servings", label: "Vegetables and fruit", unit: "servings/day", min: 1, max: 10, default: 5, help: "A serving is about a cupped handful." },
    { key: "sleep_hours", label: "Sleep", unit: "hours", min: 6, max: 10, default: 8, help: "Adults need at least 7 hours a night." },
    { key: "protein_g", label: "Protein", unit: "g/day", min: 40, max: 250, default: 100, help: "Many adults do well on 1.2–1.6 g per kg of body weight; active people often use 1.4–2.0 g/kg." },
  ],
  completion: COMPLETION_80,
  weeks: [
    w(1, {
      title: "Start where you are",
      objective: "Choose your workout days, complete your first sessions and walk to your daily step goal.",
      lesson: {
        title: "Small habits, big change",
        body: [
          "Lasting change rarely comes from overhauling everything at once. This journey adds one habit at a time, so each has a chance to settle before the next arrives.",
          "The Physical Activity Guidelines for adults recommend at least 150 minutes of moderate activity a week plus muscle-strengthening activity on two or more days. Your workouts and daily steps together cover that. Start at a level that feels manageable; you can always do more later.",
          "Choose two to four workout days that you can actually protect, and set your step goal near your current average.",
          PROFESSIONAL_NOTE,
        ],
      },
      daily: foundations,
      extraWeekly: [{ key: "set-goals", kind: "habit", title: "Set your goals and workout days", detail: "Pick 2–4 days a week and your daily step goal.", href: "/train/programs" }],
      faith: ["psalms", 1, "Psalm 1: Like a tree planted by streams", "What would it look like to be planted and steady this season?"],
      questions: ["Which workout days did you choose?", "What is your average step count right now?"],
      milestone: "Your first week of workouts and walking: phase one has begun.",
    }),
    w(2, {
      title: "Water",
      objective: "Keep moving and add a daily water goal.",
      lesson: {
        title: "A simple habit to stack",
        body: [
          "Fluid needs vary with body size, weather and activity, but most adults do well on around 1.5–2.5 litres of drinks a day. Pale yellow urine is a good everyday guide.",
          "Habits stick better when they're linked to something you already do. Drink a glass of water when you wake, with each meal and during workouts.",
          "Water is the default drink. Tea, coffee and milk also count; sugary drinks are best kept occasional.",
        ],
      },
      daily: [...foundations, water],
      faith: ["psalms", 63, "Psalm 63: My soul thirsts for you", "What are you thirsty for in this season?"],
      questions: ["How many days did you reach your water goal?", "Which cue helped you remember?"],
      milestone: "Two habits running together: movement and water.",
    }),
    w(3, {
      title: "Vegetables and fruit",
      objective: "Add vegetables or fruit to at least two meals a day.",
      lesson: {
        title: "Add before you subtract",
        body: [
          "Most adults eat fewer vegetables and fruit than recommended. The Dietary Guidelines suggest roughly 2½ cups of vegetables and 2 cups of fruit a day at a 2,000-calorie intake.",
          "Adding colour to meals is easier than cutting foods out. Frozen vegetables, bagged salads, tinned beans and fruit you can grab are all good options.",
          "Fibre from plants supports digestion and fullness. Increase gradually and drink enough water as you do.",
        ],
      },
      daily: [...foundations, water, veg],
      extraWeekly: [{ key: "grocery-veg", kind: "grocery", title: "Add three easy vegetables or fruits to your list", href: "/nutrition/grocery" }],
      faith: ["psalms", 104, "Psalm 104: He makes plants for people to cultivate", "Where do you see God's provision in your everyday food?"],
      questions: ["Which vegetables or fruits did you add?", "Which meal was easiest to add them to?"],
      milestone: "Plants on the plate twice a day.",
    }),
    w(4, {
      title: "Sleep",
      objective: "Wind down before your target bedtime every night to protect at least 7 hours of sleep.",
      lesson: {
        title: "The habit that powers the others",
        body: [
          "Adults need at least seven hours of sleep a night. Short sleep makes it harder to exercise, increases appetite and lowers mood, which makes every other habit harder.",
          "A consistent wake time, a dark and cool bedroom, less caffeine after early afternoon and a 30-minute wind-down without bright screens all help.",
          "This completes the foundations phase: workouts, steps, water, vegetables and sleep.",
        ],
      },
      daily: [...foundations, water, veg, sleep],
      faith: ["psalms", 4, "Psalm 4: In peace I will lie down and sleep", "What do you need to hand over to God before you sleep?"],
      questions: ["How many nights did you get seven hours or more?", "Which foundation habit feels most natural now?"],
      milestone: "Foundations phase complete: five habits in place.",
    }),
    w(5, {
      title: "Build: progress your training",
      objective: "Keep every habit and make your workouts a little harder: one more rep, a little more weight or a few more minutes.",
      lesson: {
        title: "Progressive overload, gently",
        body: [
          "Your body adapts to what you ask of it. To keep improving, gradually ask a little more: add a rep, a small amount of weight, an extra set, or a few minutes to a walk or run.",
          "Change one thing at a time and keep good form. Finishing sessions feeling you could have done a bit more is a good sign, not a failure.",
          "Logging your workouts makes progress visible, which is one of the best motivators there is.",
        ],
      },
      daily: [...foundations, water, veg, sleep],
      extraWeekly: [{ key: "progress-log", kind: "habit", title: "Log one improvement in your training", href: "/train" }],
      faith: ["psalms", 18, "Psalm 18: He trains my hands", "Where have you grown stronger, in body or otherwise?"],
      questions: ["What improved in your training this week?", "How does your body feel compared with week one?"],
      milestone: "Build phase begun: you're progressing, not just maintaining.",
    }),
    w(6, {
      title: "Build: protein at meals",
      objective: "Include a protein food at each meal.",
      lesson: {
        title: "Protein for strength and fullness",
        body: [
          "Protein supports muscle repair after workouts and helps you feel full. Many adults eat most of theirs at dinner; spreading it across meals works better.",
          "A palm-sized portion at each meal (roughly 20–40 g) suits most people: eggs, Greek yoghurt, milk, cheese, fish, chicken, meat, beans, lentils or tofu.",
          "Many adults do well on about 1.2–1.6 g per kg of body weight a day, and people who train regularly often use 1.4–2.0 g/kg. " + FOOD_FIRST_NOTE,
        ],
      },
      daily: [...foundations, water, veg, sleep, protein],
      faith: ["psalms", 145, "Psalm 145: You give them their food in due season", "What are you grateful for in what you eat?"],
      questions: ["Which meal was hardest to add protein to?", "Have you noticed any change in hunger?"],
      milestone: "Every meal has protein, vegetables are a habit, and you're training regularly.",
    }),
    w(7, {
      title: "Build: plan your meals",
      objective: "Plan the week's meals and shop from a list so your habits are easier to keep.",
      lesson: {
        title: "Plans make habits easier",
        body: [
          "Most food decisions happen when you're tired and hungry. Planning ahead moves those decisions to a calmer moment.",
          "Start simple: plan three or four dinners with protein and vegetables, and a couple of easy breakfasts and lunches. Make a shopping list from the plan.",
          "Leave room for flexibility: a meal out, leftovers, a night off. A plan that fits real life is one you'll keep.",
        ],
      },
      daily: [...foundations, water, veg, sleep, protein],
      extraWeekly: [
        { key: "meal-plan", kind: "meal_plan", title: "Plan this week's meals", href: "/nutrition/planner" },
        { key: "grocery", kind: "grocery", title: "Shop from your list", href: "/nutrition/grocery" },
      ],
      faith: ["proverbs", 16, "Proverbs 16: Commit your work to the Lord", "Which plans do you need to commit to God this week?"],
      questions: ["Did planning make the week easier?", "Which planned meal will you repeat?"],
      milestone: "A weekly planning habit in place.",
    }),
    w(8, {
      title: "Build: mobility and stress",
      objective: "Add ten minutes of mobility on non-workout days, and notice how movement affects stress.",
      lesson: {
        title: "Move well, feel better",
        body: [
          "Short, gentle mobility sessions help you move comfortably, recover between workouts and wind down. They can also be a calm moment in a busy day.",
          "Regular physical activity is one of the best-supported ways to improve mood and reduce feelings of stress and anxiety. Walking outdoors is especially helpful for many people.",
          "This completes the build phase. From next week, the aim is not to add more but to keep what you've built.",
        ],
      },
      daily: all,
      faith: ["psalms", 46, "Psalm 46: Be still, and know that I am God", "Where do you need stillness this week?"],
      questions: ["How did mobility sessions feel?", "What helps you most when you're stressed?"],
      milestone: "Build phase complete: your full set of daily habits is in place.",
    }),
    w(9, {
      title: "Sustain: make it automatic",
      objective: "Keep every habit and remove one point of friction that makes a habit harder than it needs to be.",
      lesson: {
        title: "From effort to routine",
        body: [
          "Habits become automatic through repetition in a consistent context. Research suggests this takes weeks to months, and missing a day here and there doesn't undo it.",
          "Look for friction: shoes hidden in a cupboard, no water bottle at your desk, vegetables that need a lot of preparation. Make the good choice the easy one.",
          "Notice which habits now happen without thinking, and which still need a reminder.",
        ],
      },
      daily: all,
      extraWeekly: [{ key: "remove-friction", kind: "habit", title: "Remove one point of friction", detail: "Lay out kit, prep a snack, set a bedtime reminder: whatever makes a habit easier." }],
      faith: ["psalms", 37, "Psalm 37: Commit your way to the Lord", "Which habits now feel like part of who you are?"],
      questions: ["Which habits feel automatic now?", "What friction did you remove?"],
      milestone: "Sustain phase begun: your habits are becoming routine.",
    }),
    w(10, {
      title: "Sustain: weekends and people",
      objective: "Keep your habits through weekends and social time, and plan one active outing with others.",
      lesson: {
        title: "Healthy habits are better shared",
        body: [
          "Weekends, holidays and social events are where routines usually wobble. The aim is not to avoid them but to carry a few anchor habits through them: a walk, water, vegetables at one meal.",
          "Doing active things with family or friends — a walk, a hike, a game in the park — builds both health and relationships.",
          "Healthy routines are easier when the people around you know what you're aiming for. Invite someone to join you.",
        ],
      },
      daily: all,
      extraWeekly: [{ key: "active-outing", kind: "habit", title: "Plan an active outing with others", detail: "A walk, hike, bike ride or game with family or friends." }],
      faith: ["psalms", 133, "Psalm 133: How good it is to live together in unity", "Who walks alongside you on this journey?"],
      questions: ["How did your habits hold up at the weekend?", "Who did you share an active outing with?"],
      milestone: "Your habits work in real life, with real people.",
    }),
    w(11, {
      title: "Sustain: plans for setbacks",
      objective: "Write simple if-then plans for the situations most likely to throw you off.",
      lesson: {
        title: "Expect the disruption",
        body: [
          "Illness, travel, a busy season at work or a family crisis will interrupt your routine at some point. That's normal, not failure.",
          "If-then plans help: 'If I can't get to the gym, then I'll do a 20-minute home workout.' 'If I'm travelling, then I'll walk after meals and pack a water bottle.'",
          "Keep a minimum version of each habit for hard weeks. Something small, done consistently, keeps the habit alive until life settles.",
        ],
      },
      daily: all,
      extraWeekly: [{ key: "if-then", kind: "habit", title: "Write three if-then plans", detail: "For your three most likely disruptions." }],
      faith: ["psalms", 42, "Psalm 42: Hope in God", "How has God met you in past hard seasons?"],
      questions: ["What are your three most likely disruptions?", "What's the minimum version of your routine?"],
      milestone: "You're ready for the weeks that don't go to plan.",
    }),
    w(12, {
      title: "Sustain: see your progress",
      objective: "Look back over twelve weeks and notice what has changed.",
      lesson: {
        title: "Progress is more than one number",
        body: [
          "Progress shows up in many ways: steps per day, how many workouts you completed, strength in the gym, sleep, energy, mood and how your clothes fit.",
          "Compare where you are now with week one. Celebrate the habits that stuck, and be curious rather than critical about the ones that didn't.",
          "Gratitude for what has changed is a better motivator than frustration about what hasn't.",
        ],
      },
      daily: all,
      extraWeekly: [{ key: "look-back", kind: "habit", title: "Compare this week with week one", detail: "Steps, workouts, sleep, energy and how you feel." }],
      faith: ["psalms", 103, "Psalm 103: Forget not all his benefits", "What benefits from these twelve weeks are you thankful for?"],
      questions: ["What has changed most since week one?", "Which habit are you proudest of?"],
      milestone: "Twelve weeks of progress, seen and celebrated.",
    }),
    w(13, {
      title: "Your next ninety days",
      objective: "Finish strong over the final six days and choose your focus for the next ninety.",
      lesson: {
        title: "Keep going",
        body: [
          "These last six days complete the journey. You've built a routine of workouts, daily movement, water, vegetables, protein, sleep and mobility.",
          "For the next ninety days, choose one area to grow (for example, a new training program, more steps, better sleep) while keeping the others at a maintainable level.",
          "Whatever your completion score, the habits you've practised are real. Keep the ones that serve you, adjust the ones that don't, and keep going.",
        ],
      },
      daily: all,
      extraWeekly: [{ key: "next-90", kind: "habit", title: "Choose your focus for the next 90 days", detail: "One area to grow, the rest to maintain.", href: "/train/programs" }],
      faith: ["psalms", 121, "Psalm 121: He will watch over your coming and going", "What do you want to bring to God for the next season?"],
      questions: ["What will you focus on next?", "Which habits will you keep exactly as they are?", "What would you tell yourself on day one?"],
      milestone: "Journey complete: ninety days of healthy habits.",
    }),
  ],
  needsProfessionalReview: {
    who: "Registered dietitian",
    why: "Includes default water, vegetable and protein targets and general nutrition guidance that a dietitian should confirm are appropriate for an all-levels audience.",
  },
};
