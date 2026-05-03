export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  category: string;
}

export interface Recipe {
  display_name: string;
  servings_default: number;
  ingredients: Ingredient[];
}

export const RECIPES: Record<string, Recipe> = {
  "paneer butter masala": {
    display_name: "Paneer Butter Masala",
    servings_default: 2,
    ingredients: [
      { name: "Paneer", qty: 100, unit: "g", category: "dairy" },
      { name: "Tomatoes", qty: 1.5, unit: "nos", category: "vegetables" },
      { name: "Butter", qty: 25, unit: "g", category: "dairy" },
      { name: "Fresh Cream", qty: 50, unit: "ml", category: "dairy" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Ginger Garlic Paste", qty: 1, unit: "tsp", category: "condiments" },
      { name: "Kashmiri Chilli Powder", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Garam Masala", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Kasuri Methi", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "dal tadka": {
    display_name: "Dal Tadka",
    servings_default: 2,
    ingredients: [
      { name: "Toor Dal", qty: 60, unit: "g", category: "pulses" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Tomatoes", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Ghee", qty: 1, unit: "tbsp", category: "dairy" },
      { name: "Ginger Garlic Paste", qty: 0.5, unit: "tsp", category: "condiments" },
      { name: "Cumin Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Turmeric Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Red Chilli Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Coriander Leaves", qty: 5, unit: "g", category: "vegetables" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "veg biryani": {
    display_name: "Veg Biryani",
    servings_default: 2,
    ingredients: [
      { name: "Basmati Rice", qty: 100, unit: "g", category: "grains" },
      { name: "Mixed Vegetables (Frozen)", qty: 100, unit: "g", category: "vegetables" },
      { name: "Onion", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Yogurt", qty: 50, unit: "g", category: "dairy" },
      { name: "Ghee", qty: 1.5, unit: "tbsp", category: "dairy" },
      { name: "Biryani Masala", qty: 1, unit: "tbsp", category: "spices" },
      { name: "Saffron", qty: 0.1, unit: "g", category: "spices" },
      { name: "Mint Leaves", qty: 10, unit: "g", category: "vegetables" },
      { name: "Coriander Leaves", qty: 5, unit: "g", category: "vegetables" },
      { name: "Bay Leaves", qty: 1, unit: "nos", category: "spices" },
      { name: "Whole Spices (Cloves, Cardamom, Cinnamon)", qty: 1, unit: "set", category: "spices" },
    ],
  },
  "aloo gobi": {
    display_name: "Aloo Gobi",
    servings_default: 2,
    ingredients: [
      { name: "Potato", qty: 150, unit: "g", category: "vegetables" },
      { name: "Cauliflower", qty: 150, unit: "g", category: "vegetables" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Tomatoes", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Cooking Oil", qty: 1.5, unit: "tbsp", category: "oils" },
      { name: "Cumin Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Turmeric Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Coriander Powder", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Red Chilli Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Garam Masala", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "rajma": {
    display_name: "Rajma",
    servings_default: 2,
    ingredients: [
      { name: "Rajma (Kidney Beans)", qty: 75, unit: "g", category: "pulses" },
      { name: "Onion", qty: 0.75, unit: "nos", category: "vegetables" },
      { name: "Tomatoes", qty: 1.5, unit: "nos", category: "vegetables" },
      { name: "Ginger Garlic Paste", qty: 1, unit: "tsp", category: "condiments" },
      { name: "Cooking Oil", qty: 1.5, unit: "tbsp", category: "oils" },
      { name: "Rajma Masala", qty: 1, unit: "tbsp", category: "spices" },
      { name: "Turmeric Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Cumin Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Coriander Leaves", qty: 5, unit: "g", category: "vegetables" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "pasta arrabbiata": {
    display_name: "Pasta Arrabbiata",
    servings_default: 2,
    ingredients: [
      { name: "Penne Pasta", qty: 80, unit: "g", category: "grains" },
      { name: "Canned Tomatoes (Crushed)", qty: 200, unit: "g", category: "condiments" },
      { name: "Garlic", qty: 2, unit: "cloves", category: "vegetables" },
      { name: "Olive Oil", qty: 1.5, unit: "tbsp", category: "oils" },
      { name: "Dried Red Chillies", qty: 1, unit: "nos", category: "spices" },
      { name: "Fresh Basil", qty: 5, unit: "g", category: "vegetables" },
      { name: "Parmesan Cheese", qty: 20, unit: "g", category: "dairy" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Black Pepper", qty: 0.25, unit: "tsp", category: "spices" },
    ],
  },
  "poha": {
    display_name: "Poha",
    servings_default: 2,
    ingredients: [
      { name: "Flattened Rice (Poha)", qty: 75, unit: "g", category: "grains" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Potato", qty: 75, unit: "g", category: "vegetables" },
      { name: "Green Chillies", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Cooking Oil", qty: 1, unit: "tbsp", category: "oils" },
      { name: "Mustard Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Curry Leaves", qty: 5, unit: "nos", category: "spices" },
      { name: "Turmeric Powder", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Lemon", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Coriander Leaves", qty: 5, unit: "g", category: "vegetables" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "upma": {
    display_name: "Upma",
    servings_default: 2,
    ingredients: [
      { name: "Semolina (Rava/Sooji)", qty: 75, unit: "g", category: "grains" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Cooking Oil", qty: 1, unit: "tbsp", category: "oils" },
      { name: "Mustard Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Urad Dal", qty: 0.5, unit: "tsp", category: "pulses" },
      { name: "Curry Leaves", qty: 5, unit: "nos", category: "spices" },
      { name: "Green Chillies", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Ginger", qty: 0.5, unit: "tsp", category: "vegetables" },
      { name: "Cashews", qty: 8, unit: "nos", category: "dry fruits" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "chole": {
    display_name: "Chole (Chana Masala)",
    servings_default: 2,
    ingredients: [
      { name: "Chickpeas (Kabuli Chana)", qty: 75, unit: "g", category: "pulses" },
      { name: "Onion", qty: 0.75, unit: "nos", category: "vegetables" },
      { name: "Tomatoes", qty: 1.5, unit: "nos", category: "vegetables" },
      { name: "Ginger Garlic Paste", qty: 1, unit: "tsp", category: "condiments" },
      { name: "Cooking Oil", qty: 1.5, unit: "tbsp", category: "oils" },
      { name: "Chole Masala", qty: 1, unit: "tbsp", category: "spices" },
      { name: "Amchur Powder", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Tea Bags", qty: 1, unit: "nos", category: "beverages" },
      { name: "Coriander Leaves", qty: 5, unit: "g", category: "vegetables" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
  "palak paneer": {
    display_name: "Palak Paneer",
    servings_default: 2,
    ingredients: [
      { name: "Spinach (Palak)", qty: 150, unit: "g", category: "vegetables" },
      { name: "Paneer", qty: 100, unit: "g", category: "dairy" },
      { name: "Onion", qty: 0.5, unit: "nos", category: "vegetables" },
      { name: "Tomatoes", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Ginger Garlic Paste", qty: 1, unit: "tsp", category: "condiments" },
      { name: "Cooking Oil", qty: 1, unit: "tbsp", category: "oils" },
      { name: "Fresh Cream", qty: 25, unit: "ml", category: "dairy" },
      { name: "Cumin Seeds", qty: 0.5, unit: "tsp", category: "spices" },
      { name: "Garam Masala", qty: 0.25, unit: "tsp", category: "spices" },
      { name: "Green Chillies", qty: 1, unit: "nos", category: "vegetables" },
      { name: "Salt", qty: 0.5, unit: "tsp", category: "spices" },
    ],
  },
};

const ALIASES: Record<string, string> = {
  "butter paneer": "paneer butter masala",
  "paneer makhani": "paneer butter masala",
  "dal fry": "dal tadka",
  "biryani": "veg biryani",
  "vegetable biryani": "veg biryani",
  "aloo cauliflower": "aloo gobi",
  "kidney beans": "rajma",
  "pasta": "pasta arrabbiata",
  "arrabbiata": "pasta arrabbiata",
  "flattened rice": "poha",
  "rava upma": "upma",
  "chana masala": "chole",
  "chickpea curry": "chole",
  "spinach paneer": "palak paneer",
  "saag paneer": "palak paneer",
};

export function findRecipe(query: string): [string, Recipe] | [null, null] {
  const q = query.trim().toLowerCase();
  if (RECIPES[q]) return [q, RECIPES[q]];
  if (ALIASES[q]) return [ALIASES[q], RECIPES[ALIASES[q]]];
  // Partial match
  for (const key of Object.keys(RECIPES)) {
    if (key.includes(q) || q.includes(key)) return [key, RECIPES[key]];
  }
  return [null, null];
}

export function listRecipes(): Array<{ key: string; display_name: string }> {
  return Object.entries(RECIPES).map(([key, r]) => ({ key, display_name: r.display_name }));
}

/** Register an AI-parsed recipe so subsequent findRecipe() calls hit it instantly. */
export function registerRecipe(key: string, recipe: Recipe): void {
  RECIPES[key] = recipe;
}
