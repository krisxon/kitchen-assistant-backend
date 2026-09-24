import admin from 'firebase-admin';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { Recipe } from '../../types';

// Initialise Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey,
      clientEmail: config.firebase.clientEmail,
    }),
  });
}

const messaging = admin.messaging();

export class NotificationService {

  // ── Schedule all step notifications for a cook session ───
  async scheduleCookNotifications(
    fcmToken: string,
    recipe: Recipe,
    cookStartTime: Date
  ): Promise<void> {
    let offsetMs = 0;

    for (const step of recipe.steps) {
      const fireAt = new Date(cookStartTime.getTime() + offsetMs);

      // Only schedule future notifications
      if (fireAt > new Date()) {
        await this.sendNotificationAt(
          fcmToken,
          {
            title: `🍳 ${recipe.dishName} — Step ${step.stepNumber}`,
            body: step.notificationMessage || step.instruction,
          },
          {
            recipeId: recipe.id,
            stepNumber: String(step.stepNumber),
            type: 'cooking_step',
          },
          fireAt
        );
      }

      offsetMs += step.durationMinutes * 60 * 1000;
    }

    // Final "dish is ready" notification
    const doneAt = new Date(cookStartTime.getTime() + offsetMs);
    if (doneAt > new Date()) {
      await this.sendNotificationAt(
        fcmToken,
        {
          title: `🎉 ${recipe.dishName} is ready!`,
          body: 'Your dish is done. Time to eat!',
        },
        { recipeId: recipe.id, type: 'cook_complete' },
        doneAt
      );
    }

    logger.info('Cook notifications scheduled', {
      recipeId: recipe.id,
      stepsCount: recipe.steps.length,
    });
  }

  // ── Send an immediate push notification ──────────────────
  async sendNow(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<void> {
    try {
      await messaging.send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { channelId: 'cooking_timers', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      logger.info('Push notification sent', { title });
    } catch (error) {
      logger.error('FCM send error', { error, fcmToken: fcmToken.slice(0, 10) });
    }
  }

  // ── Internal: schedule a notification at a specific time ─
  // Note: FCM does not natively support scheduled delivery.
  // In production, use a job queue (e.g. BullMQ + Redis) or
  // Supabase Edge Functions with pg_cron to fire at the right time.
  // For MVP, this sends immediately but logs the intended time.
  private async sendNotificationAt(
    fcmToken: string,
    notification: { title: string; body: string },
    data: Record<string, string>,
    scheduledAt: Date
  ): Promise<void> {
    const delayMs = scheduledAt.getTime() - Date.now();

    if (delayMs <= 0) return;

    // MVP: use setTimeout for delays up to ~10 minutes
    // Production: replace with BullMQ job queue
    if (delayMs < 10 * 60 * 1000) {
      setTimeout(async () => {
        await this.sendNow(fcmToken, notification.title, notification.body, data);
      }, delayMs);
    } else {
      // For longer delays, log — production queue needed
      logger.info('Long-delay notification queued (needs job queue in prod)', {
        scheduledAt: scheduledAt.toISOString(),
        title: notification.title,
      });
    }
  }
}

export const notificationService = new NotificationService();
