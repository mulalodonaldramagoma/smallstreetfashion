import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  X,
  Store as StoreIcon,
  Save,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/utils/format';
import {
  fetchAllDeliveryMethods,
  fetchAllDeliveryZones,
  createDeliveryMethod,
  updateDeliveryMethod,
  deleteDeliveryMethod,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from '@/services/deliveryService';
import {
  fetchAllCourierProviders,
  createCourierProvider,
  updateCourierProvider,
  deleteCourierProvider,
} from '@/services/courierService';
import type { DeliveryMethod, DeliveryZone, CourierProvider } from '@/types';

type Tab = 'methods' | 'zones' | 'couriers';

export function AdminDeliverySettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('methods');
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [couriers, setCouriers] = useState<CourierProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAllDeliveryMethods(), fetchAllDeliveryZones(), fetchAllCourierProviders()])
      .then(([m, z, c]) => {
        setMethods(m);
        setZones(z);
        setCouriers(c);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load settings');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
          <Truck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Delivery Settings</h1>
          <p className="text-sm text-neutral-500">
            Configure delivery methods, fees, and delivery zones
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <Check size={16} className="text-green-600" />
          <p className="text-xs text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('methods')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'methods' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Delivery Methods
        </button>
        <button
          onClick={() => setTab('zones')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'zones' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Delivery Zones
        </button>
        <button
          onClick={() => setTab('couriers')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'couriers' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Couriers
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : tab === 'methods' ? (
        <MethodsTab
          methods={methods}
          zones={zones}
          onChanged={() => { loadData(); showSuccess('Delivery method saved'); }}
          onError={(e) => setError(e)}
        />
      ) : tab === 'zones' ? (
        <ZonesTab
          zones={zones}
          onChanged={() => { loadData(); showSuccess('Delivery zone saved'); }}
          onError={(e) => setError(e)}
        />
      ) : (
        <CouriersTab
          couriers={couriers}
          onChanged={() => { loadData(); showSuccess('Courier provider saved'); }}
          onError={(e) => setError(e)}
        />
      )}
    </div>
  );
}

// --- Methods Tab ---

function MethodsTab({
  methods,
  zones,
  onChanged,
  onError,
}: {
  methods: DeliveryMethod[];
  zones: DeliveryZone[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<DeliveryMethod | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <MethodForm
        zones={zones}
        onSave={async (params) => {
          try {
            await createDeliveryMethod(params);
            setCreating(false);
            onChanged();
          } catch (err) {
            onError('Failed to create method');
          }
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <MethodForm
        method={editing}
        zones={zones}
        onSave={async (params) => {
          try {
            await updateDeliveryMethod(editing.id, params);
            setEditing(null);
            onChanged();
          } catch (err) {
            onError('Failed to update method');
          }
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{methods.length} delivery methods configured</p>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Method
        </button>
      </div>

      <div className="space-y-3">
        {methods.map((method) => (
          <div key={method.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                method.type === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {method.type === 'pickup' ? <StoreIcon size={18} /> : <Truck size={18} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{method.name}</p>
                  {!method.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {method.type === 'pickup' ? 'Store Pickup' : 'Delivery'}
                  {method.estimated_days && ` · ${method.estimated_days}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-neutral-900">
                {Number(method.fee) === 0 ? 'Free' : formatPrice(Number(method.fee))}
              </span>
              <button
                onClick={() => setEditing(method)}
                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteDeliveryMethod(method.id);
                    onChanged();
                  } catch (err) {
                    onError('Failed to delete method');
                  }
                }}
                className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Method Form ---

function MethodForm({
  method,
  zones,
  onSave,
  onCancel,
}: {
  method?: DeliveryMethod;
  zones: DeliveryZone[];
  onSave: (params: {
    name: string;
    description?: string;
    fee: number;
    estimated_days?: string;
    is_active: boolean;
    sort_order: number;
    type: 'delivery' | 'pickup';
    zone_id?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(method?.name || '');
  const [description, setDescription] = useState(method?.description || '');
  const [fee, setFee] = useState(String(method?.fee ?? 0));
  const [estimatedDays, setEstimatedDays] = useState(method?.estimated_days || '');
  const [isActive, setIsActive] = useState(method?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(method?.sort_order ?? 0));
  const [type, setType] = useState<'delivery' | 'pickup'>(method?.type || 'delivery');
  const [zoneId, setZoneId] = useState(method?.zone_id || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        fee: Number(fee),
        estimated_days: estimatedDays || undefined,
        is_active: isActive,
        sort_order: Number(sortOrder),
        type,
        zone_id: zoneId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-xl">
      <h3 className="font-bold text-neutral-900 mb-4">
        {method ? 'Edit Delivery Method' : 'New Delivery Method'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Standard Delivery"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Optional short description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Fee (R) *</label>
            <input
              type="number"
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Est. Time</label>
            <input
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="e.g. 2-3 days"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'delivery' | 'pickup')}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="delivery">Delivery</option>
              <option value="pickup">Store Pickup</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>
        {type === 'delivery' && zones.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Linked Zone (optional)</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="">No specific zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-neutral-900"
          />
          <label htmlFor="is_active" className="text-sm text-neutral-700">Active (visible to customers)</label>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {method ? 'Save Changes' : 'Create Method'}
        </button>
      </div>
    </div>
  );
}

// --- Zones Tab ---

function ZonesTab({
  zones,
  onChanged,
  onError,
}: {
  zones: DeliveryZone[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <ZoneForm
        onSave={async (params) => {
          try {
            await createDeliveryZone(params);
            setCreating(false);
            onChanged();
          } catch (err) {
            onError('Failed to create zone');
          }
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <ZoneForm
        zone={editing}
        onSave={async (params) => {
          try {
            await updateDeliveryZone(editing.id, params);
            setEditing(null);
            onChanged();
          } catch (err) {
            onError('Failed to update zone');
          }
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{zones.length} delivery zones configured</p>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Zone
        </button>
      </div>

      <div className="space-y-3">
        {zones.map((zone) => (
          <div key={zone.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <MapPin size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{zone.name}</p>
                  {!zone.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactive</span>
                  )}
                </div>
                {zone.description && (
                  <p className="text-xs text-neutral-500">{zone.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-neutral-900">
                {Number(zone.base_fee) === 0 ? 'Free' : formatPrice(Number(zone.base_fee))}
              </span>
              <button
                onClick={() => setEditing(zone)}
                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteDeliveryZone(zone.id);
                    onChanged();
                  } catch (err) {
                    onError('Failed to delete zone');
                  }
                }}
                className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Zone Form ---

function ZoneForm({
  zone,
  onSave,
  onCancel,
}: {
  zone?: DeliveryZone;
  onSave: (params: {
    name: string;
    description?: string;
    base_fee: number;
    is_active: boolean;
    sort_order: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(zone?.name || '');
  const [description, setDescription] = useState(zone?.description || '');
  const [baseFee, setBaseFee] = useState(String(zone?.base_fee ?? 0));
  const [isActive, setIsActive] = useState(zone?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(zone?.sort_order ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        base_fee: Number(baseFee),
        is_active: isActive,
        sort_order: Number(sortOrder),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-xl">
      <h3 className="font-bold text-neutral-900 mb-4">
        {zone ? 'Edit Delivery Zone' : 'New Delivery Zone'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Zone Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Johannesburg CBD"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Central Johannesburg area"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Base Fee (R) *</label>
            <input
              type="number"
              step="0.01"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="zone_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-neutral-900"
          />
          <label htmlFor="zone_active" className="text-sm text-neutral-700">Active (visible at checkout)</label>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {zone ? 'Save Changes' : 'Create Zone'}
        </button>
      </div>
    </div>
  );
}

// --- Couriers Tab ---

function CouriersTab({
  couriers,
  onChanged,
  onError,
}: {
  couriers: CourierProvider[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<CourierProvider | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CourierProviderForm
        onSave={async (params) => {
          try {
            await createCourierProvider(params);
            setCreating(false);
            onChanged();
          } catch (err) {
            onError('Failed to create courier provider');
          }
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editing) {
    return (
      <CourierProviderForm
        provider={editing}
        onSave={async (params) => {
          try {
            await updateCourierProvider(editing.id, params);
            setEditing(null);
            onChanged();
          } catch (err) {
            onError('Failed to update courier provider');
          }
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-neutral-500">{couriers.length} courier providers configured</p>
          <p className="text-xs text-neutral-400 mt-1">
            API credentials are stored securely on the server and are not shown here.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Provider
        </button>
      </div>

      <div className="space-y-3">
        {couriers.map((provider) => (
          <div key={provider.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                provider.is_demo ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {provider.is_demo ? <KeyRound size={18} /> : <Truck size={18} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{provider.name}</p>
                  {!provider.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Inactive</span>
                  )}
                  {provider.is_demo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Demo</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 font-mono">{provider.code}</p>
                {provider.tracking_url_template && (
                  <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-xs">
                    Track URL: {provider.tracking_url_template}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs flex items-center gap-1 font-medium ${
                provider.is_demo ? 'text-amber-600' : 'text-green-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${provider.is_demo ? 'bg-amber-400' : 'bg-green-400'}`} />
                {provider.is_demo ? 'Test Mode' : 'Live'}
              </span>
              <button
                onClick={() => setEditing(provider)}
                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteCourierProvider(provider.id);
                    onChanged();
                  } catch (err) {
                    onError('Failed to delete provider');
                  }
                }}
                className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={16} className="text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900">Credential Status</h3>
        </div>
        <p className="text-xs text-neutral-500">
          Courier API credentials are stored as edge function secrets on the server and are never exposed
          in the frontend or database. To add credentials for a real courier provider, set the appropriate
          environment variable (e.g. <code className="text-neutral-700 bg-neutral-200 px-1 rounded">COURIER_API_KEY</code>)
          in your Supabase project secrets. The demo courier is always available for testing without credentials.
        </p>
      </div>
    </div>
  );
}

// --- Courier Provider Form ---

function CourierProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider?: CourierProvider;
  onSave: (params: {
    code: string;
    name: string;
    is_active: boolean;
    is_demo: boolean;
    tracking_url_template?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(provider?.code || '');
  const [name, setName] = useState(provider?.name || '');
  const [isActive, setIsActive] = useState(provider?.is_active ?? true);
  const [isDemo, setIsDemo] = useState(provider?.is_demo ?? false);
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState(provider?.tracking_url_template || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        code: code.toLowerCase().replace(/\s+/g, '_'),
        name,
        is_active: isActive,
        is_demo: isDemo,
        tracking_url_template: trackingUrlTemplate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-xl">
      <h3 className="font-bold text-neutral-900 mb-4">
        {provider ? 'Edit Courier Provider' : 'New Courier Provider'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Display Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Ardent Express"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Code *</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!!provider}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400 font-mono"
            placeholder="e.g. ardent_express"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Unique identifier used by the edge function adapter. Cannot be changed after creation.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tracking URL Template</label>
          <input
            value={trackingUrlTemplate}
            onChange={(e) => setTrackingUrlTemplate(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="https://courier.com/track/{tracking_number}"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Use <code className="bg-neutral-100 px-1 rounded">{'{tracking_number}'}</code> as placeholder.
            Only use the documented URL format from the courier provider.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cp_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-neutral-900"
          />
          <label htmlFor="cp_active" className="text-sm text-neutral-700">Active (available for sellers)</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cp_demo"
            checked={isDemo}
            onChange={(e) => setIsDemo(e.target.checked)}
            className="w-4 h-4 accent-neutral-900"
          />
          <label htmlFor="cp_demo" className="text-sm text-neutral-700">
            Demo mode (generates test tracking numbers, no live API calls)
          </label>
        </div>
        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              Demo providers generate mock tracking numbers and never connect to a real courier API.
              Use for testing the shipment workflow without a live courier account.
            </p>
          </div>
        )}
        {!isDemo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              For live providers, the matching API adapter and credentials must be configured in
              Supabase edge function secrets. Without credentials, the system falls back to demo mode.
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <X size={16} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !code.trim()}
          className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {provider ? 'Save Changes' : 'Create Provider'}
        </button>
      </div>
    </div>
  );
}
