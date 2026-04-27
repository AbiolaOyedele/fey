import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DISMISSED_KEY = 'whats_new_dismissed_version';

/**
 * Fetch the single latest entry from the whats_new table.
 * Returns null on error or if table is empty.
 */
export async function fetchLatestWhatsNew() {
  const { data, error } = await supabase
    .from('whats_new')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    features: Array.isArray(data.features) ? data.features : JSON.parse(data.features || '[]'),
    images:   Array.isArray(data.images)   ? data.images   : JSON.parse(data.images   || '[]'),
  };
}

export function getDismissedVersion() {
  return localStorage.getItem(DISMISSED_KEY) || '';
}

export function dismissVersion(version) {
  localStorage.setItem(DISMISSED_KEY, version);
}

export default function WhatsNewPopup({ open, onClose }) {
  const [entry, setEntry] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEntry(null);
    setCarouselIndex(0);
    fetchLatestWhatsNew().then((e) => { if (e) setEntry(e); });
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    if (entry?.version) dismissVersion(entry.version);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  if (!open) return null;

  const images   = entry?.images   || [];
  const features = entry?.features || [];
  const version  = entry?.version  || '';
  const title    = entry?.title    || 'New in WorkBoard';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] animate-fadeIn">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden ${
          closing ? 'animate-scale-out' : 'animate-scale-in'
        }`}
      >
        <div className="flex flex-col md:flex-row min-h-[340px]">
          {/* Left column — accent background */}
          <div
            className="w-full md:w-[44%] p-6 flex flex-col min-h-[200px] md:min-h-0"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {/* Rotating seal badge */}
            <div className="mb-5">
              <div className="relative inline-flex items-center justify-center w-16 h-16">
                <svg
                  viewBox="0 0 295 295"
                  className="absolute inset-0 w-full h-full animate-slow-rotate"
                  fill="rgba(255,255,255,0.25)"
                >
                  <path d="M280.977,118.478c-13.619-10.807-20.563-27.57-18.574-44.845c1.3-11.3-2.566-22.393-10.607-30.432
                    c-8.044-8.043-19.136-11.909-30.434-10.607c-17.281,1.986-34.037-4.954-44.844-18.573C169.449,5.11,158.872,0,147.499,0
                    c-11.374,0-21.951,5.11-29.021,14.02c-10.807,13.618-27.564,20.56-44.841,18.575c-11.3-1.305-22.393,2.563-30.435,10.605
                    c-8.043,8.04-11.909,19.133-10.609,30.435c1.989,17.272-4.954,34.035-18.576,44.844C5.11,125.549,0,136.126,0,147.498
                    s5.109,21.949,14.019,29.021c13.62,10.808,20.563,27.57,18.574,44.845c-1.3,11.3,2.566,22.393,10.607,30.432
                    c8.044,8.043,19.145,11.911,30.434,10.607c17.274-1.988,34.037,4.954,44.844,18.573c7.069,8.91,17.646,14.021,29.021,14.021
                    c11.373,0,21.95-5.11,29.02-14.02c10.808-13.618,27.565-20.559,44.841-18.575c11.301,1.299,22.393-2.563,30.435-10.605
                    c8.043-8.04,11.909-19.133,10.609-30.434c-1.989-17.273,4.955-34.037,18.576-44.845c8.907-7.07,14.017-17.647,14.017-29.02
                    S289.886,125.549,280.977,118.478z"/>
                </svg>
                <span className="relative z-10 text-white font-bold text-center text-[11px]">New</span>
              </div>
            </div>

            {/* Version */}
            <p className="font-mono text-4xl font-bold text-white mb-1 leading-none">
              {version ? `v${version}` : <span className="opacity-40 text-2xl">Loading…</span>}
            </p>

            {/* Title */}
            <p className="text-white/75 text-sm font-medium mb-6">{title}</p>

            {/* Feature list */}
            <ul className="space-y-2 flex-1 overflow-y-auto">
              {features.length > 0 ? (
                features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/90 text-sm">
                    <Check size={13} className="flex-shrink-0 mt-0.5 text-white" />
                    {f}
                  </li>
                ))
              ) : (
                <li className="text-white/40 text-sm italic">
                  {entry === null ? 'Loading…' : 'No features listed'}
                </li>
              )}
            </ul>
          </div>

          {/* Right column — white */}
          <div className="flex-1 p-6 flex flex-col min-h-[200px] md:min-h-0">
            <div className="flex justify-end mb-3">
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Screenshot section hidden for now */}

            <button
              onClick={handleClose}
              className="mt-5 w-full py-3 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
