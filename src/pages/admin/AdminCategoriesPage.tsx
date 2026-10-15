import { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Save,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories } from '@/services/categoryService';
import { createCategory, updateCategory, deleteCategory, logAdminAction } from '@/services/adminService';
import type { Category } from '@/types';

export function AdminCategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCategories = () => {
    setLoading(true);
    fetchCategories()
      .then(setCategories)
      .catch((err) => setError('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadCategories();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name,
          slug: slug || slugify(name),
          description: description || undefined,
          image_url: imageUrl || null,
        });
        await logAdminAction({
          actor_id: user.id,
          action: 'category_update',
          target_type: 'category',
          target_id: editing.id,
          target_name: name,
        });
        setEditing(null);
        showSuccess('Category updated');
      } else {
        const created = await createCategory({
          name,
          slug: slug || slugify(name),
          description: description || undefined,
          image_url: imageUrl || null,
        });
        await logAdminAction({
          actor_id: user.id,
          action: 'category_create',
          target_type: 'category',
          target_id: created.id,
          target_name: name,
        });
        setCreating(false);
        showSuccess('Category created');
      }
      resetForm();
      loadCategories();
    } catch (err) {
      setError('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!user) return;
    if (!confirm(`Delete category "${cat.name}"? Products in this category will remain but become uncategorized.`)) return;
    try {
      await deleteCategory(cat.id);
      await logAdminAction({
        actor_id: user.id,
        action: 'category_delete',
        target_type: 'category',
        target_id: cat.id,
        target_name: cat.name,
      });
      showSuccess('Category deleted');
      loadCategories();
    } catch (err) {
      setError('Failed to delete category');
    }
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
  };

  const startEdit = (cat: Category) => {
    setEditing(cat);
    setCreating(false);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImageUrl(cat.image_url || '');
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    resetForm();
  };

  const cancelForm = () => {
    setEditing(null);
    setCreating(false);
    resetForm();
  };

  function slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Categories</h1>
        <p className="text-sm text-neutral-500">Manage product categories</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <Tag size={16} className="text-green-600" />
          <p className="text-xs text-green-700">{successMsg}</p>
        </div>
      )}

      {(editing || creating) ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-xl">
          <h3 className="font-bold text-neutral-900 mb-4">
            {editing ? 'Edit Category' : 'New Category'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="e.g. Dresses"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                placeholder="auto-generated from name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Image URL</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={cancelForm} className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2">
              <X size={16} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500">{categories.length} categories</p>
            <button
              onClick={startCreate}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Add Category
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <div key={cat.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                        <Tag size={16} className="text-neutral-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{cat.name}</p>
                      <p className="text-xs text-neutral-400 font-mono">{cat.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(cat)} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat)} className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
