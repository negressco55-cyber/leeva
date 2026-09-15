'use client';

import { WEEKDAYS, WEEKDAY_LABELS, type BusinessHours, type DayHours, type Weekday } from '@leeva/shared/services/business-hours';

const DEFAULT_DAY: DayHours = { open: '08:00', close: '22:00', closed: false };

export function BusinessHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: BusinessHours;
  onChange: (v: BusinessHours) => void;
  disabled?: boolean;
}) {
  function setDay(day: Weekday, patch: Partial<DayHours>) {
    onChange({ ...value, [day]: { ...(value[day] ?? DEFAULT_DAY), ...patch } });
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {WEEKDAYS.map((day) => {
        const d = value[day] ?? DEFAULT_DAY;
        return (
          <div key={day} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 80, fontSize: 13 }}>{WEEKDAY_LABELS[day]}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={d.closed}
                disabled={disabled}
                onChange={(e) => setDay(day, { closed: e.target.checked })}
              />
              Fechado
            </label>
            {!d.closed && (
              <>
                <input
                  className="input sm"
                  type="time"
                  value={d.open}
                  disabled={disabled}
                  onChange={(e) => setDay(day, { open: e.target.value })}
                  style={{ width: 110 }}
                />
                <span className="muted" style={{ fontSize: 12 }}>até</span>
                <input
                  className="input sm"
                  type="time"
                  value={d.close}
                  disabled={disabled}
                  onChange={(e) => setDay(day, { close: e.target.value })}
                  style={{ width: 110 }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
