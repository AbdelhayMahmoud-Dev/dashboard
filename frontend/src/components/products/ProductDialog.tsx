'use client';

import { useEffect, useState, useRef, useMemo, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch }   from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Resolver } from 'react-hook-form';
import { useCreateProduct, useUpdateProduct, useProductCategories } from '@/hooks/useProducts';
import { Product } from '@/types';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z.object({
  name:         z.string().min(1, 'Name is required').max(200),
  description:  z.string().min(1, 'Description is required'),
  price:        z.coerce.number().min(0, 'Price must be ≥ 0'),
  comparePrice: z.coerce.number().optional(),
  category:     z.string().min(1, 'Category is required'),
  subcategory:  z.string().optional(),
  sku:          z.string().min(1, 'SKU is required'),
  stock:        z.coerce.number().min(0).int('Stock must be a whole number'),
  status:       z.enum(['active', 'inactive', 'draft']),
  isFeatured:   z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open:     boolean;
  onClose:  () => void;
  product?: Product | null;
}

// ── Tags chip input ───────────────────────────────────────────────────────────
// Fix: track mousedown on a tag's remove button so the input onBlur does not
// fire addTag (which would add the current text before the click registers).
function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);
  const removingRef       = useRef(false);   // set on mousedown of a tag remove btn

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    removingRef.current = false;
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    // Skip addTag if user is clicking a remove button (mousedown already fired)
    if (!removingRef.current && input.trim()) addTag(input);
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 min-h-[36px] w-full rounded-md border border-input',
        'bg-background px-3 py-2 cursor-text',
        'focus-within:ring-2 focus-within:ring-ring transition-shadow',
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-md px-2 py-0.5"
        >
          {tag}
          <button
            type="button"
            onMouseDown={() => { removingRef.current = true; }}
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={`Remove ${tag}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? 'Type and press Enter or comma to add' : ''}
        className="flex-1 min-w-[120px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        aria-label="Add tag"
      />
    </div>
  );
}

// ── Form field wrapper ────────────────────────────────────────────────────────
function Field({
  label, error, hint, children, required,
}: {
  label:    string;
  error?:   string;
  hint?:    string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────
export function ProductDialog({ open, onClose, product }: Props) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categoryList } = useProductCategories();

  const isEdit = !!product;
  const [tags, setTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // WHY cast: zod v4 z.coerce.number() infers `unknown` input type, which
    // conflicts with useForm<FormData> expecting `number`. Safe at runtime.
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: { status: 'draft', stock: 0, price: 0, isFeatured: false },
  });

  const watchStatus     = watch('status');
  const watchIsFeatured = watch('isFeatured');

  // Unique sorted category list for datalist — memoized
  const datalistCategories = useMemo(() => {
    const all = [...(categoryList ?? [])];
    if (product?.category && !all.includes(product.category)) {
      all.unshift(product.category);
    }
    return [...new Set(all)].sort();
  }, [categoryList, product?.category]);

  // Populate form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (product) {
      reset({
        name:         product.name,
        description:  product.description,
        price:        product.price,
        comparePrice: product.comparePrice,
        category:     product.category,
        subcategory:  product.subcategory,
        sku:          product.sku,
        stock:        product.stock,
        status:       product.status,
        isFeatured:   product.isFeatured,
      });
      setTags(product.tags ?? []);
    } else {
      reset({ status: 'draft', stock: 0, price: 0, isFeatured: false });
      setTags([]);
    }
  }, [product, open, reset]);

  const onSubmit = (data: FormData) => {
    const payload = { ...data, tags };
    if (isEdit) {
      updateProduct.mutate({ id: product._id, data: payload }, { onSuccess: onClose });
    } else {
      createProduct.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;
  const datalistId = 'product-categories-list';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1" noValidate>

          {/* ── Identification ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Product Info
            </p>

            <Field label="Name" error={errors.name?.message} required>
              <Input
                {...register('name')}
                placeholder="e.g. Premium Wireless Headphones"
                autoFocus={!isEdit}
              />
            </Field>

            <Field label="Description" error={errors.description?.message} required>
              <Textarea
                {...register('description')}
                placeholder="Brief product description…"
                rows={3}
                className="resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" error={errors.category?.message} required>
                {/* Native datalist — free-form text with autocomplete from existing categories */}
                <Input
                  {...register('category')}
                  list={datalistId}
                  placeholder="e.g. Electronics"
                  autoComplete="off"
                />
                <datalist id={datalistId}>
                  {datalistCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>

              <Field label="Subcategory" hint="Optional">
                <Input {...register('subcategory')} placeholder="e.g. Wireless" />
              </Field>
            </div>

            <Field label="Tags" hint="Enter or comma to add · Backspace removes last">
              <TagsInput tags={tags} onChange={setTags} />
            </Field>
          </div>

          {/* ── Pricing & inventory ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Pricing &amp; Inventory
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Price ($)" error={errors.price?.message} required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('price')}
                  placeholder="0.00"
                />
              </Field>

              <Field
                label="Compare at Price ($)"
                hint="Strikethrough price — leave blank if no sale"
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('comparePrice')}
                  placeholder="0.00"
                />
              </Field>

              <Field label="SKU" error={errors.sku?.message} required>
                <Input
                  {...register('sku')}
                  placeholder="PROD-001"
                  className="uppercase"
                />
              </Field>

              <Field label="Stock" error={errors.stock?.message} required>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  {...register('stock')}
                  placeholder="0"
                />
              </Field>
            </div>
          </div>

          {/* ── Visibility ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Visibility
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <Select
                  value={watchStatus}
                  onValueChange={(v) =>
                    v && setValue('status', v as FormData['status'], { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Featured">
                <div className="flex items-center gap-3 h-9 px-3 rounded-md border border-input bg-background">
                  <Switch
                    id="prod-featured"
                    checked={watchIsFeatured ?? false}
                    onCheckedChange={(v) => setValue('isFeatured', v)}
                  />
                  <Label
                    htmlFor="prod-featured"
                    className="text-sm text-muted-foreground cursor-pointer select-none font-normal"
                  >
                    {watchIsFeatured ? 'Featured' : 'Not featured'}
                  </Label>
                </div>
              </Field>
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
