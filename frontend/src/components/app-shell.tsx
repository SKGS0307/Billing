import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Menu, PanelLeftClose, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { navigation } from '../constants/navigation';
import { useAuth } from '../hooks/use-auth';
import { authApi } from '../services/auth';
import { initials } from '../utils/format';
import { Brand } from './brand';

export function AppShell() {
  const { data: user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const links = navigation.filter((item) => user?.permissions.includes(item.permission));

  async function logout() {
    try { await authApi.logout(); } finally {
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  }

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <Brand compact={collapsed} />
        <button className="hidden rounded-lg p-2 text-stone-400 hover:bg-white/10 hover:text-white lg:block" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><PanelLeftClose className={`h-5 w-5 transition ${collapsed ? 'rotate-180' : ''}`} /></button>
        <button className="rounded-lg p-2 text-stone-400 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary navigation">
        {links.map((item) => <NavLink key={item.href} to={item.href} end={item.href === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-gold-400 text-ink' : 'text-stone-300 hover:bg-white/10 hover:text-white'}`} title={collapsed ? item.label : undefined}><item.icon className="h-5 w-5 shrink-0" />{!collapsed && item.label}</NavLink>)}
      </nav>
      {!collapsed && <div className="border-t border-white/10 p-5"><p className="text-xs font-semibold text-stone-300">Bareilly, Uttar Pradesh</p><p className="mt-1 text-xs text-stone-500">Local store system</p></div>}
    </>
  );

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-ink transition-all lg:flex ${collapsed ? 'w-[76px]' : 'w-64'}`}>{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-black/60" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} /><aside className="relative flex h-full w-72 flex-col bg-ink">{sidebar}</aside></div>}
      <div className={`transition-all ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-4"><button className="rounded-xl border border-stone-200 p-2.5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">The Trends Mart</p><h1 className="text-lg font-bold text-ink">Store workspace</h1></div></div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><button className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-stone-100" aria-label="Open user menu"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-sm font-bold text-gold-400">{initials(user?.name ?? 'User')}</span><span className="hidden sm:block"><span className="block text-sm font-semibold">{user?.name}</span><span className="block text-xs text-stone-500">{user?.roles.join(', ')}</span></span></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-52 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl"><DropdownMenu.Label className="px-3 py-2 text-xs text-stone-500">{user?.email}</DropdownMenu.Label><DropdownMenu.Separator className="my-1 h-px bg-stone-100" /><DropdownMenu.Item onSelect={() => navigate('/change-password')} className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none hover:bg-stone-100 focus:bg-stone-100">Change password</DropdownMenu.Item><DropdownMenu.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 outline-none hover:bg-red-50 focus:bg-red-50"><LogOut className="h-4 w-4" />Sign out</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>
        <main className="p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
