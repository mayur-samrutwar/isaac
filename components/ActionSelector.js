import { useMemo } from 'react';

export default function ActionSelector({ actions = [], value, onChange, disabled = false }) {
  const options = useMemo(() => actions.filter(Boolean), [actions]);

  return (
    <div className="w-full max-w-md">
      <label className="block text-white font-mono text-sm mb-2">Select an action</label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-white text-black px-4 py-3 pr-10 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
        >
          <option value="" disabled>
            Choose an action…
          </option>
          {options.map((opt) => (
            <option key={opt.id || opt.value} value={opt.id || opt.value}>
              {opt.label || opt.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
}


