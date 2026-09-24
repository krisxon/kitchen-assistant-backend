import { Request, Response } from 'express';
import { geminiService } from '../services/ai/gemini.service';
import { notificationService } from '../services/notifications/notification.service';
import { userService } from '../services/supabase/user.service';
import { logger } from '../utils/logger';
import { UserProfile } from '../types';

// ── AI Assistant Controller ───────────────────────────────────

export class AssistantController {

  // POST /api/assistant/ask
  async ask(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { question, conversationHistory = [] } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'question is required' });
        return;
      }

      const { allowed, remaining } = await userService.canAskQuestion(user.id);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: 'Free AI question limit reached',
          message: `You've used all 5 free AI questions this month. Upgrade to Premium for unlimited access.`,
          upgradeRequired: true,
        });
        return;
      }

      const answer = await geminiService.askQuestion(
        question,
        {
          dietaryPreferences: user.dietaryPreferences,
          allergies: user.allergies,
        },
        conversationHistory
      );

      await userService.incrementAiQuestion(user.id);

      res.status(200).json({
        success: true,
        data: { answer },
        meta: { remainingQuestions: remaining - 1 },
      });
    } catch (error) {
      logger.error('AI question error', { error });
      res.status(500).json({ success: false, error: 'Failed to get AI response' });
    }
  }

  // POST /api/assistant/suggest-dishes
  async suggestDishes(req: Request, res: Response): Promise<void> {
    try {
      const { ingredients } = req.body;

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        res.status(400).json({ success: false, error: 'ingredients array is required' });
        return;
      }

      const dishes = await geminiService.suggestDishes(ingredients);
      res.status(200).json({ success: true, data: dishes });
    } catch (error) {
      logger.error('Suggest dishes error', { error });
      res.status(500).json({ success: false, error: 'Failed to suggest dishes' });
    }
  }
}

export const assistantController = new AssistantController();

// ── Notification Controller ───────────────────────────────────

export class NotificationController {

  // POST /api/notifications/schedule-cook
  async scheduleCook(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { recipe, cookStartTime } = req.body;

      if (!recipe || !cookStartTime) {
        res.status(400).json({ success: false, error: 'recipe and cookStartTime are required' });
        return;
      }

      const fcmToken = user.fcmToken;
      if (!fcmToken) {
        res.status(400).json({ success: false, error: 'No FCM token registered for this user' });
        return;
      }

      await notificationService.scheduleCookNotifications(
        fcmToken,
        recipe,
        new Date(cookStartTime)
      );

      res.status(200).json({
        success: true,
        message: `${recipe.steps.length + 1} notifications scheduled`,
      });
    } catch (error) {
      logger.error('Schedule cook notifications error', { error });
      res.status(500).json({ success: false, error: 'Failed to schedule notifications' });
    }
  }

  // POST /api/notifications/register-token
  async registerToken(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as UserProfile;
      const { fcmToken } = req.body;

      if (!fcmToken) {
        res.status(400).json({ success: false, error: 'fcmToken is required' });
        return;
      }

      await userService.updateFcmToken(user.id, fcmToken);
      res.status(200).json({ success: true, message: 'FCM token registered' });
    } catch (error) {
      logger.error('Register FCM token error', { error });
      res.status(500).json({ success: false, error: 'Failed to register token' });
    }
  }
}

export const notificationController = new NotificationController();
