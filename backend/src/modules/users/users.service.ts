import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/api-error.js';
import { normalizeEmail } from '../../lib/security.js';
import { usersRepository } from './users.repository.js';

async function resolveRoles(names: string[]) {
  const uniqueNames = [...new Set(names)];
  const roles = await usersRepository.findActiveRoles(uniqueNames);
  const missing = uniqueNames.filter((name) => !roles.some((role) => role.name === name));
  if (missing.length) throw new ApiError(400, 'INVALID_ROLE', `Unknown or inactive role: ${missing.join(', ')}.`);
  return roles.map((role) => role.id);
}

export const usersService = {
  list: usersRepository.list,
  async create(input: { email: string; name: string; password: string; roles: string[] }, actor: { id: string; ipAddress?: string }) {
    const roleIds = await resolveRoles(input.roles);
    try {
      return await usersRepository.create({
        email: normalizeEmail(input.email),
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 12),
        roleIds,
        actorId: actor.id,
        ipAddress: actor.ipAddress,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'EMAIL_EXISTS', 'A user with this email already exists.');
      }
      throw error;
    }
  },
  async update(input: { id: string; name?: string; isActive?: boolean; roles?: string[] }, actor: { id: string; ipAddress?: string }) {
    if (input.id === actor.id && input.isActive === false) {
      throw new ApiError(400, 'SELF_DEACTIVATION', 'You cannot deactivate your own account.');
    }
    const roleIds = input.roles ? await resolveRoles(input.roles) : undefined;
    const user = await usersRepository.update({
      id: input.id, name: input.name, isActive: input.isActive, roleIds, actorId: actor.id, ipAddress: actor.ipAddress,
    });
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User was not found.');
    return user;
  },
};
