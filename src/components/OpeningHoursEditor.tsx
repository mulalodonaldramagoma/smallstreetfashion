import { Plus, Trash2, Clock } from 'lucide-react';
import type { OpeningHours, OpeningHourDay } from '@/types';
import { DAYS_OF_WEEK, formatTime12h } from '@/utils/storeUtils';

interface OpeningHoursEditorProps {
  hours: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}

export function OpeningHoursEditor({ hours, onChange }: OpeningHoursEditorProps) {
  const updateDay = (day: number, updates: Partial<OpeningHourDay>) => {
    onChange(hours.map((d) => (d.day === day ? { ...d, ...updates } : d)));
  };

  const addPeriod = (day: number) => {
    const dayData = hours.find((d) => d.day === day);
    if (!dayData) return;
    updateDay(day, {
      periods: [...dayData.periods, { open: '09:00', close: '17:00' }],
      is_closed: false,
    });
  };

  const removePeriod = (day: number, index: number) => {
    const dayData = hours.find((d) => d.day === day);
    if (!dayData) return;
    updateDay(day, { periods: dayData.periods.filter((_, i) => i !== index) });
  };

  const updatePeriod = (day: number, index: number, field: 'open' | 'close', value: string) => {
    const dayData = hours.find((d) => d.day === day);
    if (!dayData) return;
    updateDay(day, {
      periods: dayData.periods.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    });
  };

  return (
    <div className="space-y-1">
      {DAYS_OF_WEEK.map((dayInfo) => {
        const dayData = hours.find((d) => d.day === dayInfo.day);
        if (!dayData) return null;
        return (
          <div key={dayInfo.day} className="flex flex-col sm:flex-row sm:items-start gap-2 py-2.5 border-b border-neutral-100 last:border-0">
            <div className="sm:w-28 flex items-center justify-between sm:justify-start gap-2 shrink-0">
              <span className="text-sm font-medium text-neutral-700">{dayInfo.label}</span>
              <label className="flex items-center gap-1.5 cursor-pointer sm:hidden">
                <input
                  type="checkbox"
                  checked={dayData.is_closed}
                  onChange={(e) => updateDay(dayInfo.day, { is_closed: e.target.checked, periods: e.target.checked ? [] : dayData.periods.length > 0 ? dayData.periods : [{ open: '09:00', close: '17:00' }] })}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-xs text-neutral-500">Closed</span>
              </label>
            </div>

            <div className="flex-1">
              {dayData.is_closed || dayData.periods.length === 0 ? (
                <span className="text-sm text-neutral-400 italic">Closed</span>
              ) : (
                <div className="space-y-2">
                  {dayData.periods.map((period, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={period.open}
                        onChange={(e) => updatePeriod(dayInfo.day, idx, 'open', e.target.value)}
                        className="px-2 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      <span className="text-xs text-neutral-400">to</span>
                      <input
                        type="time"
                        value={period.close}
                        onChange={(e) => updatePeriod(dayInfo.day, idx, 'close', e.target.value)}
                        className="px-2 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                      {period.open && period.close && (
                        <span className="text-xs text-neutral-400 hidden sm:inline">
                          ({formatTime12h(period.open)} – {formatTime12h(period.close)})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePeriod(dayInfo.day, idx)}
                        className="p-1 text-neutral-300 hover:text-rose-500 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPeriod(dayInfo.day)}
                    className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> Add split shift
                  </button>
                </div>
              )}
            </div>

            <label className="hidden sm:flex items-center gap-1.5 cursor-pointer shrink-0 sm:w-20 sm:justify-end">
              <input
                type="checkbox"
                checked={dayData.is_closed}
                onChange={(e) => updateDay(dayInfo.day, { is_closed: e.target.checked, periods: e.target.checked ? [] : dayData.periods.length > 0 ? dayData.periods : [{ open: '09:00', close: '17:00' }] })}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <span className="text-xs text-neutral-500">Closed</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function OpeningHoursPreview({ hours }: { hours: OpeningHours | null }) {
  if (!hours || hours.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400 mt-2">
      <Clock size={12} />
      <span>{hours.filter((d) => !d.is_closed && d.periods.length > 0).length} days open</span>
    </div>
  );
}
