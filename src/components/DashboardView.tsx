import React from 'react';
import { Opportunity, DashboardStats } from '../types.ts';
import { OpportunityCard } from './OpportunityCard.tsx';
import { calculateDeadlineInfo } from '../lib/dateUtils.ts';
import {
  Compass,
  Clock,
  CheckCircle2,
  Bookmark,
  ShieldCheck,
  ArrowRight,
  Activity,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface DashboardViewProps {
  stats: DashboardStats | null;
  opportunities: Opportunity[];
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectOpportunity: (opportunity: Opportunity) => void;
  onNavigate: (view: 'opportunities' | 'portals' | 'checklist' | 'saved') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  opportunities,
  savedIds,
  onToggleSave,
  onSelectOpportunity,
  onNavigate
}) => {
  // Find urgent opportunities (< 15 days remaining)
  const urgentOpportunities = opportunities.filter((opp) => {
    const info = calculateDeadlineInfo(opp.deadline);
    return info.state === 'closing_soon';
  });

  return (
    <div className="space-y-8">
      {/* Hero Civic Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1A2B4C] via-[#243B6B] to-[#152647] rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-[#80F3DD] border border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-[#80F3DD]" />
            <span>Civic Clarity & Verified Schemes</span>
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Authoritative Guidance for Indian Students & Aspirants
          </h1>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-light">
            Discover verified scholarships, doctoral fellowships, and national competitive examinations with source citations, document checklists, and honest portal status audits.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('opportunities')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-[#1A2B4C] bg-white hover:bg-slate-100 rounded-lg shadow-sm transition-all"
            >
              <span>Explore All Schemes</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('portals')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
            >
              <Activity className="w-4 h-4 text-[#80F3DD]" />
              <span>Inspect Portal Status</span>
            </button>
          </div>
        </div>

        {/* Subtle background decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none">
          <Compass className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Metrics Ribbon (Calculated directly from stored SQL records) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Opportunities */}
        <div 
          onClick={() => onNavigate('opportunities')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] hover:border-[#0F9D8A] transition-all"
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-2">
            <span>Verified Schemes</span>
            <ShieldCheck className="w-4 h-4 text-[#0F9D8A]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display text-[#1F2937] tabular-nums">
            {stats ? stats.totalOpportunities : '—'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            {stats ? `${stats.scholarshipsCount} Scholarships · ${stats.examinationsCount} Exams` : 'Loading...'}
          </div>
        </div>

        {/* Urgent Deadlines */}
        <div 
          onClick={() => onNavigate('opportunities')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] hover:border-[#D97706] transition-all"
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-2">
            <span>Approaching Deadlines</span>
            <Clock className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display text-[#1F2937] tabular-nums">
            {stats ? stats.urgentDeadlinesCount : '—'}
          </div>
          <div className="text-xs text-[#B45309] font-medium mt-1">
            Closing within 15 days
          </div>
        </div>

        {/* Saved Opportunities */}
        <div 
          onClick={() => onNavigate('saved')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] hover:border-[#243B6B] transition-all"
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-2">
            <span>Your Tracked Items</span>
            <Bookmark className="w-4 h-4 text-[#243B6B]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display text-[#1F2937] tabular-nums">
            {stats ? stats.savedCount : '—'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            {stats && stats.completedChecklistSteps > 0
              ? `${stats.completedChecklistSteps} checklist items verified`
              : 'Add items to build checklist'}
          </div>
        </div>

        {/* Portal Reachability Health */}
        <div 
          onClick={() => onNavigate('portals')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] hover:border-[#16A34A] transition-all"
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-2">
            <span>Portal Reachability</span>
            <Activity className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-display text-[#16A34A] tabular-nums">
            {stats ? `${stats.portalHealth.healthRatio}%` : '—'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            {stats ? `${stats.portalHealth.reachablePortals} of ${stats.portalHealth.totalPortals} portals reachable` : 'Auditing...'}
          </div>
        </div>
      </div>

      {/* Urgent Attention Notice (if any scheme closing <= 15 days) */}
      {urgentOpportunities.length > 0 && (
        <div className="p-5 rounded-xl border border-[#FDE68A] bg-[#FEF3C7]/40 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#B45309]">
            <Clock className="w-4 h-4 text-[#B45309]" />
            <span>Active Deadlines Requiring Immediate Attention</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentOpportunities.map((opp) => (
              <div
                key={opp.id}
                onClick={() => onSelectOpportunity(opp)}
                className="cursor-pointer p-3.5 bg-white rounded-lg border border-[#FDE68A] hover:border-[#D97706] transition-all flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1A2B4C] line-clamp-1">
                    {opp.title}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    {opp.issuing_authority}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-[#B45309] bg-[#FEF3C7] tabular-nums">
                    {calculateDeadlineInfo(opp.deadline).label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Government Schemes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1A2B4C]">
              Featured Source-Backed Schemes
            </h2>
            <p className="text-xs text-[#64748B]">
              Rigorous eligibility documentation and verified application portals.
            </p>
          </div>

          <button
            onClick={() => onNavigate('opportunities')}
            className="text-xs font-semibold text-[#243B6B] hover:text-[#0F9D8A] transition-colors"
          >
            View All ({opportunities.length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.slice(0, 4).map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isSaved={savedIds.includes(opp.id)}
              onToggleSave={onToggleSave}
              onSelect={onSelectOpportunity}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
