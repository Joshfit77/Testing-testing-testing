import type { HabitActivity, HabitProgram } from "@/lib/domain/habit-programs";
import { checkin, COMPLETION_80, FOOD_FIRST_NOTE, lesson, PROFESSIONAL_NOTE } from "./shared";

const log: HabitActivity = {
  key: "log-food",
  kind: "track_food",
  title: "Log what you eat today",
  detail: "Use the food diary and compare with the app's calorie target as a guide, not a test.",
  href: "/nutrition",
};
const protein: HabitActivity = {
  key: "protein",
  kind: "protein",
  title: "Reach your protein goal",
  detail: "A protein food at each meal makes this easier and helps with fullness.",
  href: "/nutrition",
};
const steps: HabitActivity = {
  key: "steps",
  kind: "walk",
  title: "Reach your daily steps",
  detail: "Walk in short bouts if that's easier: after meals, on calls, to the shops.",
  href: "/run",
};
const strength2: HabitActivity = {
  key: "strength",
  kind: "workout",
  title: "Strength workout",
  detail: "Any full-body strength session. Two a week to begin with.",
  href: "/train",
  onDays: [1, 4],
};
const strength3: HabitActivity = { ...strength2, detail: "Any full-body strength session, three times a week.", onDays: [1, 3, 5] };
const veg: HabitActivity = {
  key: "vegetables",
  kind: "vegetables",
  title: "Vegetables or fruit at two meals",
  detail: "Half the plate when you can. Frozen and tinned count.",
  href: "/nutrition",
};
const sleep: HabitActivity = {
  key: "sleep",
  kind: "sleep",
  title: "Wind down for your sleep goal",
  detail: "Screens down and lights low 30 minutes before your target bedtime.",
  href: "/progress/sleep",
};
const water: HabitActivity = {
  key: "water",
  kind: "water",
  title: "Reach your water goal",
  detail: "Water first with each meal; swap some sugary drinks for water or sugar-free options.",
  href: "/nutrition",
};
const weighIn: HabitActivity = {
  key: "weigh-in",
  kind: "habit",
  title: "Weekly weigh-in",
  detail: "Once this week, same day and time, after the bathroom, before eating. Look at the trend over weeks, not a single number.",
};

