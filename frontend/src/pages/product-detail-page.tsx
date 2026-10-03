import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit3, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { emptyVariant, variantFormSchema, type VariantFormValues } from '../schemas/products';
import { api, ApiClientError } from '../services/api';
import type { Brand, Category, Product, ProductVariant } from '../types/api';
import { formatINR } from '../utils/format';

const detailsSchema = z.object({
  productCode: z.string().trim().min(2), name: z.string().trim().min(2), description: z.string().max(1000),
  hsnCode: z.string().max(20), categoryId: z.string().uuid(), brandId: z.string(), status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
  taxRateId: z.string(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const client = useQueryClient();
  const [variantMode, setVariantMode] = useState<'closed' | 'add' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const product = useQuery({ queryKey: ['product', id], queryFn: () => api<Product>(`/products/${id}`), enabled: Boolean(id) });
  const categories = useQuery({ queryKey: ['categories', 'active'], queryFn: () => api<Category[]>('/categories') });
  const brands = useQuery({ queryKey: ['brands', 'active'], queryFn: () => api<Brand[]>('/brands') });
  const taxes = useQuery({ queryKey: ['tax-rates'], queryFn: () => api<Array<{ id: string; name: string }>>('/settings/tax-rates') });
  const detailsForm = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { productCode: '', name: '', description: '', hsnCode: '', categoryId: '', brandId: '', taxRateId: '', status: 'ACTIVE' } });
  const variantForm = useForm<VariantFormValues>({ resolver: zodResolver(variantFormSchema), defaultValues: { ...emptyVariant } });
  useEffect(() => { const item = product.data?.data; if (item) detailsForm.reset({ productCode: item.productCode, name: item.name, description: item.description ?? '', hsnCode: item.hsnCode ?? '', categoryId: item.category.id, brandId: item.brand?.id ?? '', taxRateId: item.taxRate?.id ?? '', status: item.status }); }, [product.data, detailsForm]);
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['product', id] }), client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['inventory'] })]); };
  const updateProduct = useMutation({ mutationFn: (values: DetailsValues) => api<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ ...values, brandId: values.brandId || null, taxRateId: values.taxRateId || null }) }), onSuccess: refresh });
  const saveVariant = useMutation({
    mutationFn: (values: VariantFormValues) => {
      if (variantMode === 'edit' && editingId) {
        const { initialStock, ...update } = values;
        void initialStock;
        return api<ProductVariant>(`/products/${id}/variants/${editingId}`, { method: 'PATCH', body: JSON.stringify(update) });
      }
      return api<ProductVariant>(`/products/${id}/variants`, { method: 'POST', body: JSON.stringify(values) });
    },
    onSuccess: async () => { setVariantMode('closed'); setEditingId(null); variantForm.reset({ ...emptyVariant }); await refresh(); },
  });
  function editVariant(variant: ProductVariant) {
    setEditingId(variant.id); setVariantMode('edit');
    variantForm.reset({ sku: variant.sku, barcode: variant.barcode ?? '', size: variant.size ?? '', color: variant.color ?? '', purchaseCost: variant.purchaseCost, mrp: variant.mrp, retailPrice: variant.retailPrice, wholesalePrice: variant.wholesalePrice, minStockLevel: variant.minStockLevel, initialStock: 0 });
  }
  const error = updateProduct.error instanceof ApiClientError ? updateProduct.error.message : saveVariant.error instanceof ApiClientError ? saveVariant.error.message : null;
  if (product.isLoading) return <p className="p-8 text-sm text-stone-500">Loading product…</p>;
  if (product.isError || !product.data) return <p className="p-8 text-sm text-red-700">Unable to load this product.</p>;
  const item = product.data.data;
  return <div className="mx-auto max-w-7xl"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-ink" to="/products"><ArrowLeft className="h-4 w-4" />Products</Link><div className="mt-4"><p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-600">{item.productCode}</p><h2 className="mt-2 text-3xl font-bold">{item.name}</h2></div>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<form className="card mt-6 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4" onSubmit={detailsForm.handleSubmit((values) => updateProduct.mutate(values))}><Field label="Product name"><input className="field" {...detailsForm.register('name')} /></Field><Field label="Product code"><input className="field" {...detailsForm.register('productCode')} /></Field><Field label="Category"><select className="field" {...detailsForm.register('categoryId')}>{categories.data?.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Brand"><select className="field" {...detailsForm.register('brandId')}><option value="">No brand</option>{brands.data?.data.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></Field><Field label="GST rate"><select className="field" {...detailsForm.register('taxRateId')}><option value="">GST 0%</option>{taxes.data?.data.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}</select></Field><Field label="HSN code"><input className="field" {...detailsForm.register('hsnCode')} /></Field><Field label="Description"><input className="field" {...detailsForm.register('description')} /></Field><Field label="Status"><select className="field" {...detailsForm.register('status')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></Field><div className="flex items-end"><button className="button-primary w-full" disabled={updateProduct.isPending}>{updateProduct.isPending ? 'Saving…' : 'Save product'}</button></div></form><div className="mt-8 flex items-center justify-between"><div><h3 className="text-xl font-bold">Variants</h3><p className="text-sm text-stone-600">Stock is managed only through audited inventory movements.</p></div><button className="button-primary" onClick={() => { setVariantMode('add'); setEditingId(null); variantForm.reset({ ...emptyVariant }); }}><Plus className="h-4 w-4" />Add variant</button></div>{variantMode !== 'closed' && <form className="card mt-4 p-6" onSubmit={variantForm.handleSubmit((values) => saveVariant.mutate(values))}><div className="mb-5 flex items-center justify-between"><h4 className="font-bold">{variantMode === 'add' ? 'New variant' : 'Edit variant prices and details'}</h4><button type="button" className="rounded-lg p-2 hover:bg-stone-100" onClick={() => setVariantMode('closed')} aria-label="Close variant form"><X className="h-5 w-5" /></button></div><SingleVariantFields register={variantForm.register} errors={variantForm.formState.errors} includeOpening={variantMode === 'add'} /><div className="mt-5 flex justify-end"><button className="button-primary" disabled={saveVariant.isPending}>{saveVariant.isPending ? 'Saving…' : variantMode === 'add' ? 'Add variant' : 'Save variant'}</button></div></form>}<div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr><th className="px-5 py-4">Variant</th><th className="px-5 py-4">SKU / Barcode</th><th className="px-5 py-4">Cost</th><th className="px-5 py-4">MRP</th><th className="px-5 py-4">Retail</th><th className="px-5 py-4">Wholesale</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4"></th></tr></thead><tbody className="divide-y divide-stone-100">{item.variants.map((variant) => <tr key={variant.id}><td className="px-5 py-4 font-semibold">{[variant.color, variant.size].filter(Boolean).join(' / ') || 'Default'}</td><td className="px-5 py-4">{variant.sku}<span className="block text-xs text-stone-500">{variant.barcode || 'No barcode'}</span></td><td className="px-5 py-4">{formatINR(variant.purchaseCost)}</td><td className="px-5 py-4">{formatINR(variant.mrp)}</td><td className="px-5 py-4">{formatINR(variant.retailPrice)}</td><td className="px-5 py-4">{formatINR(variant.wholesalePrice)}</td><td className="px-5 py-4"><span className={variant.stockQuantity <= variant.minStockLevel ? 'font-bold text-amber-700' : 'font-semibold'}>{variant.stockQuantity}</span><span className="block text-xs text-stone-500">Minimum {variant.minStockLevel}</span></td><td className="px-5 py-4 text-right"><button className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-stone-50" onClick={() => editVariant(variant)}><Edit3 className="h-3.5 w-3.5" />Edit</button></td></tr>)}</tbody></table></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>; }
function SingleVariantFields({ register, errors, includeOpening }: { register: UseFormRegister<VariantFormValues>; errors: FieldErrors<VariantFormValues>; includeOpening: boolean }) {
  const fields: Array<{ key: keyof VariantFormValues; label: string; type?: string }> = [
    { key: 'sku', label: 'SKU' }, { key: 'barcode', label: 'Barcode' }, { key: 'size', label: 'Size' }, { key: 'color', label: 'Colour' },
    { key: 'purchaseCost', label: 'Purchase cost' }, { key: 'mrp', label: 'MRP' }, { key: 'retailPrice', label: 'Retail price' },
    { key: 'wholesalePrice', label: 'Wholesale price' }, { key: 'minStockLevel', label: 'Low-stock level', type: 'number' },
    ...(includeOpening ? [{ key: 'initialStock' as const, label: 'Opening stock', type: 'number' }] : []),
  ];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{fields.map(({ key, label, type }) => <label className="block" key={key}><span className="mb-2 block text-sm font-semibold">{label}</span><input className="field" type={type ?? 'text'} min={type === 'number' ? 0 : undefined} {...register(key, type === 'number' ? { valueAsNumber: true } : undefined)} />{errors[key]?.message && <span className="mt-1 block text-xs text-red-700">{errors[key]?.message}</span>}</label>)}</div>;
}
