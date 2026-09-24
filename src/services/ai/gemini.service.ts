import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { Recipe, Substitution, ConversationMessage } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// Safety settings — relaxed for food/cooking content
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const SYSTEM_PROMPT = `You are an expert kitchen assistant with deep knowledge of global cuisine,
especially African dishes — Jollof Rice, Egusi Soup, Pepper Soup, Suya, Pounded Yam,
Banga Soup, Ofe Onugbu, Moi Moi, Fried Plantain, and many more.
Be warm, practical, and encouraging — like a knowledgeable friend in the kitchen.
ALWAYS respond with valid JSON only. No markdown fences, no preamble, no explanation outside the JSON.`;

export class GeminiService {
  private model = genAI.getGenerativeModel({
    model: config.gemini.model,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  });

  // ── 1. Generate full recipe ───────────────────────────────
  async generateRecipe(
    dishName: string,
    servings: number = 2,
    dietaryPreferences: string[] = [],
    allergies: string[] = []
  ): Promise<Recipe> {
    const prefs = dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(', ')}.` : '';
    const allergyNote = allergies.length > 0
      ? `NEVER include these ingredients: ${allergies.join(', ')}.` : '';

    const prompt = `${SYSTEM_PROMPT}

Generate a complete recipe for "${dishName}" for ${servings} people.
${prefs} ${allergyNote}

Return ONLY this exact JSON — no markdown, no extra text:
{
  "id": "${uuidv4()}",
  "dishName": "...",
  "description": "one sentence description",
  "cuisine": "...",
  "difficulty": "easy|medium|hard",
  "prepTimeMinutes": 0,
  "cookTimeMinutes": 0,
  "servings": ${servings},
  "ingredients": [
    { "name": "...", "amount": "...", "unit": "...", "optional": false }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "instruction": "full instruction text",
      "durationMinutes": 0,
      "notificationMessage": "max 60 chars — what to tell user at this step"
    }
  ],
  "tips": ["tip 1", "tip 2"],
  "nutrition": {
    "calories": 0,
    "proteinG": 0.0,
    "carbsG": 0.0,
    "fatG": 0.0
  }
}`;

    return await this.structuredRequest<Recipe>(prompt);
  }

  // ── 2. Scale recipe ───────────────────────────────────────
  async scaleRecipe(recipe: Recipe, newServings: number): Promise<Recipe> {
    const prompt = `${SYSTEM_PROMPT}

Scale this recipe from ${recipe.servings} to ${newServings} servings.
Adjust ALL ingredient amounts proportionally. Keep step instructions identical.
Return the complete updated recipe in the exact same JSON shape.
Original:
${JSON.stringify(recipe)}`;

    return await this.structuredRequest<Recipe>(prompt);
  }

  // ── 3. Ingredient substitution ────────────────────────────
  async getSubstitution(
    ingredient: string,
    dishName: string,
    availableIngredients: string[] = []
  ): Promise<Substitution> {
    const available = availableIngredients.length > 0
      ? `Available in their pantry: ${availableIngredients.join(', ')}.`
      : 'Suggest a common pantry substitute.';

    const prompt = `${SYSTEM_PROMPT}

The user is making "${dishName}" and doesn't have "${ingredient}". ${available}

Return ONLY this JSON:
{
  "original": "${ingredient}",
  "substitute": "...",
  "amountAdjustment": "e.g. use same amount / use 1.5x",
  "tasteImpact": "minimal|moderate|significant",
  "note": "one sentence explanation"
}`;

    return await this.structuredRequest<Substitution>(prompt);
  }

  // ── 4. Kitchen Q&A (with conversation history) ───────────
  async askQuestion(
    question: string,
    userProfile: { dietaryPreferences: string[]; allergies: string[] },
    history: ConversationMessage[] = []
  ): Promise<string> {
    const contextNote = `User dietary preferences: ${userProfile.dietaryPreferences.join(', ') || 'none'}.
Allergies: ${userProfile.allergies.join(', ') || 'none'}.`;

    // Build chat history for Gemini
    const chatHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = this.model.startChat({
      history: chatHistory,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
    });

    const conversationalPrompt = `You are an expert kitchen assistant with deep knowledge of global and African cuisine.
Be warm, concise, and practical. Respond in plain conversational text — no JSON needed here.
${contextNote}

Question: ${question}`;

    try {
      const result = await chat.sendMessage(conversationalPrompt);
      return result.response.text();
    } catch (error) {
      logger.error('Gemini chat error', { error });
      throw new Error('AI service error: failed to get response');
    }
  }

  // ── 5. Suggest dishes from ingredients ───────────────────
  async suggestDishes(ingredients: string[]): Promise<string[]> {
    const prompt = `${SYSTEM_PROMPT}

Given these ingredients: ${ingredients.join(', ')}.
Suggest 5 dishes the user can make, prioritising African dishes where possible.
Return ONLY a JSON array of dish name strings:
["Dish 1", "Dish 2", "Dish 3", "Dish 4", "Dish 5"]`;

    return await this.structuredRequest<string[]>(prompt);
  }

  // ── Internal: structured JSON request ────────────────────
  private async structuredRequest<T>(prompt: string): Promise<T> {
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Strip any accidental markdown fences Gemini adds
      const cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      return JSON.parse(cleaned) as T;
    } catch (error) {
      logger.error('Gemini API error', { error });
      throw new Error(
        `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const geminiService = new GeminiService();