export const SUSTAINABLE_FAT_LOSS: HabitProgram = {
  slug: "sustainable-fat-loss",
  name: "Sustainable Fat-Loss Habits",
  summary: "Twelve weeks of steady, realistic fat loss built on protein, plants, steps, strength training and sleep.",
  description:
    "A slow-and-steady approach to losing body fat while keeping muscle and your sanity. You eat to the app's own calorie target, which sets a moderate deficit, and layer on one habit at a time: protein, daily steps, strength training, vegetables, sleep and better drinks. No crash diets, no detoxes, no banned foods, and no daily judgement by the scale: you weigh in once a week and watch the trend.",
  category: "nutrition",
  level: "all",
  days: 84,
  schedule: "Daily habits for 12 weeks, strength training 2–3 days a week, a weekly weigh-in and check-in",
  equipment: ["Bathroom scale (optional)", "Comfortable walking shoes"],
  instructions: [
    "Use the app's calorie target in the food diary. It sets a moderate deficit; please don't go lower on your own.",
    "Aim to lose roughly 0.5–1% of your body weight a week at most. Slower is fine and often easier to keep.",
    "Weigh in once a week and judge progress by the trend over several weeks, never by a single day.",
    "No foods are banned and nothing needs to be 'detoxed'. Favourite foods can fit in your week.",
    "If you have a medical condition, are pregnant or breastfeeding, or have a history of disordered eating, please speak to your doctor or a registered dietitian before starting.",
  ],
  goalFields: [
    { key: "protein_g", label: "Protein", unit: "g/day", min: 40, max: 250, default: 120, help: "In a calorie deficit, around 1.4–2.0 g per kg of body weight helps protect muscle. Use a target that fits your size." },
    { key: "daily_steps", label: "Daily steps", unit: "steps", min: 2000, max: 20000, default: 7000, help: "Start near your current average and add 500–1,000 steps a day each week or two." },
    { key: "water_ml", label: "Water", unit: "ml/day", min: 1000, max: 5000, default: 2000, help: "Most adults do well on 1.5–2.5 litres of drinks a day; more in heat or with exercise." },
    { key: "sleep_hours", label: "Sleep", unit: "hours", min: 6, max: 10, default: 8, help: "Adults need at least 7 hours. Set the time you'd like to be in bed for." },
  ],
  completion: COMPLETION_80,
  weeks: [
    {
      week: 1,
      title: "Know your starting point",
      objective: "Log your food against the app's calorie target and take your first weekly weigh-in.",
      lesson: {
        title: "How fat loss actually works",
        body: [
          "Fat loss happens when, over weeks, you take in a little less energy than you use. A moderate deficit works better than a drastic one: it protects muscle, keeps energy up for training and is far easier to stick to. The app's calorie target is set for a moderate deficit; that is the only deficit this program uses.",
          "Crash diets, detoxes and cutting out whole food groups tend to fail because they can't be kept up, and the weight usually returns. You'll do the opposite here: small habits that you could keep for years.",
          "Body weight bounces around by a kilogram or more from day to day with water, salt and food in your gut. That's why you weigh in once a week, under the same conditions, and look at the trend over several weeks.",
          PROFESSIONAL_NOTE,
        ],
      },
      daily: [log],
      weekly: [
        lesson(),
        { key: "set-targets", kind: "habit", title: "Check your calorie and protein targets", detail: "Confirm your details so the app's target is accurate. Set your goals below.", href: "/nutrition" },
        weighIn,
        checkin(["How close were you to the app's target on most days?", "Which time of day is hardest for you?"]),
      ],
      milestone: "Your first full week of logging and your starting weight recorded.",
    },
    {
      week: 2,
      title: "Protein first",
      objective: "Reach your protein goal on most days by building each meal around a protein food.",
      lesson: {
        title: "Protein protects muscle and controls hunger",
        body: [
          "When you eat in a deficit, your body can lose muscle as well as fat. Eating enough protein, together with strength training, is the best-supported way to keep that muscle. Research summarised by the International Society of Sports Nutrition suggests about 1.4–2.0 g per kg of body weight a day for active people, and the upper part of that range is useful when dieting.",
          "Protein is also the most filling nutrient. Spreading it across three or four meals of roughly 20–40 g each is easier than trying to catch up at dinner.",
          "Lean meats, fish, eggs, Greek yoghurt, cottage cheese, milk, tofu, beans and lentils are all good options. " + FOOD_FIRST_NOTE,
        ],
      },
      daily: [log, protein],
      weekly: [
        lesson(),
        weighIn,
        { key: "protein-recipes", kind: "habit", title: "Find two high-protein meals you enjoy", detail: "Save them so they're easy to repeat.", href: "/nutrition/recipes" },
        checkin(["Which meal was hardest to get protein into?", "Did you notice a difference in hunger?"]),
      ],
      milestone: "Protein at every meal and most days at your goal.",
    },
    {
      week: 3,
      title: "Daily steps",
      objective: "Reach your daily step goal; start near your current average and build from there.",
      lesson: {
        title: "Walking is underrated",
        body: [
          "Everyday movement such as walking burns more energy across a week than most people expect, and it tends to drop quietly when you diet. Keeping steps up protects your deficit without making you hungrier the way hard exercise can.",
          "Health benefits keep rising up to roughly 7,000–10,000 steps a day for most adults, but any increase from where you are helps. If you average 4,000 now, aim for 5,000 before 10,000.",
          "Short walks after meals also help with blood sugar control and digestion. Split your steps up however suits your day.",
        ],
      },
      daily: [log, protein, steps],
      weekly: [lesson(), weighIn, checkin(["What was your average daily step count?", "When in your day can you fit an extra 10-minute walk?"])],
      milestone: "Steps are now a daily habit, not an occasional extra.",
    },
    {
      week: 4,
      title: "Start strength training",
      objective: "Complete two full-body strength workouts this week alongside your daily habits.",
      lesson: {
        title: "Lift to keep what you've got",
        body: [
          "Strength training sends a signal to keep muscle while you lose fat. Without it, a larger share of the weight you lose can come from muscle, which lowers strength and makes it easier to regain fat later.",
          "The Physical Activity Guidelines recommend muscle-strengthening activity on two or more days a week. Two simple full-body sessions are enough to start: a squat or leg press, a push, a pull, a hip hinge and a carry or core exercise.",
          "Pick weights you can lift with good form for 8–12 repetitions, stopping with a couple of reps left in the tank. Add a little weight or a rep when it feels easier.",
        ],
      },
      daily: [log, protein, steps, strength2],
      weekly: [
        lesson(),
        weighIn,
        { key: "choose-program", kind: "habit", title: "Choose a strength program", detail: "Any full-body beginner program works.", href: "/train/programs" },
        checkin(["How did your first strength sessions feel?", "What is your weight trend over the past three weeks?"]),
      ],
      milestone: "Your first two strength sessions done: you're training, not just dieting.",
    },
    {
      week: 5,
      title: "Volume and fibre",
      objective: "Add vegetables or fruit to two meals a day to eat more food for fewer calories.",
      lesson: {
        title: "Eat more, not less, of the right things",
        body: [
          "Vegetables, fruit, beans and whole grains are high in fibre and water, so they fill you up for relatively few calories. Most adults eat far less than the recommended 2½ cups of vegetables and 2 cups of fruit a day.",
          "Aim for around 25–34 g of fibre a day. Increase gradually and drink enough fluids so your gut can adjust.",
          "A simple plate: half vegetables or salad, a quarter protein, a quarter whole grains or potatoes. You don't need to remove anything from the plate; just add colour first.",
        ],
      },
      daily: [log, protein, steps, strength2, veg],
      weekly: [
        lesson(),
        weighIn,
        { key: "grocery-veg", kind: "grocery", title: "Stock up on easy vegetables", detail: "Add bagged salad, frozen vegetables or fruit you'll actually eat.", href: "/nutrition/grocery" },
        checkin(["Which vegetables were easiest to add?", "How full did you feel after meals this week?"]),
      ],
      milestone: "Half the plate is plants at two meals a day.",
    },
    {
      week: 6,
      title: "Sleep",
      objective: "Wind down before your target bedtime each night and protect at least 7 hours of sleep.",
      lesson: {
        title: "Sleep is part of the plan",
        body: [
          "Short sleep raises appetite, especially for high-calorie foods, reduces energy for movement and makes it harder to keep muscle while dieting. Adults are advised to get at least 7 hours a night.",
          "A consistent wake time, a dark and cool room, and less caffeine after early afternoon all help. A 30-minute wind-down without bright screens tells your body the day is ending.",
          "You won't control every night, especially with young children or shift work. Aim for a good pattern across the week rather than a perfect night.",
        ],
      },
      daily: [log, protein, steps, strength2, veg, sleep],
      weekly: [lesson(), weighIn, checkin(["How many nights did you get 7 hours or more?", "What helps you wind down?"])],
      milestone: "Six weeks in: halfway, with the full set of foundations in place.",
    },
    {
      week: 7,
      title: "Hunger, cravings and no food bans",
      objective: "Add a third strength session and practise eating your favourite foods on purpose, in portions that fit.",
      lesson: {
        title: "Nothing is off limits",
        body: [
          "Banning foods often backfires: the food becomes more tempting, and one bite can feel like failure. Planning a portion of a food you love, and enjoying it without guilt, usually works better than willpower.",
          "Hunger is normal in a deficit, but it shouldn't be constant or extreme. Protein, fibre, water, enough sleep and regular meals all reduce it. If you're ravenous every day, your deficit may be too large for you; check your targets.",
          "Cravings often follow stress, tiredness or boredom rather than real hunger. Pausing to ask 'am I hungry, or something else?' is a skill that gets easier with practice.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep],
      weekly: [
        lesson(),
        weighIn,
        { key: "planned-treat", kind: "habit", title: "Plan and enjoy a favourite food", detail: "Log it, eat it slowly, and move on. No compensating the next day.", href: "/nutrition" },
        checkin(["When did cravings show up this week, and what was going on?", "How did your planned treat feel?"]),
      ],
      milestone: "Three strength sessions a week and a calmer relationship with food.",
    },
    {
      week: 8,
      title: "Weekends and eating out",
      objective: "Keep your habits through weekends and social meals by planning ahead.",
      lesson: {
        title: "Your week has seven days",
        body: [
          "Many people are on track Monday to Friday and then eat back much of the week's deficit over the weekend. You don't need to be stricter; you need a plan that works with real life.",
          "Before a social meal, look at the menu, choose a protein-based main with vegetables, and decide in advance about extras such as dessert or drinks. Eating normally earlier in the day works better than skipping meals and arriving starving.",
          "Weekly totals matter more than any single meal. A meal out is a normal part of life, not a setback.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep],
      weekly: [
        lesson(),
        weighIn,
        { key: "weekend-plan", kind: "meal_plan", title: "Plan your weekend meals", detail: "Include any meals out or social events.", href: "/nutrition/planner" },
        checkin(["How did the weekend go compared to weekdays?", "What helped most at a social meal?"]),
      ],
      milestone: "A weekend handled with a plan, not a restart on Monday.",
    },
    {
      week: 9,
      title: "Drinks",
      objective: "Reach your water goal daily and look honestly at sugary drinks and alcohol.",
      lesson: {
        title: "Liquid calories add up quietly",
        body: [
          "Drinks such as soda, juice, sweetened coffees and alcohol can supply a lot of energy without making you feel full. They are one of the easiest places to make a difference without feeling deprived.",
          "Guidance is to keep added sugars below about 10% of daily calories and, if you drink alcohol, to keep it moderate or less. Alcohol also tends to disrupt sleep and loosen food decisions.",
          "Water is the default. Sparkling water, tea, coffee and sugar-free drinks are fine swaps. Being well hydrated can also make it easier to tell thirst from hunger.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep, water],
      weekly: [lesson(), weighIn, checkin(["Which drink swap did you make?", "How many days did you reach your water goal?"])],
      milestone: "Every daily habit in place: protein, plants, steps, strength, sleep and water.",
    },
    {
      week: 10,
      title: "Plateaus and patience",
      objective: "Review your weight trend over the past nine weeks and adjust calmly if needed.",
      lesson: {
        title: "Stalls are normal",
        body: [
          "Weight loss is never a straight line. Water retention from stress, salty meals, a new training stimulus or the menstrual cycle can hide fat loss for a week or two.",
          "Look at at least three weekly weigh-ins before deciding anything. If the trend has truly been flat for three or four weeks, first check that logging has stayed accurate and steps haven't dropped. As you get lighter your needs fall a little, so update your weight in the app and let it recalculate your target. Avoid cutting further on your own.",
          "Other signs of progress count too: how clothes fit, strength going up, more energy, better sleep and steadier hunger.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep, water],
      weekly: [
        lesson(),
        weighIn,
        { key: "trend-review", kind: "habit", title: "Review your trend and update your weight", detail: "Compare your weekly weigh-ins and let the app recalculate your target.", href: "/nutrition" },
        checkin(["What does your trend show over the last month?", "Which non-scale progress have you noticed?"]),
      ],
      milestone: "You can read your own trend and respond calmly.",
    },
    {
      week: 11,
      title: "Planning for real life",
      objective: "Plan a week of meals and shop for it, so your habits run on routine rather than willpower.",
      lesson: {
        title: "Systems beat motivation",
        body: [
          "Motivation rises and falls. A plan for the week, a shopping list and a few prepared meals keep you on track on days you don't feel like it.",
          "Start with what you already eat. Choose a few repeatable breakfasts and lunches, three or four dinners, and a couple of snacks with protein and fibre.",
          "Leave some flexibility: a night off from cooking, a meal out, leftovers. A plan that matches your actual week is one you'll follow.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep, water],
      weekly: [
        lesson(),
        weighIn,
        { key: "plan-week", kind: "meal_plan", title: "Plan this week's meals", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Build and shop your grocery list", href: "/nutrition/grocery" },
        checkin(["How much easier was the week with a plan?", "Which planned meal will you repeat?"]),
      ],
      milestone: "A weekly planning routine that can carry you beyond this program.",
    },
    {
      week: 12,
      title: "Moving to maintenance",
      objective: "Decide your next step: continue a moderate deficit, or take a maintenance phase while keeping every habit.",
      lesson: {
        title: "Keeping it off is the real goal",
        body: [
          "Long dieting phases are tiring. Many people do well alternating a few months of moderate deficit with a few weeks or months at maintenance, where you eat roughly what you use and keep training.",
          "The habits that got you here are the same ones that keep weight off: protein, plants, daily steps, strength training, sleep and planning. Logging can become lighter, such as tracking a few days a week, once the pattern is familiar.",
          "Keep weighing in weekly. If your trend starts to creep up over several weeks, you'll notice early and can adjust calmly.",
        ],
      },
      daily: [log, protein, steps, strength3, veg, sleep, water],
      weekly: [
        lesson(),
        weighIn,
        { key: "next-phase", kind: "habit", title: "Choose your next phase", detail: "Update your goal in the app to continue losing or to maintain.", href: "/nutrition" },
        checkin(["What has changed most for you over twelve weeks?", "Which habits will you keep for the next three months?", "What support would help you maintain?"]),
      ],
      milestone: "Program complete: twelve weeks of habits built to last.",
    },
  ],
  needsProfessionalReview: {
    who: "Registered dietitian",
    why: "Weight-loss guidance, protein ranges and rate-of-loss advice should be checked for safety and suitability, including how the program signposts people with medical conditions or a history of disordered eating.",
  },
};
