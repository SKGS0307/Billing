import type { AuthUser } from '../types/api';
import { api } from './api';

export const authApi = {
  login(input: { email: string; password: string }) {
    return api<{ expiresAt: string }>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  },
  me() { return api<AuthUser>('/auth/me'); },
  logout() { return api<{ message: string }>('/auth/logout', { method: 'POST' }); },
  changePassword(input: { currentPassword: string; newPassword: string }) {
    return api<{ message: string }>('/auth/password', { method: 'PATCH', body: JSON.stringify(input) });
  },
};
