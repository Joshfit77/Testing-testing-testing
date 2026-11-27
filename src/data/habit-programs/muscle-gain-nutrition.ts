import type { HabitActivity, HabitProgram } from "@/lib/domain/habit-programs";
import { checkin, COMPLETION_80, FOOD_FIRST_NOTE, lesson, PROFESSIONAL_NOTE } from "./shared";

const log: HabitActivity = {
  key: "log-food",
  kind: "track_food",
  title: "Log what you eat today",
  detail: "Compare with the app's calorie target. For gaining, being a little under is the usual problem.",
  href: "/nutrition",
};
const train: HabitActivity = {
  key: "strength",
  kind: "workout",
  title: "Strength workout",
  detail: "Your strength program's session for today. Food builds muscle only when training gives it a reason to.",
  href: "/train",
  onDays: [1, 3, 5],
};
const protein: HabitActivity = {
  key: "protein",
  kind: "protein",
  title: "Reach your protein goal, spread over the day",
  detail: "Roughly equal portions at each meal rather than most of it at dinner.",
  href: "/nutrition",
};
const meals: HabitActivity = {
  key: "meals",
  kind: "habit",
  title: "Eat your planned number of meals and snacks",
  detail: "No skipped meals today. Keep an easy snack ready for busy moments.",
  href: "/nutrition",
};
const aroundTraining: HabitActivity = {
  key: "around-training",
  kind: "habit",
  title: "Eat a meal with protein and carbohydrate around training",
  detail: "Within a couple of hours before or after your session.",
  href: "/nutrition",
  onDays: [1, 3, 5],
};
const veg: HabitActivity = {
  key: "vegetables",
  kind: "vegetables",
  title: "Vegetables or fruit at two meals",
  detail: "Still important when you're eating more. Cooked vegetables are less filling if appetite is a struggle.",
  href: "/nutrition",
};
const sleep: HabitActivity = {
  key: "sleep",
  kind: "sleep",
  title: "Wind down for your sleep goal",
  detail: "Screens down and lights low 30 minutes before bed; same wake time every day.",
  href: "/progress/sleep",
};
const weighIn: HabitActivity = {
  key: "weigh-in",
  kind: "habit",
  title: "Weekly weigh-in",
  detail: "Same day and time each week, before eating. Watch the trend over several weeks.",
};

