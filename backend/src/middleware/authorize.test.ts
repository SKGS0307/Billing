import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requirePermission } from './authorize.js';

function requestWith(permissions?: string[], mustChangePassword = false) {
  return {
    auth: permissions ? {
      id: 'user-id', email: 'user@example.com', name: 'User', mustChangePassword,
      roles: ['Test'], permissions, sessionId: 'session-id',
    } : undefined,
  } as Request;
}

describe('requirePermission', () => {
  it('allows a user who has every required permission', () => {
    const next = vi.fn() as NextFunction;
    requirePermission('dashboard:read', 'users:read')(requestWith(['dashboard:read', 'users:read']), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies a signed-in user without the required permission', () => {
    const next = vi.fn() as NextFunction;
    requirePermission('users:read')(requestWith(['dashboard:read']), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
  });

  it('requires authentication', () => {
    const next = vi.fn() as NextFunction;
    requirePermission('dashboard:read')(requestWith(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'AUTHENTICATION_REQUIRED' }));
  });

  it('blocks operational access until a temporary password is changed', () => {
    const next = vi.fn() as NextFunction;
    requirePermission('dashboard:read')(requestWith(['dashboard:read'], true), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' }));
  });
});
