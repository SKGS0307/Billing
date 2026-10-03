import type { ApiFailure, ApiSuccess } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiSuccess<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || !body.success) {
    const error = body as ApiFailure;
    throw new ApiClientError(error.error?.code ?? 'REQUEST_FAILED', error.error?.message ?? 'Unable to complete the request.', response.status);
  }
  return body;
}
