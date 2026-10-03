import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema, type ChangePasswordValues } from '../schemas/auth';
import { ApiClientError } from '../services/api';
import { authApi } from '../services/auth';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) => authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/', { replace: true });
    },
  });
  const error = mutation.error instanceof ApiClientError ? mutation.error.message : mutation.isError ? 'Unable to change the password.' : null;
  return <div className="mx-auto max-w-xl"><div className="card p-6 sm:p-8"><div className="grid h-12 w-12 place-items-center rounded-xl bg-gold-100 text-gold-600"><KeyRound className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-bold">Change your password</h2><p className="mt-2 text-sm leading-6 text-stone-600">Use a unique password with at least 12 characters. Other signed-in devices will be logged out.</p>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>{(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => <label className="block" key={field}><span className="mb-2 block text-sm font-semibold">{{ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }[field]}</span><input className="field" type="password" autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} {...form.register(field)} />{form.formState.errors[field] && <span className="mt-1 block text-xs text-red-700">{form.formState.errors[field]?.message}</span>}</label>)}<button className="button-primary w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Updating…' : 'Update password'}</button></form></div></div>;
}
