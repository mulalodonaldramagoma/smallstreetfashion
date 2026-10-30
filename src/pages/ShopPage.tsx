import { useProductFilters } from '@/hooks/useProductFilters';
import { ProductGrid } from '@/components/ProductGrid';
import { useEffect, useState } from 'react';
import { fetchVisibleCategoryTree } from '@/services/categoryService';
import { navigateTo } from '@/hooks/useRouter';
import { ChevronRight, Home } from 'lucide-react';
import type { CategoryWithChildren } from '@/types';

interface ShopPageProps {
  category?: string;
}

export function ShopPage({ category }: ShopPageProps) {
  const hook = useProductFilters(category);
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);

  useEffect(() => {
    fetchVisibleCategoryTree().then(setTree).catch(() => {});
  }, []);

  const { deptName, subName } = (() => {
    if (!category || category === 'all') return { deptName: null, subName: null };
    for (const dept of tree) {
      if (dept.slug === category) return { deptName: dept.name, subName: null };
      const sub = dept.children.find((c) => c.slug === category);
      if (sub) return { deptName: dept.name, subName: sub.name };
    }
    const fallback = category.charAt(0).toUpperCase() + category.slice(1);
    return { deptName: fallback, subName: null };
  })();

  const heading = subName || deptName || 'Shop All Products';

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-neutral-500 mb-4">
        <button onClick={() => navigateTo('/')} className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
          <Home size={14} /> Home
        </button>
        {deptName && (
          <>
            <ChevronRight size={14} className="text-neutral-300" />
            <button
              onClick={() => navigateTo(`/products/${category && category !== 'all' ? findDeptSlug(tree, category) : 'all'}`)}
              className="hover:text-neutral-900 transition-colors"
            >
              {deptName}
            </button>
          </>
        )}
        {subName && (
          <>
            <ChevronRight size={14} className="text-neutral-300" />
            <span className="text-neutral-900 font-medium">{subName}</span>
          </>
        )}
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">{heading}</h1>
        <p className="text-neutral-500 mt-1">
          {subName
            ? `${subName} in ${deptName}`
            : deptName
            ? `Browse all ${deptName} fashion from Small Street stores`
            : 'Browse the latest fashion from Small Street stores'}
        </p>
      </div>
      <ProductGrid hook={hook} emptyMessage={`No products found in ${heading}. Try adjusting your filters or check back later.`} />
    </div>
  );
}

function findDeptSlug(tree: CategoryWithChildren[], slug: string): string | null {
  for (const dept of tree) {
    if (dept.slug === slug) return dept.slug;
    if (dept.children.some((c) => c.slug === slug)) return dept.slug;
  }
  return null;
}
