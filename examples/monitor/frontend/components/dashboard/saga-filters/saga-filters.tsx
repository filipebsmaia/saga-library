'use client';

import { useState, useCallback } from 'react';
import { SagaStatus } from '@/lib/types/saga';
import { cn } from '@/lib/utils/format';
import styles from './saga-filters.module.scss';

export interface QuickFilterValues {
  stuck?: boolean;
  compensating?: boolean;
  activeOnly?: boolean;
  rootsOnly?: boolean;
  recentOnly?: boolean;
  incidentMode?: boolean;
}

export interface SagaFilterValues {
  status?: SagaStatus;
  sagaName?: string;
  searchId?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  quickFilters?: QuickFilterValues;
}

const PERIOD_OPTIONS = [
  { label: 'Any time', value: '' },
  { label: 'Last 5 min', value: '5m' },
  { label: 'Last 15 min', value: '15m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 24 hours', value: '24h' },
];

function periodToDateRange(period: string): { startDate?: string; endDate?: string } {
  if (!period) {
    return {};
  }
  const now = new Date();
  const ms: Record<string, number> = {
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '24h': 24 * 60 * 60_000,
  };
  const offset = ms[period];
  if (!offset) {
    return {};
  }
  return { startDate: new Date(now.getTime() - offset).toISOString() };
}

const QUICK_FILTERS: { key: keyof QuickFilterValues; label: string; tooltip: string }[] = [
  { key: 'stuck', label: 'Stuck', tooltip: 'Show sagas with no updates for 5+ minutes — may indicate a problem' },
  { key: 'compensating', label: 'Compensating', tooltip: 'Show sagas currently running compensation steps' },
  { key: 'activeOnly', label: 'Active', tooltip: 'Show only non-completed sagas (running or compensating)' },
  { key: 'rootsOnly', label: 'Roots only', tooltip: 'Show only root sagas, hiding child/forked sagas' },
  { key: 'recentOnly', label: 'Recent (<1m)', tooltip: 'Show sagas updated in the last 60 seconds' },
];

interface SagaFiltersProps {
  values: SagaFilterValues;
  onChange: (values: SagaFilterValues) => void;
}

export function SagaFilters({ values, onChange }: SagaFiltersProps) {
  const [nameInput, setNameInput] = useState(values.sagaName ?? '');
  const [idInput, setIdInput] = useState(values.searchId ?? '');

  const quickFilters = values.quickFilters ?? {};

  const toggleQuickFilter = useCallback(
    (key: keyof QuickFilterValues) => {
      const current = values.quickFilters ?? {};
      const next = { ...current, [key]: !current[key] };

      // If incident mode is being toggled ON, also activate activeOnly
      if (key === 'incidentMode' && !current.incidentMode) {
        next.activeOnly = true;
      }

      onChange({ ...values, quickFilters: next });
    },
    [values, onChange],
  );

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const status = event.target.value === '' ? undefined : (event.target.value as SagaStatus);
      onChange({ ...values, status });
    },
    [values, onChange],
  );

  const handlePeriodChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const period = event.target.value || undefined;
      const range = periodToDateRange(event.target.value);
      onChange({ ...values, period, startDate: range.startDate, endDate: range.endDate });
    },
    [values, onChange],
  );

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        onChange({ ...values, sagaName: nameInput || undefined });
      }
    },
    [values, nameInput, onChange],
  );

  const handleIdKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        onChange({ ...values, searchId: idInput || undefined });
      }
    },
    [values, idInput, onChange],
  );

  const handleClear = useCallback(() => {
    setNameInput('');
    setIdInput('');
    onChange({});
  }, [onChange]);

  const hasQuickFilters = Object.values(quickFilters).some(Boolean);
  const hasActiveFilters = values.status || values.sagaName || values.searchId || values.period || hasQuickFilters;

  return (
    <div className={styles.container}>
      <div className={styles.quickFilters}>
        {QUICK_FILTERS.map(({ key, label, tooltip }) => (
          <button
            key={key}
            className={cn(styles.toggleBtn, quickFilters[key] && styles.active)}
            onClick={() => toggleQuickFilter(key)}
            title={tooltip}
          >
            {label}
          </button>
        ))}
        <button
          className={cn(styles.toggleBtn, styles.incidentToggle, quickFilters.incidentMode && styles.incidentActive)}
          onClick={() => toggleQuickFilter('incidentMode')}
          title="Priority view: stuck first, then compensating. Auto-enables Active filter"
        >
          Incident Mode
        </button>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={values.status ?? ''}
          onChange={handleStatusChange}
        >
          <option value="">All Statuses</option>
          <option value={SagaStatus.RUNNING}>Running</option>
          <option value={SagaStatus.COMPENSATING}>Compensating</option>
          <option value={SagaStatus.COMPLETED}>Completed</option>
        </select>

        <input
          className={styles.input}
          type="text"
          placeholder="Saga name..."
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          onKeyDown={handleNameKeyDown}
          onBlur={() => onChange({ ...values, sagaName: nameInput || undefined })}
        />

        <input
          className={styles.input}
          type="text"
          placeholder="Search by ID..."
          value={idInput}
          onChange={(event) => setIdInput(event.target.value)}
          onKeyDown={handleIdKeyDown}
          onBlur={() => onChange({ ...values, searchId: idInput || undefined })}
        />

        <select
          className={styles.select}
          value={values.period ?? ''}
          onChange={handlePeriodChange}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={handleClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
