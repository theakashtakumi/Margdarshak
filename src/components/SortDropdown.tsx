import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export type SortOption = 'deadline_soonest' | 'recently_updated' | 'alphabetical';

export interface SortDropdownProps {
  value: SortOption | string;
  onChange: (value: SortOption) => void;
  className?: string;
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'deadline_soonest', label: 'Soonest Deadline' },
  { value: 'recently_updated', label: 'Recently Updated' },
  { value: 'alphabetical', label: 'Alphabetical' }
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      <label
        htmlFor="opportunity-sort-select"
        className="text-xs font-semibold text-[#64748B] whitespace-nowrap flex items-center gap-1.5"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-[#243B6B]" />
        <span>Sort by:</span>
      </label>
      <select
        id="opportunity-sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="text-xs font-semibold py-2 px-3 bg-white border border-[#CBD5E1] rounded-lg text-[#1F2937] focus:outline-none focus:border-[#0F9D8A] focus:ring-2 focus:ring-[#0F9D8A]/15 transition-all cursor-pointer shadow-xs hover:border-[#94A3B8]"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
