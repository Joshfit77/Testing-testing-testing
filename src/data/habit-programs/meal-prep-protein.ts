import type { HabitActivity, HabitProgram } from "@/lib/domain/habit-programs";
import { checkin, COMPLETION_80, FOOD_FIRST_NOTE, lesson, PROFESSIONAL_NOTE } from "./shared";

const protein: HabitActivity = {
  key: "protein",
  kind: "protein",
  title: "Reach your protein goal",
  detail: "Aim for your per-meal protein target at each main meal.",
  href: "/nutrition",
};
const prepped: HabitActivity = {
  key: "prepped-meal",
  kind: "habit",
  title: "Eat one meal you planned or prepared",
  detail: "A prepared lunch, a planned dinner or leftovers you cooked on purpose.",
  href: "/nutrition/planner",
};

export const MEAL_PREP_PROTEIN: HabitProgram = {
  slug: "meal-prep-protein",
  name: "Meal Prep and Protein Planning",
  summary: "Six weeks to build a weekly routine: plan, shop and prep meals with enough protein, safely and on budget.",
  description:
    "Most nutrition goals fail on busy days, not because of missing knowledge. This program builds a simple weekly system: plan your meals, shop from a list and prepare food ahead, with protein at the centre of each meal. Daily habits stay light; the real work happens in one or two planning and prep sessions each week, and you finish with a routine you can repeat.",
  category: "nutrition",
  level: "all",
  days: 42,
  schedule: "A weekly plan, shop and prep session for 6 weeks, with light daily habits",
  equipment: ["Food storage containers with lids", "A sheet pan or large pot", "Labels or a marker"],
  instructions: [
    "Choose a regular planning day and a prep day (they can be the same). Weekend afternoons suit many people.",
    "Set your daily protein goal and your per-meal target below.",
    "Start small: three prepared meals in week one is a win.",
    "Follow the food-safety steps in week four; they matter more than any recipe.",
    "If you have a medical condition, are pregnant, or have a history of disordered eating, speak to your doctor or a registered dietitian before changing your diet.",
  ],
  goalFields: [
    { key: "protein_g", label: "Protein", unit: "g/day", min: 40, max: 250, default: 120, help: "Active people commonly use about 1.4–2.0 g per kg of body weight a day." },
    { key: "protein_per_meal_g", label: "Protein per meal", unit: "g", min: 15, max: 60, default: 30, help: "About 20–40 g per meal suits most adults; roughly 0.25–0.4 g per kg of body weight." },
    { key: "prepped_meals", label: "Prepared meals per week", unit: "meals", min: 3, max: 21, default: 8, help: "Start with a few and build up. Leftovers count." },
  ],
  completion: COMPLETION_80,
  weeks: [
    {
      week: 1,
      title: "Know your protein",
      objective: "Learn which foods give you a good protein serving and plan three dinners around them.",
      lesson: {
        title: "Building a meal around protein",
        body: [
          "Start each meal plan by choosing the protein, then add vegetables and a carbohydrate. That simple order makes it hard to end up with a meal that is mostly bread or pasta.",
          "Roughly 20–40 g of protein per meal suits most adults. As a rough guide: 100 g of cooked chicken breast gives around 30 g, three eggs about 18 g, a 170 g pot of Greek yoghurt about 15–17 g, and a cup of cooked lentils about 18 g. Check exact values in the food diary.",
          "Mix animal and plant proteins as you like; beans, lentils, tofu and tempeh are cheap, keep well and add fibre. " + FOOD_FIRST_NOTE,
          PROFESSIONAL_NOTE,
        ],
      },
      daily: [protein],
      weekly: [
        lesson(),
        { key: "plan-dinners", kind: "meal_plan", title: "Plan three dinners", detail: "Pick the protein first for each one.", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop for your three dinners", detail: "Generate the list from your plan.", href: "/nutrition/grocery" },
        checkin(["Which protein foods do you enjoy most?", "Which day of the week works best for planning?"]),
      ],
      milestone: "Your first plan and shopping list, built around protein.",
    },
    {
      week: 2,
      title: "Batch-cook one protein",
      objective: "Cook one protein in bulk and use it in at least three meals this week.",
      lesson: {
        title: "Cook once, eat three times",
        body: [
          "Batch cooking a single protein is the easiest place to start. Roast a tray of chicken thighs, cook a pot of chilli or lentils, bake tofu, or hard-boil a dozen eggs.",
          "Then use it different ways: in a salad, a wrap, a rice bowl, a pasta dish. Plain seasonings keep it flexible; add sauces when you serve.",
          "Cooked food should go into the fridge within two hours and be eaten within three to four days. Freeze portions you won't get to by then.",
        ],
      },
      daily: [protein, prepped],
      weekly: [
        lesson(),
        { key: "plan-week", kind: "meal_plan", title: "Plan meals that use your batch protein", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop from your list", href: "/nutrition/grocery" },
        { key: "batch-protein", kind: "meal_prep", title: "Batch-cook one protein", detail: "Enough for at least three meals.", href: "/nutrition/recipes" },
        checkin(["What did you batch-cook?", "How did you use it during the week?"]),
      ],
      milestone: "One prep session saved you cooking several times.",
    },
    {
      week: 3,
      title: "Breakfasts and lunches ahead",
      objective: "Prepare breakfasts or lunches for at least three workdays.",
      lesson: {
        title: "The meals that usually go wrong",
        body: [
          "Dinner is often planned; breakfast and lunch are where people skip, grab something low in protein, or buy on the go. Preparing them ahead removes the decision.",
          "Ideas that keep well: overnight oats with milk and Greek yoghurt, egg muffins, grain bowls with beans or chicken, pasta salads with tuna, wraps assembled on the day from prepped fillings.",
          "Keep wet and dry parts separate where you can (dressing apart from salad, sauce apart from rice) so meals stay fresh for several days.",
        ],
      },
      daily: [protein, prepped],
      weekly: [
        lesson(),
        { key: "plan-week", kind: "meal_plan", title: "Plan breakfasts and lunches for three days", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop from your list", href: "/nutrition/grocery" },
        { key: "prep-lunches", kind: "meal_prep", title: "Prepare three breakfasts or lunches", href: "/nutrition/recipes" },
        checkin(["Which prepared meal held up best?", "Did having it ready change what you ate?"]),
      ],
      milestone: "Breakfast and lunch are planned, not improvised.",
    },
    {
      week: 4,
      title: "Food safety and storage",
      objective: "Store, label and reheat prepared food safely, and use the freezer for later in the week.",
      lesson: {
        title: "Safe prep is good prep",
        body: [
          "Cool cooked food quickly and refrigerate it within two hours (one hour on a very hot day). Shallow containers cool faster than one deep pot. Keep the fridge at 5°C (40°F) or below.",
          "Most cooked leftovers are best eaten within three to four days. Label containers with the date. Freeze anything you won't eat in time; frozen meals keep well for two to three months for best quality.",
          "Reheat until steaming hot all the way through, about 74°C (165°F). Thaw frozen meals in the fridge, not on the counter, and reheat only once.",
        ],
      },
      daily: [protein, prepped],
      weekly: [
        lesson(),
        { key: "plan-week", kind: "meal_plan", title: "Plan the week, including freezer meals", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop from your list", href: "/nutrition/grocery" },
        { key: "prep-freeze", kind: "meal_prep", title: "Prep and freeze at least two portions", detail: "Label each with the date and contents." },
        checkin(["How did you organise your fridge and freezer?", "Did anything go to waste this week?"]),
      ],
      milestone: "A safe system: labelled, dated and rotated.",
    },
    {
      week: 5,
      title: "Variety and budget",
      objective: "Try two new recipes and plan a week that stays within your budget.",
      lesson: {
        title: "Keeping it interesting and affordable",
        body: [
          "Eating the same prepped meal five days running is where many people give up. Prep components instead (a protein, a grain, roasted vegetables, a sauce) and combine them differently each day.",
          "Protein on a budget: eggs, milk, Greek yoghurt, tinned fish, beans, lentils, chicken thighs, frozen fish and minced meat bought in bulk. Frozen vegetables and fruit are nutritious and reduce waste.",
          "Plan around what you already have, check the cupboard before shopping, and use leftovers deliberately. Planning is one of the most effective ways to cut food spending.",
        ],
      },
      daily: [protein, prepped],
      weekly: [
        lesson(),
        { key: "new-recipes", kind: "habit", title: "Choose two new recipes", detail: "One high-protein, one built on beans or lentils.", href: "/nutrition/recipes" },
        { key: "plan-week", kind: "meal_plan", title: "Plan a full week using components", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop to a budget", detail: "Check what you already have first.", href: "/nutrition/grocery" },
        { key: "prep-components", kind: "meal_prep", title: "Prep components: a protein, a grain, vegetables and a sauce" },
        checkin(["Which new recipe will you keep?", "How did your spending compare with a usual week?"]),
      ],
      milestone: "A varied week of prepared food within your budget.",
    },
    {
      week: 6,
      title: "Your repeatable system",
      objective: "Run a full week on your system and save it as a template you can reuse.",
      lesson: {
        title: "Make the system yours",
        body: [
          "The best routine is the one you'll still do in three months. Look back at the last five weeks: which day worked for planning, how many meals you actually prepared, and which recipes you were glad to have.",
          "Write down your default week: a planning time, a shopping list of staples, a prep session of an hour or two, and a short rotation of meals you like. Change one or two meals a week to keep it fresh.",
          "On weeks when life gets busy, fall back to the minimum: one batch protein and a bag of frozen vegetables. Something prepared beats nothing.",
        ],
      },
      daily: [protein, prepped],
      weekly: [
        lesson(),
        { key: "plan-week", kind: "meal_plan", title: "Plan a full week and save it as a template", href: "/nutrition/planner" },
        { key: "shop", kind: "grocery", title: "Shop from your staples list", href: "/nutrition/grocery" },
        { key: "prep-main", kind: "meal_prep", title: "Main prep session", detail: "Enough for your prepared-meals goal." },
        { key: "prep-top-up", kind: "meal_prep", title: "Mid-week top-up prep", detail: "A quick 20–30 minutes to refresh the fridge." },
        checkin(["What does your default week look like now?", "What is your minimum plan for a busy week?", "How has your protein intake changed?"]),
      ],
      milestone: "Program complete: a weekly system you can run without thinking.",
    },
  ],
  needsProfessionalReview: {
    who: "Registered dietitian",
    why: "Protein targets, portion estimates and food-safety storage times should be checked for accuracy and suitability for a general audience.",
  },
};
