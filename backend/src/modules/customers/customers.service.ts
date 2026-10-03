import { ApiError } from '../../lib/api-error.js';
import { customersRepository } from './customers.repository.js';
import type { CustomerInput } from './customers.schema.js';

export const customersService = {
  list: customersRepository.list,
  async get(id: string) { const item = await customersRepository.get(id); if (!item) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.'); return item; },
  create: (input: CustomerInput, actorId: string, ip?: string) => customersRepository.create(input, actorId, ip),
  async update(id: string, input: Record<string, unknown>, actorId: string, ip?: string) { const item = await customersRepository.update(id, input, actorId, ip); if (!item) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.'); return item; },
  async pay(id: string, input: { amount: string; method: string; cashSessionId?: string | null; reference?: string; notes?: string }, actorId: string, ip?: string) { const result = await customersRepository.pay(id, input, actorId, ip); if (!result) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer was not found.'); if (result.cashSessionInvalid) throw new ApiError(400, 'CASH_SESSION_REQUIRED', 'An open cash session is required.'); return result.payment; },
};
