import React, { useState, useEffect } from 'react';
import { Opportunity } from '../types.ts';
import { OpportunityCard } from './OpportunityCard.tsx';
import { fetchOpportunities } from '../lib/api.ts';
import { Search, Filter, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react';
import { SortDropdown, SortOption } from './SortDropdown.tsx';

interface OpportunitiesViewProps {
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectOpportunity: (opportunity: Opportunity) => void;
  initialCategory?: string;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  savedIds,
  onToggleSave,
  onSelectOpportunity,
  initialCategory = 'all'
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(initialCategory);
  const [academicLevel, setAcademicLevel] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('deadline_soonest');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOpportunities({
        search,
        category,
        academic_level: academicLevel,
        status: statusFilter,
        sort: sortBy
      });
      setOpportunities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, academicLevel, statusFilter, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setAcademicLevel('all');
    setStatusFilter('all');
    setSortBy('deadline_soonest');
  };

  const hasActiveFilters = search !== '' || category !== 'all' || academicLevel !== 'all' || statusFilter !== 'all' || sortBy !== 'deadline_soonest';

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F9D8A] mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>OFFICIALLY SOURCED DIRECTORY</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2B4C] tracking-tight">
          Opportunities & Examination Schemes
        </h1>
        <p className="text-sm text-[#64748B] mt-1 max-w-2xl">
          Browse verified central and state financial assistance schemes, doctoral fellowships, and public examinations. Every listing is backed by an official gazette citation.
        </p>
      </div>

      {/* Search and Filters Strip */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] space-y-4">
        {/* Search Input & Modular Sort Dropdown */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by scheme name, issuing ministry, domain (.gov.in), or eligibility..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#1F2937] placeholder-[#94A3B8] focus:outline-none focus:border-[#0F9D8A] focus:ring-3 focus:ring-[#0F9D8A]/15 transition-all"
            />
          </div>

          <SortDropdown
            value={sortBy}
            onChange={(newSort) => setSortBy(newSort)}
          />
        </div>

        {/* Filter Rows (Segmented Buttons - Anti-Slop Discipline) */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium pt-1 border-t border-[#F1F5F9]">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Category:</span>
            <div className="inline-flex p-1 bg-[#F1F5F9] rounded-lg">
              <button
                onClick={() => setCategory('all')}
                className={`px-3 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  category === 'all'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategory('scholarship')}
                className={`px-3 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  category === 'scholarship'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Scholarships
              </button>
              <button
                onClick={() => setCategory('examination')}
                className={`px-3 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  category === 'examination'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Examinations
              </button>
            </div>
          </div>

          {/* Academic Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Target Tier:</span>
            <div className="inline-flex p-1 bg-[#F1F5F9] rounded-lg flex-wrap">
              <button
                onClick={() => setAcademicLevel('all')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === 'all'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Any
              </button>
              <button
                onClick={() => setAcademicLevel('10+2 / Secondary')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === '10+2 / Secondary'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                10+2
              </button>
              <button
                onClick={() => setAcademicLevel('Undergraduate')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === 'Undergraduate'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Undergraduate
              </button>
              <button
                onClick={() => setAcademicLevel('Postgraduate')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === 'Postgraduate'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Postgraduate
              </button>
              <button
                onClick={() => setAcademicLevel('Doctorate')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === 'Doctorate'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Doctorate
              </button>
              <button
                onClick={() => setAcademicLevel('Graduate')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  academicLevel === 'Graduate'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Graduate
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Status:</span>
            <div className="inline-flex p-1 bg-[#F1F5F9] rounded-lg">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('closing_soon')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === 'closing_soon'
                    ? 'bg-white text-[#B45309] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Closing Soon (&lt;15d)
              </button>
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === 'open'
                    ? 'bg-white text-[#15803D] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('unannounced')}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === 'unannounced'
                    ? 'bg-white text-[#1A2B4C] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#1F2937]'
                }`}
              >
                Dates Pending
              </button>
            </div>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#1A2B4C] transition-colors ml-auto py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabular Count Bar */}
      <div className="flex items-center justify-between text-xs text-[#64748B]">
        <div className="font-medium">
          Showing <span className="tabular-nums font-semibold text-[#1F2937]">{opportunities.length}</span> verified record{opportunities.length === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
          <span>Verified against .gov.in & .nic.in official sources</span>
        </div>
      </div>

      {/* Content Grid / Loading / Error / Empty States */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white rounded-xl border border-[#E2E8F0] animate-pulse p-5">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-white rounded-xl border border-[#FECACA] text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <h3 className="text-base font-semibold text-[#1F2937]">Unable to load opportunities</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#243B6B] rounded-lg hover:bg-[#1A2B4C] transition-colors"
          >
            Retry Request
          </button>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-[#E2E8F0] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#1F2937]">No matching opportunities found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            No published records match your active search terms or category criteria. Try broadening your filter selection.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-semibold text-[#243B6B] bg-[#E5EEFF] hover:bg-[#D3E4FE] rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isSaved={savedIds.includes(opp.id)}
              onToggleSave={onToggleSave}
              onSelect={onSelectOpportunity}
            />
          ))}
        </div>
      )}
    </div>
  );
};
