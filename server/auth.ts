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
 * For now, uses X-User-Email header (development only)
 * TODO: Replace with proper session-based auth
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get user email from header (mock auth)
    const userEmail = req.headers['x-user-email'] as string;
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch user from database
    const user = await storage.getUserByEmail(userEmail);
    
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
