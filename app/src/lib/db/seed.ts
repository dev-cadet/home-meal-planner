/**
 * Demo/dev seed data — a realistic household's worth of meals, plans and a
 * week's schedule.
 *
 * Destructive by design: every domain table is cleared first. Shared between
 * `scripts/seed.ts` (manual/CLI use) and startup seeding (`SEED_ON_START`,
 * see instrumentation.ts) — never run against real data.
 */
import { eq } from "drizzle-orm";

import { addDays, startOfWeek, todayInAppTimeZone, type IsoDate } from "../date";
import { processMealImage } from "../images/process";
import { writeMealTags } from "../tags/write";
import { inviteCode } from "../id";
import type { Database } from "./client";
import {
  inviteCode as inviteCodeTable,
  meal,
  mealImage,
  mealIngredient,
  mealPin,
  mealStep,
  mealTag,
  plan,
  planItem,
  planPin,
  scheduleEntry,
  tag,
  user,
} from "./schema";

interface SeedMeal {
  name: string;
  tags: string[];
  steps: string[];
  servings: number;
  prepMins?: number;
  cookMins?: number;
  ingredients: [quantity: number, unit: string, name: string][];
}

const MEALS: SeedMeal[] = [
  {
    name: "Thai green chicken curry",
    tags: ["thai", "spicy", "quick"],
    steps: [
      "Fry the green curry paste in a splash of oil until fragrant.",
      "Add the chicken and cook until sealed on all sides.",
      "Pour in the coconut milk and simmer for 15 minutes.",
      "Stir in the green beans and aubergine, cook until tender.",
      "Season with fish sauce and a squeeze of lime, serve over rice.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 25,
    ingredients: [
      [400, "ml", "coconut milk"],
      [3, "tbsp", "green curry paste"],
      [500, "g", "chicken thigh"],
      [200, "g", "green beans"],
      [1, "piece", "aubergine"],
      [2, "tbsp", "fish sauce"],
      [300, "g", "jasmine rice"],
      [1, "piece", "lime"],
    ],
  },
  {
    name: "Spaghetti bolognese",
    tags: ["italian", "comfort-food", "batch-cook"],
    steps: [
      "Soften the onion, carrot and garlic in olive oil.",
      "Add the mince and brown it well.",
      "Stir in the tomato puree, tomatoes and red wine.",
      "Simmer uncovered for at least an hour, stirring occasionally.",
      "Cook the spaghetti and toss through with parmesan.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 90,
    ingredients: [
      [500, "g", "beef mince"],
      [2, "piece", "onion"],
      [3, "clove", "garlic"],
      [2, "piece", "carrot"],
      [400, "g", "chopped tomatoes"],
      [2, "tbsp", "tomato puree"],
      [150, "ml", "red wine"],
      [400, "g", "spaghetti"],
      [50, "g", "parmesan"],
    ],
  },
  {
    name: "Shakshuka",
    tags: ["breakfast", "vegetarian", "mediterranean"],
    steps: [
      "Fry the onion and red pepper until soft.",
      "Add garlic, paprika and cumin, cook for a minute.",
      "Pour in the tomatoes and simmer for 10 minutes.",
      "Make wells in the sauce and crack in the eggs.",
      "Cover and cook until the whites are set. Serve with sourdough.",
    ],
    servings: 2,
    prepMins: 10,
    cookMins: 25,
    ingredients: [
      [4, "piece", "egg"],
      [400, "g", "chopped tomatoes"],
      [1, "piece", "red pepper"],
      [1, "piece", "onion"],
      [2, "clove", "garlic"],
      [1, "tsp", "smoked paprika"],
      [1, "tsp", "cumin"],
      [4, "slice", "sourdough"],
    ],
  },
  {
    name: "Chicken fajitas",
    tags: ["mexican", "quick", "kid-friendly"],
    steps: [
      "Slice the chicken and vegetables into strips.",
      "Toss with paprika and cumin.",
      "Stir-fry over high heat until charred at the edges.",
      "Warm the tortillas and build your own with soured cream and lime.",
    ],
    servings: 4,
    prepMins: 20,
    cookMins: 15,
    ingredients: [
      [600, "g", "chicken breast"],
      [2, "piece", "red pepper"],
      [1, "piece", "onion"],
      [8, "piece", "tortilla"],
      [1, "tsp", "smoked paprika"],
      [1, "tsp", "cumin"],
      [150, "ml", "soured cream"],
      [1, "piece", "lime"],
    ],
  },
  {
    name: "Red lentil dhal",
    tags: ["indian", "vegan", "batch-cook", "one-pot"],
    steps: [
      "Soften the onion, garlic and ginger.",
      "Stir in the garam masala and turmeric, cook for a minute.",
      "Add the lentils, stock and coconut milk.",
      "Simmer for 25 minutes, stirring occasionally.",
      "Stir through the spinach until wilted.",
    ],
    servings: 4,
    prepMins: 10,
    cookMins: 35,
    ingredients: [
      [300, "g", "red lentils"],
      [1, "piece", "onion"],
      [3, "clove", "garlic"],
      [20, "g", "ginger"],
      [2, "tsp", "garam masala"],
      [1, "tsp", "turmeric"],
      [400, "ml", "coconut milk"],
      [500, "ml", "vegetable stock"],
      [200, "g", "spinach"],
    ],
  },
  {
    name: "Roast chicken dinner",
    tags: ["british", "comfort-food"],
    steps: [
      "Rub the chicken with butter, season well and stuff with lemon.",
      "Roast the potatoes and carrots alongside.",
      "Roast at 200°C for around 90 minutes until the juices run clear.",
      "Rest for 15 minutes before carving. Keep the carcass for stock.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 90,
    ingredients: [
      [1.6, "kg", "whole chicken"],
      [1, "kg", "potato"],
      [4, "piece", "carrot"],
      [1, "piece", "lemon"],
      [50, "g", "butter"],
      [2, "tbsp", "olive oil"],
    ],
  },
  {
    name: "Margherita pizza",
    tags: ["italian", "vegetarian", "kid-friendly"],
    steps: [
      "Stretch the dough into a thin base.",
      "Spread with tomato sauce and top with torn mozzarella.",
      "Bake at the highest oven setting until the crust blisters.",
      "Finish with fresh basil and a drizzle of olive oil.",
    ],
    servings: 2,
    prepMins: 20,
    cookMins: 10,
    ingredients: [
      [250, "g", "pizza dough"],
      [100, "g", "chopped tomatoes"],
      [125, "g", "mozzarella"],
      [10, "g", "basil"],
      [1, "tbsp", "olive oil"],
    ],
  },
  {
    name: "Beef tacos",
    tags: ["mexican", "quick", "spicy"],
    steps: [
      "Brown the beef mince with onion and garlic.",
      "Stir in the spices and a splash of water, simmer for 10 minutes.",
      "Warm the taco shells.",
      "Fill with beef, lettuce, cheese and salsa.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 20,
    ingredients: [
      [500, "g", "beef mince"],
      [1, "piece", "onion"],
      [2, "clove", "garlic"],
      [1, "tsp", "smoked paprika"],
      [1, "tsp", "cumin"],
      [8, "piece", "taco shell"],
      [100, "g", "cheddar"],
      [100, "g", "lettuce"],
      [100, "g", "salsa"],
    ],
  },
  {
    name: "Chicken katsu curry",
    tags: ["japanese", "comfort-food"],
    steps: [
      "Coat the chicken in flour, egg and panko breadcrumbs.",
      "Shallow-fry until golden and cooked through.",
      "Soften the onion and carrot, then stir in curry powder and flour.",
      "Add stock and simmer until thickened.",
      "Slice the chicken and serve over rice with the sauce.",
    ],
    servings: 4,
    prepMins: 20,
    cookMins: 25,
    ingredients: [
      [4, "piece", "chicken breast"],
      [100, "g", "panko breadcrumbs"],
      [1, "piece", "egg"],
      [50, "g", "plain flour"],
      [1, "piece", "onion"],
      [1, "piece", "carrot"],
      [2, "tbsp", "curry powder"],
      [500, "ml", "chicken stock"],
      [300, "g", "jasmine rice"],
    ],
  },
  {
    name: "Vegetable stir-fry",
    tags: ["vegan", "quick", "chinese", "one-pot"],
    steps: [
      "Heat a wok until smoking and add a splash of oil.",
      "Stir-fry the harder vegetables first, then the quicker-cooking ones.",
      "Add garlic and ginger for the last minute.",
      "Toss through soy sauce and sesame oil, serve with noodles.",
    ],
    servings: 3,
    prepMins: 15,
    cookMins: 10,
    ingredients: [
      [200, "g", "broccoli"],
      [2, "piece", "carrot"],
      [150, "g", "mangetout"],
      [2, "clove", "garlic"],
      [20, "g", "ginger"],
      [3, "tbsp", "soy sauce"],
      [1, "tsp", "sesame oil"],
      [250, "g", "noodles"],
    ],
  },
  {
    name: "Fish and chips",
    tags: ["british", "comfort-food", "seafood"],
    steps: [
      "Cut the potatoes into chips and parboil briefly.",
      "Fry the chips until golden, twice if you like them crisp.",
      "Dip the fish in batter and fry until crisp and cooked through.",
      "Serve with peas and a wedge of lemon.",
    ],
    servings: 2,
    prepMins: 20,
    cookMins: 25,
    ingredients: [
      [2, "piece", "cod fillet"],
      [1, "kg", "potato"],
      [150, "g", "plain flour"],
      [200, "ml", "sparkling water"],
      [200, "g", "peas"],
      [1, "piece", "lemon"],
      [1, "l", "vegetable oil"],
    ],
  },
  {
    name: "Butter chicken",
    tags: ["indian", "comfort-food", "spicy"],
    steps: [
      "Marinate the chicken in yoghurt and spices, ideally overnight.",
      "Sear the chicken until browned.",
      "Add tomatoes and simmer into a sauce.",
      "Stir in butter and cream, simmer until glossy.",
      "Serve with rice or naan.",
    ],
    servings: 4,
    prepMins: 20,
    cookMins: 30,
    ingredients: [
      [600, "g", "chicken thigh"],
      [150, "g", "yoghurt"],
      [2, "tbsp", "garam masala"],
      [400, "g", "chopped tomatoes"],
      [50, "g", "butter"],
      [100, "ml", "double cream"],
      [3, "clove", "garlic"],
      [20, "g", "ginger"],
    ],
  },
  {
    name: "Falafel wraps",
    tags: ["vegan", "mediterranean", "quick"],
    steps: [
      "Blitz chickpeas, herbs, garlic and spices in a food processor.",
      "Shape into balls and chill for 20 minutes.",
      "Fry or bake until golden and crisp.",
      "Wrap in flatbread with salad and tahini sauce.",
    ],
    servings: 4,
    prepMins: 20,
    cookMins: 15,
    ingredients: [
      [400, "g", "chickpeas"],
      [1, "piece", "onion"],
      [3, "clove", "garlic"],
      [20, "g", "parsley"],
      [2, "tsp", "cumin"],
      [4, "piece", "flatbread"],
      [100, "g", "tahini"],
      [100, "g", "mixed salad"],
    ],
  },
  {
    name: "Mushroom risotto",
    tags: ["italian", "vegetarian", "comfort-food"],
    steps: [
      "Soften the onion in butter, then add the rice and toast briefly.",
      "Add the mushrooms and cook until softened.",
      "Add hot stock a ladle at a time, stirring until absorbed.",
      "Finish with parmesan and a knob of butter.",
    ],
    servings: 4,
    prepMins: 10,
    cookMins: 30,
    ingredients: [
      [300, "g", "risotto rice"],
      [300, "g", "mushrooms"],
      [1, "piece", "onion"],
      [1, "l", "vegetable stock"],
      [50, "g", "parmesan"],
      [50, "g", "butter"],
      [100, "ml", "white wine"],
    ],
  },
  {
    name: "Pulled pork sandwiches",
    tags: ["american", "batch-cook", "comfort-food"],
    steps: [
      "Rub the pork shoulder with spices.",
      "Slow-cook for several hours until it shreds easily.",
      "Shred the meat and stir through barbecue sauce.",
      "Pile onto rolls with coleslaw.",
    ],
    servings: 6,
    prepMins: 15,
    cookMins: 240,
    ingredients: [
      [1.5, "kg", "pork shoulder"],
      [2, "tbsp", "smoked paprika"],
      [200, "g", "barbecue sauce"],
      [6, "piece", "bread roll"],
      [200, "g", "coleslaw"],
    ],
  },
  {
    name: "Greek salad with halloumi",
    tags: ["greek", "vegetarian", "quick"],
    steps: [
      "Chop the cucumber, tomatoes, pepper and red onion.",
      "Toss with olives, oregano and olive oil.",
      "Griddle the halloumi until golden on both sides.",
      "Top the salad with the warm halloumi.",
    ],
    servings: 2,
    prepMins: 15,
    cookMins: 5,
    ingredients: [
      [1, "piece", "cucumber"],
      [200, "g", "tomatoes"],
      [1, "piece", "red pepper"],
      [0.5, "piece", "red onion"],
      [80, "g", "olives"],
      [225, "g", "halloumi"],
      [2, "tbsp", "olive oil"],
      [1, "tsp", "oregano"],
    ],
  },
  {
    name: "Chicken noodle soup",
    tags: ["comfort-food", "quick"],
    steps: [
      "Soften the onion, carrot and celery in a large pot.",
      "Add stock and chicken, simmer until cooked through.",
      "Shred the chicken and return to the pot with noodles.",
      "Simmer until the noodles are tender.",
    ],
    servings: 4,
    prepMins: 10,
    cookMins: 30,
    ingredients: [
      [2, "piece", "chicken breast"],
      [1, "piece", "onion"],
      [2, "piece", "carrot"],
      [2, "piece", "celery"],
      [1.2, "l", "chicken stock"],
      [150, "g", "egg noodles"],
    ],
  },
  {
    name: "Beef chilli con carne",
    tags: ["mexican", "spicy", "batch-cook", "one-pot"],
    steps: [
      "Brown the beef mince with onion and garlic.",
      "Stir in the spices and cook for a minute.",
      "Add tomatoes, kidney beans and stock.",
      "Simmer for at least 40 minutes, stirring occasionally.",
      "Serve with rice or in a jacket potato.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 60,
    ingredients: [
      [500, "g", "beef mince"],
      [1, "piece", "onion"],
      [3, "clove", "garlic"],
      [1, "tsp", "chilli powder"],
      [1, "tsp", "cumin"],
      [400, "g", "chopped tomatoes"],
      [400, "g", "kidney beans"],
      [200, "ml", "beef stock"],
    ],
  },
  {
    name: "Salmon teriyaki with rice",
    tags: ["japanese", "seafood", "quick"],
    steps: [
      "Whisk together soy sauce, mirin, sugar and ginger.",
      "Pan-fry the salmon skin-side down until crisp.",
      "Flip, add the sauce and simmer until glossy.",
      "Serve over rice with steamed greens.",
    ],
    servings: 2,
    prepMins: 10,
    cookMins: 15,
    ingredients: [
      [2, "piece", "salmon fillet"],
      [3, "tbsp", "soy sauce"],
      [2, "tbsp", "mirin"],
      [1, "tbsp", "brown sugar"],
      [10, "g", "ginger"],
      [200, "g", "jasmine rice"],
      [150, "g", "tenderstem broccoli"],
    ],
  },
  {
    name: "Vegetable lasagne",
    tags: ["italian", "vegetarian", "comfort-food", "batch-cook"],
    steps: [
      "Roast the vegetables until tender.",
      "Make a tomato sauce and a white sauce.",
      "Layer pasta sheets, vegetables and both sauces in a dish.",
      "Top with cheese and bake until golden and bubbling.",
    ],
    servings: 6,
    prepMins: 30,
    cookMins: 45,
    ingredients: [
      [1, "piece", "aubergine"],
      [2, "piece", "courgette"],
      [1, "piece", "red pepper"],
      [400, "g", "chopped tomatoes"],
      [500, "ml", "milk"],
      [50, "g", "butter"],
      [50, "g", "plain flour"],
      [250, "g", "lasagne sheets"],
      [150, "g", "cheddar"],
    ],
  },
  {
    name: "Moroccan chickpea stew",
    tags: ["moroccan", "vegan", "batch-cook", "one-pot"],
    steps: [
      "Soften the onion, garlic and spices in oil.",
      "Add chickpeas, tomatoes and stock.",
      "Simmer for 25 minutes until thickened.",
      "Stir through apricots and coriander before serving.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 30,
    ingredients: [
      [400, "g", "chickpeas"],
      [1, "piece", "onion"],
      [3, "clove", "garlic"],
      [2, "tsp", "cumin"],
      [1, "tsp", "cinnamon"],
      [400, "g", "chopped tomatoes"],
      [500, "ml", "vegetable stock"],
      [50, "g", "dried apricots"],
      [10, "g", "coriander"],
    ],
  },
  {
    name: "Korean bibimbap",
    tags: ["korean", "spicy", "healthy"],
    steps: [
      "Cook the rice and keep warm.",
      "Sauté each vegetable separately, seasoning lightly.",
      "Fry an egg per portion, keeping the yolk soft.",
      "Assemble rice, vegetables and egg, top with gochujang.",
    ],
    servings: 2,
    prepMins: 25,
    cookMins: 15,
    ingredients: [
      [200, "g", "rice"],
      [1, "piece", "carrot"],
      [100, "g", "spinach"],
      [100, "g", "beansprouts"],
      [100, "g", "mushrooms"],
      [2, "piece", "egg"],
      [2, "tbsp", "gochujang"],
      [1, "tsp", "sesame oil"],
    ],
  },
  {
    name: "Full English breakfast",
    tags: ["breakfast", "british", "comfort-food"],
    steps: [
      "Grill the bacon and sausages until cooked through.",
      "Fry the eggs, mushrooms and tomatoes.",
      "Warm the beans.",
      "Serve everything together with toast.",
    ],
    servings: 2,
    prepMins: 10,
    cookMins: 20,
    ingredients: [
      [4, "piece", "bacon rasher"],
      [4, "piece", "sausage"],
      [4, "piece", "egg"],
      [200, "g", "mushrooms"],
      [4, "piece", "tomato"],
      [400, "g", "baked beans"],
      [4, "slice", "bread"],
    ],
  },
  {
    name: "Pancakes with berries",
    tags: ["breakfast", "vegetarian", "kid-friendly"],
    steps: [
      "Whisk the flour, milk and eggs into a smooth batter.",
      "Cook spoonfuls in a hot buttered pan until bubbles form.",
      "Flip and cook the other side until golden.",
      "Stack and top with berries and maple syrup.",
    ],
    servings: 4,
    prepMins: 10,
    cookMins: 15,
    ingredients: [
      [200, "g", "plain flour"],
      [300, "ml", "milk"],
      [2, "piece", "egg"],
      [20, "g", "butter"],
      [150, "g", "mixed berries"],
      [60, "ml", "maple syrup"],
    ],
  },
  {
    name: "Overnight oats",
    tags: ["breakfast", "vegetarian", "healthy", "quick"],
    steps: [
      "Stir the oats, milk and yoghurt together in a jar.",
      "Cover and refrigerate overnight.",
      "Top with fruit and a spoon of honey before eating.",
    ],
    servings: 1,
    prepMins: 5,
    ingredients: [
      [50, "g", "oats"],
      [100, "ml", "milk"],
      [50, "g", "yoghurt"],
      [50, "g", "mixed berries"],
      [1, "tsp", "honey"],
    ],
  },
  {
    name: "Caprese sandwich",
    tags: ["italian", "vegetarian", "quick"],
    steps: [
      "Slice the bread, tomatoes and mozzarella.",
      "Layer with basil leaves.",
      "Drizzle with olive oil and balsamic, season and serve.",
    ],
    servings: 1,
    prepMins: 10,
    ingredients: [
      [2, "slice", "sourdough"],
      [1, "piece", "tomato"],
      [125, "g", "mozzarella"],
      [10, "g", "basil"],
      [1, "tbsp", "olive oil"],
      [1, "tsp", "balsamic vinegar"],
    ],
  },
  {
    name: "Sausage and mash",
    tags: ["british", "comfort-food", "kid-friendly"],
    steps: [
      "Grill or fry the sausages until browned and cooked through.",
      "Boil the potatoes until tender, then mash with butter and milk.",
      "Make an onion gravy while the sausages cook.",
      "Serve the sausages on the mash with gravy.",
    ],
    servings: 4,
    prepMins: 10,
    cookMins: 30,
    ingredients: [
      [8, "piece", "sausage"],
      [1, "kg", "potato"],
      [50, "g", "butter"],
      [100, "ml", "milk"],
      [1, "piece", "onion"],
      [500, "ml", "beef stock"],
      [2, "tbsp", "plain flour"],
    ],
  },
  {
    name: "Prawn pad Thai",
    tags: ["thai", "seafood", "quick"],
    steps: [
      "Soak the rice noodles until just tender.",
      "Stir-fry the prawns until pink, then set aside.",
      "Scramble the egg in the same pan, then add the noodles and sauce.",
      "Toss in the prawns, beansprouts and peanuts to finish.",
    ],
    servings: 2,
    prepMins: 15,
    cookMins: 15,
    ingredients: [
      [200, "g", "rice noodles"],
      [200, "g", "king prawns"],
      [2, "piece", "egg"],
      [3, "tbsp", "fish sauce"],
      [2, "tbsp", "tamarind paste"],
      [1, "tbsp", "brown sugar"],
      [100, "g", "beansprouts"],
      [30, "g", "peanuts"],
    ],
  },
  {
    name: "Beef stroganoff",
    tags: ["comfort-food", "batch-cook"],
    steps: [
      "Fry the beef strips quickly over high heat, then set aside.",
      "Soften the onion and mushrooms in the same pan.",
      "Stir in mustard and sour cream, then return the beef.",
      "Warm through gently and serve over rice or noodles.",
    ],
    servings: 4,
    prepMins: 15,
    cookMins: 20,
    ingredients: [
      [500, "g", "beef strips"],
      [1, "piece", "onion"],
      [250, "g", "mushrooms"],
      [200, "ml", "soured cream"],
      [1, "tbsp", "dijon mustard"],
      [250, "g", "egg noodles"],
    ],
  },
  {
    name: "Chocolate brownies",
    tags: ["dessert", "vegetarian", "kid-friendly"],
    steps: [
      "Melt the chocolate and butter together.",
      "Whisk in the sugar and eggs.",
      "Fold in the flour and cocoa powder.",
      "Bake until just set with a fudgy centre, then cool before cutting.",
    ],
    servings: 12,
    prepMins: 15,
    cookMins: 25,
    ingredients: [
      [200, "g", "dark chocolate"],
      [200, "g", "butter"],
      [300, "g", "caster sugar"],
      [4, "piece", "egg"],
      [120, "g", "plain flour"],
      [50, "g", "cocoa powder"],
    ],
  },
];

const PLANS: { name: string; description: string; meals: string[] }[] = [
  {
    name: "Weeknight favourites",
    description: "Nothing here takes more than half an hour of actual work.",
    meals: ["Thai green chicken curry", "Chicken fajitas", "Vegetable stir-fry", "Beef tacos"],
  },
  {
    name: "Batch cook Sunday",
    description: "Cook once, eat three times.",
    meals: [
      "Spaghetti bolognese",
      "Beef chilli con carne",
      "Moroccan chickpea stew",
      "Vegetable lasagne",
    ],
  },
  {
    name: "Vegetarian week",
    description: "A week without meat, and nobody will miss it.",
    meals: [
      "Red lentil dhal",
      "Mushroom risotto",
      "Vegetable lasagne",
      "Greek salad with halloumi",
      "Falafel wraps",
    ],
  },
  {
    name: "Takeaway at home",
    description: "Cheaper than delivery, and just as good.",
    meals: ["Chicken katsu curry", "Butter chicken", "Prawn pad Thai", "Margherita pizza"],
  },
  {
    name: "Sunday roast & comfort",
    description: "Slow, hearty, and worth the wait.",
    meals: ["Roast chicken dinner", "Sausage and mash", "Beef stroganoff", "Fish and chips"],
  },
  {
    name: "Quick lunches",
    description: "On the table in twenty minutes or less.",
    meals: [
      "Caprese sandwich",
      "Greek salad with halloumi",
      "Chicken noodle soup",
      "Falafel wraps",
    ],
  },
  {
    name: "Weekend brunch",
    description: "No rush, no rules.",
    meals: ["Full English breakfast", "Pancakes with berries", "Overnight oats", "Shakshuka"],
  },
  {
    name: "Date night",
    description: "A bit more effort, a bit more occasion.",
    meals: [
      "Mushroom risotto",
      "Salmon teriyaki with rice",
      "Beef stroganoff",
      "Chocolate brownies",
    ],
  },
  {
    name: "Spice it up",
    description: "For when mild isn't the point.",
    meals: [
      "Thai green chicken curry",
      "Butter chicken",
      "Korean bibimbap",
      "Moroccan chickpea stew",
    ],
  },
  {
    name: "Freezer-friendly batch",
    description: "Cooks once, feeds the month.",
    meals: [
      "Spaghetti bolognese",
      "Beef chilli con carne",
      "Red lentil dhal",
      "Vegetable lasagne",
    ],
  },
];

/** Deterministic per-meal picsum.photos seed, so re-running produces the same images. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchStockPhoto(seed: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`https://picsum.photos/seed/${seed}/1200/800`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface SeedSummary {
  meals: number;
  ingredients: number;
  imagesLoaded: number;
  plans: number;
  scheduled: number;
  scheduledFrom: IsoDate;
  inviteCode: string;
  attributedTo: "existing account" | "nobody (no accounts yet)";
}

/**
 * Clear and repopulate the domain tables. Assumes migrations have already
 * run — callers own that ordering (instrumentation.ts, scripts/seed.ts).
 */
export async function seedDatabase(
  db: Database,
  inviteTtlDays: number,
): Promise<SeedSummary> {
  // Order matters: children before parents, since we are not relying on cascade.
  await db.delete(scheduleEntry);
  await db.delete(planItem);
  await db.delete(mealPin);
  await db.delete(planPin);
  await db.delete(plan);
  await db.delete(mealIngredient);
  await db.delete(mealStep);
  await db.delete(mealImage);
  await db.delete(mealTag);
  await db.delete(meal);
  await db.delete(tag);
  await db.delete(inviteCodeTable);

  /**
   * Accounts are deliberately left alone.
   *
   * Seeding must not invent a user: any account here consumes the bootstrap
   * grant, which would stop you registering as the first admin through the UI.
   * Author columns are nullable, so unattributed content is a legitimate state
   * — the same one a deleted user leaves behind, which exercises the
   * "Deleted user" rendering path for free.
   *
   * If an account already exists, the sample data is attributed to it.
   */
  const [existing] = await db.select({ id: user.id }).from(user).limit(1);
  const authorId = existing?.id ?? null;

  const mealIds = new Map<string, string>();
  let imagesLoaded = 0;

  for (const m of MEALS) {
    const [row] = await db
      .insert(meal)
      .values({
        name: m.name,
        servings: m.servings,
        prepMins: m.prepMins ?? null,
        cookMins: m.cookMins ?? null,
        createdById: authorId,
        updatedById: authorId,
      })
      .returning();

    mealIds.set(m.name, row!.id);

    await db.insert(mealIngredient).values(
      m.ingredients.map(([quantity, unit, name], position) => ({
        mealId: row!.id,
        position,
        quantity,
        unit,
        name,
      })),
    );

    await db.insert(mealStep).values(
      m.steps.map((text, position) => ({
        mealId: row!.id,
        position,
        text,
      })),
    );

    await writeMealTags(db, row!.id, m.tags);

    const bytes = await fetchStockPhoto(slugify(m.name));
    if (bytes) {
      try {
        const processed = await processMealImage(bytes);
        await db.insert(mealImage).values({
          mealId: row!.id,
          full: processed.full,
          thumb: processed.thumb,
          mime: processed.mime,
          width: processed.width,
          height: processed.height,
          hash: processed.hash,
        });
        await db.update(meal).set({ imageHash: processed.hash }).where(eq(meal.id, row!.id));
        imagesLoaded++;
      } catch {
        // Best effort — a meal without a photo is a fine seed outcome.
      }
    }
  }

  for (const p of PLANS) {
    const [row] = await db
      .insert(plan)
      .values({
        name: p.name,
        description: p.description,
        createdById: authorId,
        updatedById: authorId,
      })
      .returning();

    await db.insert(planItem).values(
      p.meals.map((name, position) => ({
        planId: row!.id,
        mealId: mealIds.get(name)!,
        position,
      })),
    );
  }

  // A week of dinners, plus a couple of breakfasts, starting from this week's first day.
  const weekStart = startOfWeek(todayInAppTimeZone());
  const dinnerRota = [
    "Spaghetti bolognese",
    "Thai green chicken curry",
    "Red lentil dhal",
    "Chicken fajitas",
    "Fish and chips",
    "Roast chicken dinner",
    "Beef chilli con carne",
  ];
  const breakfastRota = ["Full English breakfast", "Pancakes with berries"];

  await db.insert(scheduleEntry).values([
    ...dinnerRota.map((name, i) => ({
      date: addDays(weekStart, i),
      slot: "dinner" as const,
      mealId: mealIds.get(name)!,
      createdById: authorId,
      updatedById: authorId,
    })),
    ...breakfastRota.map((name, i) => ({
      date: addDays(weekStart, i),
      slot: "breakfast" as const,
      mealId: mealIds.get(name)!,
      createdById: authorId,
      updatedById: authorId,
    })),
  ]);

  // One unused invite code, so there's something to redeem right away.
  const code = inviteCode();
  await db.insert(inviteCodeTable).values({
    code,
    createdById: authorId,
    expiresAt: new Date(Date.now() + inviteTtlDays * 86_400_000),
  });

  return {
    meals: MEALS.length,
    ingredients: MEALS.reduce((n, m) => n + m.ingredients.length, 0),
    imagesLoaded,
    plans: PLANS.length,
    scheduled: dinnerRota.length + breakfastRota.length,
    scheduledFrom: weekStart,
    inviteCode: code,
    attributedTo: authorId ? "existing account" : "nobody (no accounts yet)",
  };
}
