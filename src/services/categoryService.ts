import { supabase } from '@/lib/supabase';
import type { Category, CategoryWithChildren } from '@/types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name');

  if (error) throw error;
  return data as Category[];
}

export async function fetchCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data as Category | null;
}

export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const byParent = new Map<string | null, Category[]>();
  for (const cat of categories) {
    const key = cat.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cat);
  }

  const roots = byParent.get(null) || [];
  return roots
    .map((root) => ({
      ...root,
      children: (byParent.get(root.id) || []).sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export async function fetchCategoryTree(): Promise<CategoryWithChildren[]> {
  const categories = await fetchCategories();
  return buildCategoryTree(categories);
}

export async function fetchVisibleCategoryTree(): Promise<CategoryWithChildren[]> {
  const [categories, productCounts] = await Promise.all([
    fetchCategories(),
    fetchActiveProductCategoryCounts(),
  ]);

  const countsByCatId = new Map<string, number>();
  for (const row of productCounts) {
    countsByCatId.set(row.category_id, row.count);
  }

  const tree = buildCategoryTree(categories);

  return tree
    .map((dept) => ({
      ...dept,
      children: dept.children.filter((sub) => (countsByCatId.get(sub.id) || 0) > 0),
    }))
    .filter((dept) => {
      const deptHasOwnProducts = (countsByCatId.get(dept.id) || 0) > 0;
      const hasVisibleChildren = dept.children.length > 0;
      return deptHasOwnProducts || hasVisibleChildren;
    });
}

async function fetchActiveProductCategoryCounts(): Promise<{ category_id: string; count: number }[]> {
  const { data, error } = await supabase
    .from('products')
    .select('category_id')
    .eq('is_active', true)
    .not('category_id', 'is', null);

  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data) {
    const cid = row.category_id as string;
    counts.set(cid, (counts.get(cid) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([category_id, count]) => ({ category_id, count }));
}
