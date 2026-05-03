import Groq from "groq-sdk";
import type { Recipe } from "../recipes/data.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a recipe ingredient extractor for an Indian grocery ordering app.

Given a recipe name, return the ingredients needed for EXACTLY ONE serving as JSON.

Use this exact schema:
{
  "found": true,
  "display_name": "Proper Recipe Name",
  "ingredients": [
    { "name": "ingredient name", "qty": <number>, "unit": "<unit>", "category": "<category>" }
  ]
}

Unit rules — use ONLY these values:
- "g" for weights (paneer, flour, vegetables by weight)
- "ml" for liquids (milk, cream, oil by volume)
- "nos" for countable whole items (tomatoes, eggs, onions)
- "tsp" for teaspoons (spices, pastes)
- "tbsp" for tablespoons (larger spice amounts, ghee)
- "cloves" for garlic cloves

Category values: vegetables, dairy, grains, pulses, spices, oils, condiments, dry fruits, beverages

Rules:
- qty is always for 1 serving (the app handles scaling)
- Be specific with ingredient names (e.g. "Kashmiri Chilli Powder" not just "chilli")
- If the input is not a real food recipe, return: {"found": false, "display_name": "", "ingredients": []}
- Return only valid JSON, no explanation text`;

interface AIRecipeResult {
  found: boolean;
  display_name: string;
  ingredients: Array<{
    name: string;
    qty: number;
    unit: string;
    category: string;
  }>;
}

// Runtime cache — avoids repeat Groq calls for the same query within a server session
const cache = new Map<string, Recipe | null>();

export async function parseRecipe(query: string): Promise<{ key: string; recipe: Recipe } | null> {
  const cacheKey = query.trim().toLowerCase();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return cached ? { key: cacheKey, recipe: cached } : null;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Recipe: ${query}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) { cache.set(cacheKey, null); return null; }

    const parsed: AIRecipeResult = JSON.parse(raw);
    if (!parsed.found || !parsed.ingredients?.length) {
      cache.set(cacheKey, null);
      return null;
    }

    const recipe: Recipe = {
      display_name: parsed.display_name,
      servings_default: 2,
      ingredients: parsed.ingredients,
    };

    cache.set(cacheKey, recipe);
    return { key: cacheKey, recipe };

  } catch (err) {
    console.error("[ai] parseRecipe failed:", err);
    cache.set(cacheKey, null);
    return null;
  }
}
