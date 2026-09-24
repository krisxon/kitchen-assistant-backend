import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { recipeController } from '../controllers/recipe.controller';
import { assistantController, notificationController } from '../controllers/assistant.controller';

const router = Router();

// ── Health check (no auth) ────────────────────────────────────
router.get('/health', (_, res) => {
  res.status(200).json({
    success: true,
    message: 'Kitchen Assistant API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Recipe routes (auth required) ─────────────────────────────
router.post('/recipes/generate',   authenticate, (req, res) => recipeController.generate(req, res));
router.post('/recipes/scale',      authenticate, (req, res) => recipeController.scale(req, res));
router.post('/recipes/substitute', authenticate, (req, res) => recipeController.substitute(req, res));
router.get('/recipes/saved',       authenticate, (req, res) => recipeController.getSaved(req, res));
router.patch('/recipes/:id/save',  authenticate, (req, res) => recipeController.toggleSave(req, res));

// ── AI assistant routes (auth required) ───────────────────────
router.post('/assistant/ask',            authenticate, (req, res) => assistantController.ask(req, res));
router.post('/assistant/suggest-dishes', authenticate, (req, res) => assistantController.suggestDishes(req, res));

// ── Notification routes (auth required) ───────────────────────
router.post('/notifications/schedule-cook',  authenticate, (req, res) => notificationController.scheduleCook(req, res));
router.post('/notifications/register-token', authenticate, (req, res) => notificationController.registerToken(req, res));

export default router;
