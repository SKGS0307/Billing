import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { api, ApiClientError } from '../services/api';
import type { Brand, Category } from '../types/api';

export function CataloguePage() {
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const categories = useQuery({ queryKey: ['categories', 'all'], queryFn: () => api<Category[]>('/categories?includeInactive=true') });
  const brands = useQuery({ queryKey: ['brands', 'all'], queryFn: () => api<Brand[]>('/brands?includeInactive=true') });
  const categoryMutation = useMutation({
    mutationFn: (input: { id?: string; name?: string; isActive?: boolean }) => input.id
      ? api<Category>(`/categories/${input.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: input.isActive }) })
      : api<Category>('/categories', { method: 'POST', body: JSON.stringify({ name: input.name }) }),
    onSuccess: async () => { setCategoryName(''); await queryClient.invalidateQueries({ queryKey: ['categories'] }); },
  });
  const brandMutation = useMutation({
    mutationFn: (input: { id?: string; name?: string; isActive?: boolean }) => input.id
      ? api<Brand>(`/brands/${input.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: input.isActive }) })
      : api<Brand>('/brands', { method: 'POST', body: JSON.stringify({ name: input.name }) }),
    onSuccess: async () => { setBrandName(''); await queryClient.invalidateQueries({ queryKey: ['brands'] }); },
  });
  const error = categoryMutation.error instanceof ApiClientError ? categoryMutation.error.message
    : brandMutation.error instanceof ApiClientError ? brandMutation.error.message : null;

  return <div className="mx-auto max-w-6xl"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-600">Catalogue setup</p><h2 className="mt-2 text-3xl font-bold">Categories & brands</h2><p className="mt-2 text-sm text-stone-600">Maintain the classifications used by the product catalogue.</p></div>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<div className="mt-6 grid gap-6 lg:grid-cols-2"><MasterList title="Categories" value={categoryName} onValue={setCategoryName} loading={categories.isLoading} items={categories.data?.data ?? []} pending={categoryMutation.isPending} onAdd={() => categoryName.trim() && categoryMutation.mutate({ name: categoryName.trim() })} onToggle={(item) => categoryMutation.mutate({ id: item.id, isActive: !item.isActive })} /><MasterList title="Brands" value={brandName} onValue={setBrandName} loading={brands.isLoading} items={brands.data?.data ?? []} pending={brandMutation.isPending} onAdd={() => brandName.trim() && brandMutation.mutate({ name: brandName.trim() })} onToggle={(item) => brandMutation.mutate({ id: item.id, isActive: !item.isActive })} /></div></div>;
}

interface MasterItem { id: string; name: string; isActive: boolean; _count?: { products: number } }
function MasterList({ title, value, onValue, loading, items, pending, onAdd, onToggle }: { title: string; value: string; onValue: (value: string) => void; loading: boolean; items: MasterItem[]; pending: boolean; onAdd: () => void; onToggle: (item: MasterItem) => void }) {
  return <section className="card overflow-hidden"><div className="border-b border-stone-200 p-5"><h3 className="font-bold">{title}</h3><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); onAdd(); }}><input className="field" value={value} onChange={(event) => onValue(event.target.value)} placeholder={`New ${title.slice(0, -1).toLowerCase()} name`} aria-label={`New ${title.slice(0, -1)} name`} /><button className="button-primary shrink-0" disabled={pending || value.trim().length < 2}><Plus className="h-4 w-4" />Add</button></form></div>{loading ? <p className="p-6 text-sm text-stone-500">Loading…</p> : items.length === 0 ? <div className="p-10 text-center"><Tags className="mx-auto h-7 w-7 text-stone-400" /><p className="mt-2 text-sm text-stone-600">No {title.toLowerCase()} yet.</p></div> : <ul className="divide-y divide-stone-100">{items.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className={`font-semibold ${item.isActive ? '' : 'text-stone-400 line-through'}`}>{item.name}</p><p className="text-xs text-stone-500">{item._count?.products ?? 0} products</p></div><button className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50" disabled={pending} onClick={() => onToggle(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</button></li>)}</ul>}</section>;
}
