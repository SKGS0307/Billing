import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { SESSION_COOKIE } from '../../lib/security.js';
import { changePasswordSchema, loginSchema } from './auth.schema.js';
import { authService } from './auth.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: '/',
};

export const authController = {
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const { token, expiresAt } = await authService.login(input, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    res.json({ success: true, data: { expiresAt } });
  },
  async logout(req: Request, res: Response) {
    await authService.logout(req.auth!.sessionId, req.auth!.id, req.ip);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.json({ success: true, data: { message: 'Signed out successfully.' } });
  },
  me(req: Request, res: Response) {
    const auth = req.auth!;
    res.json({
      success: true,
      data: {
        id: auth.id,
        email: auth.email,
        name: auth.name,
        mustChangePassword: auth.mustChangePassword,
        roles: auth.roles,
        permissions: auth.permissions,
      },
    });
  },
  async changePassword(req: Request, res: Response) {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(input, { userId: req.auth!.id, sessionId: req.auth!.sessionId, ipAddress: req.ip });
    res.json({ success: true, data: { message: 'Password changed successfully.' } });
  },
};
