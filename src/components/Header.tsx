import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'opportunities' | 'portals' | 'checklist' | 'saved';
  onNavigate: (view: 'dashboard' | 'opportunities' | 'portals' | 'checklist' | 'saved') => void;
  onOpenQuickMatch: () => void;
  savedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenQuickMatch,
  savedCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F9D8A] rounded-md px-1 py-0.5 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-[#243B6B] flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5 text-[#80F3DD]" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-[#1A2B4C] whitespace-nowrap shrink-0">
            Margdarshak
          </span>
        </button>

        {/* Zone 2: Navigation Links (Single-line, unboxed, subtle hover) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'dashboard'
                ? 'text-[#243B6B] font-semibold border-b-2 border-[#243B6B]'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('opportunities')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'opportunities'
                ? 'text-[#243B6B] font-semibold border-b-2 border-[#243B6B]'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            Opportunities
          </button>
          <button
            onClick={() => onNavigate('portals')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'portals'
                ? 'text-[#243B6B] font-semibold border-b-2 border-[#243B6B]'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            Portals
          </button>
          <button
            onClick={() => onNavigate('checklist')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'checklist'
                ? 'text-[#243B6B] font-semibold border-b-2 border-[#243B6B]'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            Checklist
          </button>
          <button
            onClick={() => onNavigate('saved')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 flex items-center gap-1.5 ${
              currentView === 'saved'
                ? 'text-[#243B6B] font-semibold border-b-2 border-[#243B6B]'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <span>Saved</span>
            {savedCount > 0 && (
              <span className="text-xs font-semibold tabular-nums text-[#0F9D8A]">
                ({savedCount})
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenQuickMatch}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#243B6B] hover:bg-[#1A2B4C] rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0 focus-visible:ring-2 focus-visible:ring-[#0F9D8A]"
          >
            <Sparkles className="w-4 h-4 text-[#80F3DD]" />
            <span>Quick Match</span>
          </button>
        </div>

      </div>

      {/* Mobile navigation row */}
      <div className="md:hidden border-t border-[#E2E8F0] px-4 py-2 flex items-center justify-around text-xs font-medium bg-white">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`py-1.5 px-2.5 rounded ${currentView === 'dashboard' ? 'text-[#243B6B] font-semibold bg-[#F1F5F9]' : 'text-[#64748B]'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onNavigate('opportunities')}
          className={`py-1.5 px-2.5 rounded ${currentView === 'opportunities' ? 'text-[#243B6B] font-semibold bg-[#F1F5F9]' : 'text-[#64748B]'}`}
        >
          Schemes
        </button>
        <button
          onClick={() => onNavigate('portals')}
          className={`py-1.5 px-2.5 rounded ${currentView === 'portals' ? 'text-[#243B6B] font-semibold bg-[#F1F5F9]' : 'text-[#64748B]'}`}
        >
          Portals
        </button>
        <button
          onClick={() => onNavigate('checklist')}
          className={`py-1.5 px-2.5 rounded ${currentView === 'checklist' ? 'text-[#243B6B] font-semibold bg-[#F1F5F9]' : 'text-[#64748B]'}`}
        >
          Checklist
        </button>
        <button
          onClick={() => onNavigate('saved')}
          className={`py-1.5 px-2.5 rounded ${currentView === 'saved' ? 'text-[#243B6B] font-semibold bg-[#F1F5F9]' : 'text-[#64748B]'}`}
        >
          Saved {savedCount > 0 ? `(${savedCount})` : ''}
        </button>
      </div>
    </header>
  );
};
