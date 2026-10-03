import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/api-error.js';
import { createSessionToken, hashSessionToken, normalizeEmail } from '../../lib/security.js';
import { authRepository } from './auth.repository.js';
import type { LoginInput } from './auth.schema.js';

const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

export const authService = {
  async login(input: LoginInput, context: { ipAddress?: string; userAgent?: string }) {
    const user = await authRepository.findUserForLogin(normalizeEmail(input.email));
    if (!user || !user.isActive) throw invalidCredentials();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
    }
    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      await authRepository.recordFailedLogin(user.id, user.failedLoginCount + 1 >= 5);
      throw invalidCredentials();
    }
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await authRepository.createSuccessfulSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent?.slice(0, 500),
    });
    return { token, expiresAt };
  },
  logout(sessionId: string, userId: string, ipAddress?: string) {
    return authRepository.revokeSession(sessionId, userId, ipAddress);
  },
  async changePassword(input: { currentPassword: string; newPassword: string }, context: { userId: string; sessionId: string; ipAddress?: string }) {
    const user = await authRepository.findUserPassword(context.userId);
    if (!user || !await bcrypt.compare(input.currentPassword, user.passwordHash)) {
      throw new ApiError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await authRepository.changePassword(context.userId, context.sessionId, passwordHash, context.ipAddress);
  },
};
