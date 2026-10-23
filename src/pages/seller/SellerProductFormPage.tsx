import { useState, useEffect } from 'react';
import { Save, Upload, X, AlertCircle } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore, useCategories } from '@/hooks/useData';
import { createProduct, updateProduct, addProductImage, deleteProductImages, uploadProductImage, validateImageFile, fetchSellerProductById } from '@/services/productService';
import { navigateTo } from '@/hooks/useRouter';
import type { Category } from '@/types';

const clothingSizes = ['S', 'M', 'L', 'XL', 'XXL'];
const shoeSizes = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const commonColours = ['Black', 'White', 'Red', 'Blue', 'Navy', 'Grey', 'Brown', 'Beige', 'Green', 'Olive', 'Yellow', 'Orange', 'Pink', 'Purple', 'Tan', 'Mustard', 'Silver', 'Gold', 'Floral'];

interface SellerProductFormPageProps {
  productId?: string;
}

export function SellerProductFormPage({ productId }: SellerProductFormPageProps) {
  const { user } = useAuth();
  const { data: store } = useSellerStore(user?.id ?? null);
  const { data: categories } = useCategories();
  const isEditing = !!productId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColours, setSelectedColours] = useState<string[]>([]);
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingAdditional, setUploadingAdditional] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);

  // Load existing product if editing
  useEffect(() => {
    if (!productId || !store) return;
    setLoadingProduct(true);
    fetchSellerProductById(productId, store.id)
      .then((p) => {
        if (!p) return;
        setName(p.name);
        setDescription(p.description || '');
        setCategoryId(p.category_id || '');
        setPrice(String(p.price));
        setCompareAtPrice(p.compare_at_price ? String(p.compare_at_price) : '');
        setStock(String(p.stock));
        setSku(p.sku || '');
        setSelectedSizes(p.sizes);
        setSelectedColours(p.colours);
        setMainImageUrl(p.main_image_url);
        setAdditionalImages(p.product_images?.map((img) => img.image_url) || []);
        setIsActive(p.is_active);
      })
      .catch(() => setFormError('Unable to load product for editing.'))
      .finally(() => setLoadingProduct(false));
  }, [productId, store]);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColour = (colour: string) => {
    setSelectedColours((prev) =>
      prev.includes(colour) ? prev.filter((c) => c !== colour) : [...prev, colour]
    );
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setUploadingMain(true);
    setFormError(null);
    try {
      const url = await uploadProductImage(file, user.id);
      setMainImageUrl(url);
    } catch {
      setFormError('Your image could not be uploaded. Please try again.');
    } finally {
      setUploadingMain(false);
    }
  };

  const handleAdditionalImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;
    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }
    setUploadingAdditional(true);
    setFormError(null);
    try {
      const urls = await Promise.all(
        files.map((file) => uploadProductImage(file, user.id))
      );
      setAdditionalImages((prev) => [...prev, ...urls]);
    } catch {
      setFormError('One or more images could not be uploaded.');
    } finally {
      setUploadingAdditional(false);
    }
  };

  const removeAdditionalImage = (url: string) => {
    setAdditionalImages((prev) => prev.filter((u) => u !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) {
      setFormError('Please create your store before adding products.');
      return;
    }

    // Validate
    const errors: string[] = [];
    if (!name.trim()) errors.push('Product name is required.');
    if (!categoryId) errors.push('Please select a category.');
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) errors.push('Price must be zero or greater.');
    if (compareAtPrice) {
      const compareNum = Number(compareAtPrice);
      if (isNaN(compareNum) || compareNum < 0) errors.push('Compare-at price must be zero or greater.');
    }
    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      errors.push('Stock quantity must be a whole number zero or greater.');
    }

    if (errors.length > 0) {
      setFormError(errors.join(' '));
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const productData = {
        store_id: store.id,
        category_id: categoryId || null,
        name: name.trim(),
        description: description.trim(),
        sku: sku.trim(),
        price: priceNum,
        compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
        stock: stockNum,
        sizes: selectedSizes,
        colours: selectedColours,
        main_image_url: mainImageUrl,
        is_active: isActive,
      };

      let savedProductId: string;

      if (isEditing && productId) {
        await updateProduct(productId, productData);
        await deleteProductImages(productId);
        savedProductId = productId;
      } else {
        const created = await createProduct(productData);
        savedProductId = created.id;
      }

      // Save additional images
      for (let i = 0; i < additionalImages.length; i++) {
        await addProductImage(savedProductId, additionalImages[i], i);
      }

      navigateTo('/seller/products');
    } catch (err) {
      setFormError('Your product could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProduct) {
    return (
      <SellerLayout activePage={isEditing ? 'products' : 'add-product'}>
        <div className="h-96 bg-neutral-100 rounded-xl animate-pulse" />
      </SellerLayout>
    );
  }

  if (!store && !isEditing) {
    return (
      <SellerLayout activePage="add-product">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle size={26} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-neutral-900 mb-2">Please create your store first</h2>
          <p className="text-sm text-neutral-500 mb-4">You need a store before you can add products.</p>
          <button
            onClick={() => navigateTo('/seller/store')}
            className="px-5 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Create Store
          </button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout activePage={isEditing ? 'products' : 'add-product'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isEditing ? 'Update your product details' : 'Add a new product to your store'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            {formError}
          </div>
        )}

        {/* Main Image */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Main Product Image</label>
          <div className="relative w-40 h-40 rounded-lg overflow-hidden border-2 border-dashed border-neutral-300 hover:border-neutral-400 transition-colors">
            {mainImageUrl ? (
              <img src={mainImageUrl} alt="Main" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                <Upload size={24} />
                <span className="text-xs mt-2">Upload image</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleMainImageUpload}
              disabled={uploadingMain}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {uploadingMain && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <span className="text-sm text-neutral-600">Uploading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Images */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Additional Images</label>
          <div className="flex flex-wrap gap-3">
            {additionalImages.map((url, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-neutral-200 group">
                <img src={url} alt={`Additional ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAdditionalImage(url)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-24 h-24 rounded-lg border-2 border-dashed border-neutral-300 hover:border-neutral-400 transition-colors flex flex-col items-center justify-center cursor-pointer text-neutral-400">
              <Upload size={18} />
              <span className="text-xs mt-1">Add</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAdditionalImages}
                disabled={uploadingAdditional}
                className="hidden"
              />
            </label>
          </div>
          {uploadingAdditional && (
            <p className="text-xs text-neutral-500 mt-2">Uploading images...</p>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="e.g. Elegant Satin Dress"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              placeholder="Describe your product..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="">Select a category</option>
              {(categories as Category[] | null)?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Price (R) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="399"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Compare-at Price (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="599"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="e.g. WSD-001"
            />
          </div>
        </div>

        {/* Sizes */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Available Sizes</label>
          <p className="text-xs text-neutral-400 mb-3">Clothing sizes:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {clothingSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={`min-w-[44px] h-10 px-3 text-sm font-medium rounded-lg border transition-colors ${
                  selectedSizes.includes(size)
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mb-3">Shoe sizes (South African):</p>
          <div className="flex flex-wrap gap-2">
            {shoeSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={`min-w-[44px] h-10 px-3 text-sm font-medium rounded-lg border transition-colors ${
                  selectedSizes.includes(size)
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Colours */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Available Colours</label>
          <div className="flex flex-wrap gap-2">
            {commonColours.map((colour) => (
              <button
                key={colour}
                type="button"
                onClick={() => toggleColour(colour)}
                className={`px-3 h-10 text-sm font-medium rounded-lg border transition-colors ${
                  selectedColours.includes(colour)
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {colour}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 accent-neutral-900"
            />
            <span className="text-sm font-medium text-neutral-700">Active (visible to customers)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Product'}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/seller/products')}
            className="px-6 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </SellerLayout>
  );
}
