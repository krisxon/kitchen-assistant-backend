import { supabase } from './client';
import { UserProfile } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export class UserService {

  // ── Get user profile ──────────────────────────────────────
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching profile', { userId, error });
      return null;
    }
    return this.mapProfile(data);
  }

  // ── Update FCM token ──────────────────────────────────────
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: fcmToken, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) logger.error('Error updating FCM token', { userId, error });
  }

  // ── Check freemium limits ─────────────────────────────────
  async canGenerateRecipe(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const profile = await this.getProfile(userId);
    if (!profile) return { allowed: false, remaining: 0 };
    if (profile.plan === 'premium') return { allowed: true, remaining: Infinity };

    const limit = config.freemium.freeRecipeGenerationsPerMonth;
    const used = profile.recipeGensThisMonth;
    const remaining = Math.max(0, limit - used);
    return { allowed: remaining > 0, remaining };
  }

  async canAskQuestion(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const profile = await this.getProfile(userId);
    if (!profile) return { allowed: false, remaining: 0 };
    if (profile.plan === 'premium') return { allowed: true, remaining: Infinity };

    const limit = config.freemium.freeAiQuestionsPerMonth;
    const used = profile.aiQuestionsThisMonth;
    const remaining = Math.max(0, limit - used);
    return { allowed: remaining > 0, remaining };
  }

  // ── Increment usage counters ──────────────────────────────
  async incrementRecipeGen(userId: string): Promise<void> {
    await supabase.rpc('increment_recipe_gen', { user_id: userId });
  }

  async incrementAiQuestion(userId: string): Promise<void> {
    await supabase.rpc('increment_ai_question', { user_id: userId });
  }

  // ── Save recipe to DB ─────────────────────────────────────
  async saveRecipe(userId: string, recipe: any): Promise<string | null> {
    const { data, error } = await supabase
      .from('recipes')
      .upsert({
        id: recipe.id,
        user_id: userId,
        dish_name: recipe.dishName,
        description: recipe.description,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        prep_time_minutes: recipe.prepTimeMinutes,
        cook_time_minutes: recipe.cookTimeMinutes,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tips: recipe.tips,
        nutrition: recipe.nutrition,
        is_saved: false,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving recipe', { userId, error });
      return null;
    }
    return data.id;
  }

  // ── Map DB row to type ────────────────────────────────────
  private mapProfile(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      householdSize: row.household_size,
      dietaryPreferences: row.dietary_preferences ?? [],
      allergies: row.allergies ?? [],
      plan: row.plan ?? 'free',
      recipeGensThisMonth: row.recipe_gens_this_month ?? 0,
      aiQuestionsThisMonth: row.ai_questions_this_month ?? 0,
      fcmToken: row.fcm_token,
    };
  }
}

export const userService = new UserService();