export const MUSCLE_GAIN_NUTRITION: HabitProgram = {
  slug: "muscle-gain-nutrition",
  name: "Muscle-Gain Nutrition",
  summary: "Eight weeks of eating to build muscle: a small surplus, protein spread across meals, and food that fuels your training.",
  description:
    "Building muscle takes three things together: progressive strength training, enough protein, and enough total energy. This program pairs with any strength program you follow three days a week and teaches you to eat a small surplus using the app's calorie target, spread protein across your meals, fuel your sessions and recover well. The aim is lean, steady gain, not bulking at any cost.",
  category: "nutrition",
  level: "all",
  days: 56,
  schedule: "Daily habits for 8 weeks alongside 3 strength workouts a week, with a weekly weigh-in and check-in",
  equipment: ["Access to a strength program in the app", "Bathroom scale (optional)"],
  instructions: [
    "Follow a strength program at the same time; food alone doesn't build muscle.",
    "Use the app's calorie target set for a small surplus. Aim to gain slowly, roughly 0.25–0.5% of your body weight a week at most.",
    "Spread your protein over three to five meals and snacks.",
    "Weigh in once a week and judge the trend over several weeks.",
    "If you have a medical condition, are pregnant, or have a history of disordered eating, speak to your doctor or a registered dietitian first.",
  ],
  goalFields: [
    { key: "protein_g", label: "Protein", unit: "g/day", min: 40, max: 250, default: 140, help: "Around 1.6–2.0 g per kg of body weight is a well-supported target when building muscle." },
    { key: "meals_per_day", label: "Meals and snacks", unit: "per day", min: 3, max: 6, default: 4, help: "Three meals plus one or two snacks makes a surplus easier to reach." },
    { key: "water_ml", label: "Water", unit: "ml/day", min: 1000, max: 5000, default: 2500, help: "Drink more on training days and in hot weather." },
    { key: "sleep_hours", label: "Sleep", unit: "hours", min: 6, max: 10, default: 8, help: "Adults need at least 7 hours; recovery from training benefits from more." },
  ],
  completion: COMPLETION_80,
  weeks: [
    {
      week: 1,
      title: "Find your starting point",
      objective: "Log your usual eating, train three times and record your starting weight.",
      lesson: {
        title: "Muscle needs a reason and the raw materials",
        body: [
          "Training is the signal to build muscle; food supplies the energy and building blocks. Without progressive training, extra food mostly becomes fat. Without enough food, training gains come slowly.",
          "A small surplus, around 5–10% above what you use (often 200–350 calories a day), supports muscle gain while limiting fat gain. The app's calorie target is set this way. A larger surplus doesn't build muscle any faster for most people.",
          "This week, log what you normally eat and see how it compares with the target. Many people who struggle to gain simply eat less than they think.",
          PROFESSIONAL_NOTE,
        ],
      },
      daily: [log, train],
      weekly: [
        lesson(),
        { key: "set-targets", kind: "habit", title: "Set your gaining goal", detail: "Update your details and goal in the app so the calorie target includes a small surplus.", href: "/nutrition" },
        weighIn,
        checkin(["How did your usual intake compare with the target?", "Which meal is usually smallest or skipped?"]),
      ],
      milestone: "Starting weight recorded and three sessions completed.",
    },
    {
      week: 2,
      title: "Protein across the day",
      objective: "Reach your protein goal with three to five roughly equal servings across the day.",
      lesson: {
        title: "How much protein, and when",
        body: [
          "The International Society of Sports Nutrition suggests 1.4–2.0 g of protein per kg of body weight a day for people who train. Going much higher brings little extra benefit for muscle.",
          "Spreading it across the day seems to work better than eating most of it at one meal. A useful guide is 0.25–0.4 g per kg per meal, which is about 20–40 g for most people, every three to four hours.",
          "Breakfast is often the weakest meal. Eggs, Greek yoghurt, milk, cottage cheese or leftovers from dinner can fix that quickly. " + FOOD_FIRST_NOTE,
        ],
      },
      daily: [log, train, protein],
      weekly: [
        lesson(),
        weighIn,
        { key: "protein-breakfast", kind: "habit", title: "Save two high-protein breakfasts", href: "/nutrition/recipes" },
        checkin(["Which meal was hardest to get protein into?", "How many meals had a good protein serving?"]),
      ],
      milestone: "Protein is spread through the day, not saved for dinner.",
    },
    {
      week: 3,
      title: "Eat enough, consistently",
      objective: "Eat your planned number of meals and snacks every day to reach the small surplus.",
      lesson: {
        title: "Making a surplus easier",
        body: [
          "If your appetite is small, gaining can feel like hard work. Eating at regular times, rather than waiting to feel hungry, helps a lot.",
          "Add energy without huge volumes: milk with meals, a handful of nuts, nut butter on toast, olive oil on vegetables, dried fruit, rice or potatoes in larger portions. Smoothies with milk, yoghurt, oats and fruit are an easy way to drink some extra calories.",
          "Aim for whole, nutritious foods most of the time. A surplus is not a reason to live on fast food; quality still matters for health and training.",
        ],
      },
      daily: [log, train, protein, meals],
      weekly: [
        lesson(),
        weighIn,
        { key: "snack-list", kind: "grocery", title: "Stock two easy, energy-dense snacks", detail: "Things you can eat on the go: yoghurt, nuts, a sandwich, milk.", href: "/nutrition/grocery" },
        checkin(["On how many days did you reach the calorie target?", "Which snack worked best?"]),
      ],
      milestone: "You're reliably eating enough to grow.",
    },
    {
      week: 4,
      title: "Fuel your training",
      objective: "Eat a meal with protein and carbohydrate within a couple of hours of each workout.",
      lesson: {
        title: "Food around your sessions",
        body: [
          "Carbohydrates are the main fuel for hard training. A meal with carbs and protein two to three hours before training, or a smaller snack an hour before, helps you train harder.",
          "After training, a meal with protein and carbohydrates supports recovery. The exact timing matters less than once thought; within a couple of hours is plenty for most people, and your total daily intake matters most.",
          "Good examples: rice, chicken and vegetables; a bagel with eggs; oats with milk and fruit; a wrap with beans and cheese.",
        ],
      },
      daily: [log, train, protein, meals, aroundTraining],
      weekly: [lesson(), weighIn, checkin(["How did training feel with food around it?", "Which pre- or post-workout meal will you repeat?"])],
      milestone: "Halfway: your training days are properly fuelled.",
    },
    {
      week: 5,
      title: "Plants still matter",
      objective: "Add vegetables or fruit to at least two meals a day while keeping the surplus.",
      lesson: {
        title: "Quality inside the surplus",
        body: [
          "Vegetables, fruit, whole grains and beans provide fibre, vitamins and minerals that support recovery and long-term health. The Dietary Guidelines suggest roughly 2½ cups of vegetables and 2 cups of fruit a day at a 2,000-calorie intake; more is fine as your intake rises.",
          "If fullness is making it hard to eat enough, choose cooked rather than raw vegetables, add fruit to breakfasts and smoothies, and include vegetables at the meals where you have the most appetite.",
          "Healthy fats from olive oil, nuts, seeds, avocado and oily fish add useful energy alongside.",
        ],
      },
      daily: [log, train, protein, meals, aroundTraining, veg],
      weekly: [lesson(), weighIn, checkin(["Which meals got vegetables or fruit?", "Did fullness get in the way of your target?"])],
      milestone: "A surplus built on good food, not just more food.",
    },
    {
      week: 6,
      title: "Sleep and recovery",
      objective: "Wind down before bed each night and protect at least 7 hours of sleep.",
      lesson: {
        title: "Muscle is built while you recover",
        body: [
          "Training breaks muscle down; recovery builds it back. Sleep is when much of that happens. Short sleep is linked with poorer recovery, lower strength and worse appetite regulation.",
          "Adults need at least 7 hours a night, and many who train hard do better with 8 or more. A consistent wake time, a dark cool room and less caffeine after early afternoon all help.",
          "A protein-containing snack before bed, such as milk or yoghurt, is a simple way to add protein if you're short for the day.",
        ],
      },
      daily: [log, train, protein, meals, aroundTraining, veg, sleep],
      weekly: [lesson(), weighIn, checkin(["How many nights did you get 7 hours or more?", "Did you notice any change in how you trained?"])],
      milestone: "Training, food and sleep working together.",
    },
    {
      week: 7,
      title: "Check your rate of gain",
      objective: "Review six weeks of weigh-ins and training numbers, and adjust your intake if needed.",
      lesson: {
        title: "Reading the trend",
        body: [
          "For most people, a sensible rate is about 0.25–0.5% of body weight a week; less if you have trained for years. A beginner might see a little more early on, partly from extra food and water in the body.",
          "If your weight has not moved over three or more weeks and training has stalled, increase intake a little: add a snack or a larger portion of carbohydrate. If you're gaining much faster than that and your waist measurement is rising quickly, ease back slightly. Update your details in the app so the target stays accurate.",
          "Strength going up across your sessions is the best sign that the gain is mostly useful.",
        ],
      },
      daily: [log, train, protein, meals, aroundTraining, veg, sleep],
      weekly: [
        lesson(),
        weighIn,
        { key: "trend-review", kind: "habit", title: "Review your weight trend and training log", detail: "Look at both together before changing anything.", href: "/train" },
        checkin(["What is your average weekly change?", "Have your main lifts gone up?"]),
      ],
      milestone: "You can judge your own progress and adjust it.",
    },
    {
      week: 8,
      title: "Make it routine",
      objective: "Plan a week of meals that hits your targets and decide your next phase.",
      lesson: {
        title: "Building for the long run",
        body: [
          "Muscle is built over months and years, not weeks. The habits from this program — enough food, protein across the day, fuel around training, plants and sleep — are the ones to keep.",
          "Planning a week of meals and snacks makes the surplus automatic. Repeat breakfasts and lunches that work, and vary dinners.",
          "After a long gaining phase, some people choose a few weeks at maintenance. Whatever you choose, keep weighing in weekly and keep training progressively.",
        ],
      },
      daily: [log, train, protein, meals, aroundTraining, veg, sleep],
      weekly: [
        lesson(),
        weighIn,
        { key: "plan-week", kind: "meal_plan", title: "Plan a week of meals and snacks", href: "/nutrition/planner" },
        checkin(["What has changed in your training over eight weeks?", "Which habits will you keep?", "Will you keep gaining or take a maintenance phase?"]),
      ],
      milestone: "Program complete: eight weeks of eating to grow.",
    },
  ],
  needsProfessionalReview: {
    who: "Registered dietitian",
    why: "Calorie surplus, protein ranges and rate-of-gain guidance should be checked for safety and suitability for a general audience, including people with medical conditions.",
  },
};
