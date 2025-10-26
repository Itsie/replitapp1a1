import type { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import type { Role } from '@prisma/client';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: Role;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Uses session-based auth, with dev-mode fallback to X-User-Email header
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let userId: string | undefined;

    // Primary: Check session
    if (req.session?.userId) {
      userId = req.session.userId;
    }
    // Development fallback: X-User-Email header (for dev user switcher)
    else if (process.env.NODE_ENV === 'development') {
      const userEmail = req.headers['x-user-email'] as string;
      if (userEmail) {
        const user = await storage.getUserByEmail(userEmail);
        if (user) {
          userId = user.id;
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch user from database
    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First ensure user is authenticated
      if (!req.user) {
        // Try to authenticate if not already done
        await requireAuth(req, res, () => {});
        
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: `This action requires one of these roles: ${allowedRoles.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
}
