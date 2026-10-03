import { Prisma } from '@prisma/client';

export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const ZERO = D(0);

export function money(value: Prisma.Decimal.Value) {
  return D(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function currency(value: Prisma.Decimal.Value) {
  return D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function businessYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(date));
}
