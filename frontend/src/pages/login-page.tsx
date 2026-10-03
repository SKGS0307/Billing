import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/brand';
import { useAuth } from '../hooks/use-auth';
import { loginSchema, type LoginValues } from '../schemas/auth';
import { ApiClientError } from '../services/api';
import { authApi } from '../services/auth';

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? '/', { replace: true });
    },
  });

  if (auth.data) return <Navigate to="/" replace />;
  const error = mutation.error instanceof ApiClientError ? mutation.error.message : mutation.isError ? 'Unable to reach the store server.' : null;
  return (
    <div className="grid min-h-screen bg-stone-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-ink p-14 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-gold-400/20" /><div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-gold-400/10" />
        <Brand />
        <div className="relative max-w-xl"><p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-gold-400">Billing with confidence</p><h1 className="text-5xl font-semibold leading-tight text-white">Every sale. Every item. Always accounted for.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-stone-400">Secure local operations for The Trends Mart, designed for reliable billing in the shop.</p></div>
        <div className="flex items-center gap-3 text-sm text-stone-400"><ShieldCheck className="h-5 w-5 text-gold-400" />Protected access · Local-first operation</div>
      </section>
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><div className="inline-flex rounded-2xl bg-ink p-4"><Brand /></div></div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-600">Welcome back</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Sign in to your store</h2><p className="mt-3 text-sm leading-6 text-stone-600">Use the account assigned by your administrator.</p>
          <form className="mt-9 space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            <label className="block"><span className="mb-2 block text-sm font-semibold">Email address</span><input className="field" type="email" autoComplete="username" autoFocus {...form.register('email')} />{form.formState.errors.email && <span className="mt-1.5 block text-xs text-red-700">{form.formState.errors.email.message}</span>}</label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Password</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" /><input className="field pl-10 pr-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...form.register('password')} /><button className="absolute right-2 top-2 rounded-lg p-2 text-stone-500 hover:bg-stone-100" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>{form.formState.errors.password && <span className="mt-1.5 block text-xs text-red-700">{form.formState.errors.password.message}</span>}</label>
            <button className="button-primary w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in securely'}</button>
          </form>
          <p className="mt-8 text-center text-xs text-stone-500">The Trends Mart · Bareilly, Uttar Pradesh</p>
        </div>
      </main>
    </div>
  );
}
