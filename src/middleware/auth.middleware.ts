import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import { userService } from '../services/supabase/user.service';
import { logger } from '../utils/logger';

// Anon client — only for verifying JWTs
const supabaseAnon = createClient(config.supabase.url, config.supabase.serviceRoleKey);

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid token attempt', { error: error?.message });
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Fetch full user profile
    const profile = await userService.getProfile(user.id);

    if (!profile) {
      res.status(404).json({ success: false, error: 'User profile not found' });
      return;
    }

    // Attach to request
    (req as any).user = profile;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
};
