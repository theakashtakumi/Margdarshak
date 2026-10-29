import React from 'react';
import { Opportunity } from '../types.ts';
import { OpportunityCard } from './OpportunityCard.tsx';
import { Bookmark, ArrowRight, ShieldCheck } from 'lucide-react';

interface SavedViewProps {
  savedOpportunities: Opportunity[];
  savedIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectOpportunity: (opportunity: Opportunity) => void;
  onBrowseOpportunities: () => void;
  onOpenChecklist: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  savedOpportunities,
  savedIds,
  onToggleSave,
  onSelectOpportunity,
  onBrowseOpportunities,
  onOpenChecklist
}) => {
  if (savedOpportunities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#E5EEFF] text-[#243B6B] flex items-center justify-center mx-auto shadow-xs">
          <Bookmark className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#1A2B4C]">
          No Saved Schemes Yet
        </h2>
        <p className="text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
          Bookmark opportunities to keep track of their approaching deadlines, download official calendar schedules, and monitor scheme document requirements.
        </p>
        <div className="pt-2">
          <button
            onClick={onBrowseOpportunities}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#243B6B] hover:bg-[#1A2B4C] rounded-lg shadow-sm transition-all"
          >
            <span>Explore Opportunities</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2B4C] tracking-tight">
            Saved Opportunities
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            You are actively tracking <span className="tabular-nums font-semibold text-[#1F2937]">{savedOpportunities.length}</span> scheme{savedOpportunities.length === 1 ? '' : 's'}.
          </p>
        </div>

        <button
          onClick={onOpenChecklist}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F9D8A] hover:bg-[#0B8272] rounded-lg shadow-sm transition-all"
        >
          <span>Open Application Checklist</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savedOpportunities.map((opp) => (
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
  );
};
