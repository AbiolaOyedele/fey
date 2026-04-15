import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';

export default function WhatsNewPopup({ open, onClose }) {
  const { settings } = useSettings();
  const [entry, setEntry] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open || !settings.whats_new_version) return;
    setEntry(null);
    setCarouselIndex(0);
    supabase
      .from('whats_new')
      .select('*')
      .eq('version', settings.whats_new_version)
      .single()
      .then(({ data }) => {
        if (data) {
          setEntry({
            ...data,
            features: Array.isArray(data.features) ? data.features : JSON.parse(data.features || '[]'),
            images: Array.isArray(data.images) ? data.images : JSON.parse(data.images || '[]'),
          });
        }
      });
  }, [open, settings.whats_new_version]);

  const handleClose = () => {
    setClosing(true);
    localStorage.setItem('whats_new_dismissed_version', settings.whats_new_version || '');
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  if (!open) return null;

  const images = entry?.images || [];
  const features = entry?.features || [];
  const version = entry?.version || settings.whats_new_version || '';
  const title = entry?.title || 'New in WorkBoard';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] animate-fadeIn">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden ${
          closing ? 'animate-scale-out' : 'animate-scale-in'
        }`}
      >
        <div className="flex min-h-[340px]">
          {/* Left column — accent background */}
          <div
            className="w-[44%] p-6 flex flex-col"
            style={{ backgroundColor: 'var(--accent, #667EEA)' }}
          >
            {/* Rotating "What's New" badge */}
            <div className="mb-5">
              <span
                className="inline-block text-[10px] font-bold text-white px-2.5 py-1 rounded-full bg-white/25 animate-slow-rotate"
                style={{ transformOrigin: 'center' }}
              >
                What's New
              </span>
            </div>

            {/* Version number */}
            <p className="font-mono text-4xl font-bold text-white mb-1 leading-none">
              v{version}
            </p>

            {/* Release title */}
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
                <li className="text-white/40 text-sm italic">Loading…</li>
              )}
            </ul>
          </div>

          {/* Right column — white */}
          <div className="flex-1 p-6 flex flex-col">
            {/* X close in top-right */}
            <div className="flex justify-end mb-3">
              <button
                onClick={handleClose}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Image carousel or placeholder */}
            <div className="flex-1 flex flex-col">
              {images.length > 0 ? (
                <div className="relative flex-1 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center min-h-[180px]">
                  <img
                    src={images[carouselIndex]}
                    alt={`Screenshot ${carouselIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                        disabled={carouselIndex === 0}
                        className="absolute left-2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setCarouselIndex((i) => Math.min(images.length - 1, i + 1))}
                        disabled={carouselIndex === images.length - 1}
                        className="absolute right-2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 rounded-xl bg-gray-50 flex flex-col items-center justify-center min-h-[180px] text-gray-300">
                  <Sparkles size={34} />
                  <p className="text-sm mt-2 text-gray-400">No screenshots yet</p>
                </div>
              )}

              {/* Dot indicators */}
              {images.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIndex(i)}
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{
                        backgroundColor: i === carouselIndex ? 'var(--accent, #667EEA)' : '#D1D5DB',
                        width: i === carouselIndex ? '6px' : '5px',
                        height: i === carouselIndex ? '6px' : '5px',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Primary close button */}
            <button
              onClick={handleClose}
              className="mt-5 w-full py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #667EEA)' }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
