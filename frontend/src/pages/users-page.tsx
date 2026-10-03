import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../hooks/use-auth';
import { api, ApiClientError } from '../services/api';
import type { RoleSummary, UserSummary } from '../types/api';
import { dateTimeFormatter } from '../utils/format';

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter the user’s name.'),
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(12, 'Use at least 12 characters.'),
  role: z.string().min(1, 'Choose a role.'),
});
type CreateValues = z.infer<typeof createSchema>;

export function UsersPage() {
  const currentUser = useAuth().data;
  const canManage = currentUser?.permissions.includes('users:manage') ?? false;
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['users', search], queryFn: () => api<UserSummary[]>(`/users?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`) });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleSummary[]>('/roles'), enabled: canManage });
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '', role: '' } });
  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => api<UserSummary>('/users', { method: 'POST', body: JSON.stringify({ name: values.name, email: values.email, password: values.password, roles: [values.role] }) }),
    onSuccess: async () => { form.reset(); setCreating(false); await queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });
  const statusMutation = useMutation({
    mutationFn: (user: UserSummary) => api<UserSummary>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });
  const createError = createMutation.error instanceof ApiClientError ? createMutation.error.message : createMutation.isError ? 'Unable to create this user.' : null;

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-600">Administration</p><h2 className="mt-2 text-3xl font-bold">Store users</h2><p className="mt-2 text-sm text-stone-600">Accounts, roles and access status.</p></div><div className="flex flex-col gap-2 sm:flex-row">{canManage && <button className="button-primary" onClick={() => setCreating((value) => !value)}><UserPlus className="h-4 w-4" />Add user</button>}<form className="relative w-full sm:w-72" onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); }}><Search className="absolute left-3 top-3.5 h-4 w-4 text-stone-400" /><input className="field pl-9" placeholder="Search name or email" value={input} onChange={(event) => setInput(event.target.value)} aria-label="Search users" /></form></div></div>

    {creating && <section className="card mt-6 p-6"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold">Create store user</h3><p className="mt-1 text-sm text-stone-600">The user must change this temporary password after signing in.</p></div><button className="rounded-lg p-2 hover:bg-stone-100" onClick={() => setCreating(false)} aria-label="Close create user form"><X className="h-5 w-5" /></button></div>{createError && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{createError}</div>}<form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>{([{ field: 'name', label: 'Full name', type: 'text' }, { field: 'email', label: 'Email', type: 'email' }, { field: 'password', label: 'Temporary password', type: 'password' }] as const).map(({ field, label, type }) => <label className="block" key={field}><span className="mb-2 block text-sm font-semibold">{label}</span><input className="field" type={type} {...form.register(field)} />{form.formState.errors[field] && <span className="mt-1 block text-xs text-red-700">{form.formState.errors[field]?.message}</span>}</label>)}<label className="block"><span className="mb-2 block text-sm font-semibold">Role</span><select className="field" {...form.register('role')}><option value="">Choose role</option>{roles.data?.data.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}</select>{form.formState.errors.role && <span className="mt-1 block text-xs text-red-700">{form.formState.errors.role.message}</span>}</label><div className="sm:col-span-2"><button className="button-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create user'}</button></div></form></section>}

    {statusMutation.error instanceof ApiClientError && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{statusMutation.error.message}</div>}
    <div className="card mt-6 overflow-hidden">{users.isLoading ? <p className="p-8 text-sm text-stone-500">Loading users…</p> : users.isError ? <p className="p-8 text-sm text-red-700">Unable to load users.</p> : users.data?.data.length === 0 ? <div className="p-12 text-center"><Users className="mx-auto h-8 w-8 text-stone-400" /><p className="mt-3 font-semibold">No matching users</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr><th className="px-6 py-4">User</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Last login</th>{canManage && <th className="px-6 py-4 text-right">Action</th>}</tr></thead><tbody className="divide-y divide-stone-100">{users.data?.data.map((user) => <tr key={user.id} className="hover:bg-stone-50"><td className="px-6 py-4"><span className="block font-semibold">{user.name}</span><span className="text-stone-500">{user.email}</span></td><td className="px-6 py-4">{user.roles.join(', ') || 'Unassigned'}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td><td className="px-6 py-4 text-stone-600">{user.lastLoginAt ? dateTimeFormatter.format(new Date(user.lastLoginAt)) : 'Never'}</td>{canManage && <td className="px-6 py-4 text-right">{user.id !== currentUser?.id && <button className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:bg-stone-100 disabled:opacity-50" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button>}</td>}</tr>)}</tbody></table></div>}</div>
  </div>;
}
