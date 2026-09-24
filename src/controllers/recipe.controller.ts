import { Request, Response } from 'express';
import { geminiService } from '../services/ai/gemini.service';
import { userService } from '../services/supabase/user.service';
import { logger } from '../utils/logger';
import { UserProfile } from '../types';

export class RecipeController {

  // POST /api/recipes/generate
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { dishName, servings = user.householdSize } = req.body;

      if (!dishName || typeof dishName !== 'string') {
        res.status(400).json({ success: false, error: 'dishName is required' });
        return;
      }

      const { allowed, remaining } = await userService.canGenerateRecipe(user.id);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: 'Free recipe limit reached',
          message: `You've used all 5 free recipe generations this month. Upgrade to Premium for unlimited recipes.`,
          upgradeRequired: true,
        });
        return;
      }

      logger.info('Generating recipe', { dishName, servings, userId: user.id });

      const recipe = await geminiService.generateRecipe(
        dishName,
        servings,
        user.dietaryPreferences,
        user.allergies
      );

      await Promise.all([
        userService.saveRecipe(user.id, recipe),
        userService.incrementRecipeGen(user.id),
      ]);

      res.status(200).json({
        success: true,
        data: recipe,
        meta: { remainingGenerations: remaining - 1 },
      });
    } catch (error) {
      logger.error('Recipe generation error', { error });
      res.status(500).json({ success: false, error: 'Failed to generate recipe' });
    }
  }

  // POST /api/recipes/scale
  async scale(req: Request, res: Response): Promise<void> {
    try {
      const { recipe, newServings } = req.body;

      if (!recipe || !newServings) {
        res.status(400).json({ success: false, error: 'recipe and newServings are required' });
        return;
      }
      if (newServings < 1 || newServings > 50) {
        res.status(400).json({ success: false, error: 'newServings must be between 1 and 50' });
        return;
      }

      const scaled = await geminiService.scaleRecipe(recipe, newServings);
      res.status(200).json({ success: true, data: scaled });
    } catch (error) {
      logger.error('Recipe scale error', { error });
      res.status(500).json({ success: false, error: 'Failed to scale recipe' });
    }
  }

  // POST /api/recipes/substitute
  async substitute(req: Request, res: Response): Promise<void> {
    try {
      const { ingredient, dishName, availableIngredients = [] } = req.body;

      if (!ingredient || !dishName) {
        res.status(400).json({ success: false, error: 'ingredient and dishName are required' });
        return;
      }

      const substitution = await geminiService.getSubstitution(
        ingredient,
        dishName,
        availableIngredients
      );
      res.status(200).json({ success: true, data: substitution });
    } catch (error) {
      logger.error('Substitution error', { error });
      res.status(500).json({ success: false, error: 'Failed to get substitution' });
    }
  }

  // GET /api/recipes/saved
  async getSaved(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { supabase } = await import('../services/supabase/client');

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_saved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('Get saved recipes error', { error });
      res.status(500).json({ success: false, error: 'Failed to fetch saved recipes' });
    }
  }

  // PATCH /api/recipes/:id/save
  async toggleSave(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { id } = req.params;
      const { isSaved } = req.body;
      const { supabase } = await import('../services/supabase/client');

      const { error } = await supabase
        .from('recipes')
        .update({ is_saved: isSaved })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      res.status(200).json({ success: true, message: isSaved ? 'Recipe saved' : 'Recipe unsaved' });
    } catch (error) {
      logger.error('Toggle save error', { error });
      res.status(500).json({ success: false, error: 'Failed to update recipe' });
    }
  }
}

export const recipeController = new RecipeController();
