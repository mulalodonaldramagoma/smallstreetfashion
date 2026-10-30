import type { Product, ProductTag } from '@/types';

export function getProductTags(product: Product): ProductTag[] {
  const tags: ProductTag[] = [];

  const created = new Date(product.created_at).getTime();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (created > thirtyDaysAgo) {
    tags.push('new');
  }

  if (product.is_featured) {
    tags.push('trending');
  }

  if (
    product.compare_at_price &&
    Number(product.compare_at_price) > Number(product.price)
  ) {
    tags.push('sale');
  }

  if (product.stock > 0 && product.stock <= 5) {
    tags.push('limited_stock');
  }

  return tags;
}

export function hasTag(product: Product, tag: ProductTag): boolean {
  return getProductTags(product).includes(tag);
}
