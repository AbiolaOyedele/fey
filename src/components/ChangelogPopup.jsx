import { useState, useRef, useEffect } from 'react';
import { History, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function ChangelogPopup() {
  const [open, setOpen] = useState(false);
  const popupRef = useRef(null);
  const btnRef = useRef(null);
  const { settings } = useSettings();

  let entries = [];
  try {
    if (settings.changelog) entries = JSON.parse(settings.changelog);
  } catch { /* ignore */ }

  useEffect(() => {
    const handler = (e) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        title="Changelog"
        className="fixed bottom-6 right-6 z-30 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:shadow-lg transition-all duration-150 opacity-40 hover:opacity-100"
      >
        <History size={14} />
      </button>

      {open && (
        <div
          ref={popupRef}
          className="fixed bottom-16 right-6 z-40 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-slideUp"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Changelog</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No entries yet</p>
            ) : (
              <div className="px-4 py-3 space-y-5">
                {entries.map((entry, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: 'var(--accent, #667EEA)' }}
                      >
                        v{entry.version}
                      </span>
                      <span className="text-xs text-gray-400">{entry.date}</span>
                    </div>

                    {entry.features && entry.features.length > 0 && (
                      <div className="mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">New Features</p>
                        <ul className="space-y-0.5">
                          {entry.features.map((f, j) => (
                            <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                              <span className="text-green-500 flex-shrink-0 mt-0.5">+</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.improvements && entry.improvements.length > 0 && (
                      <div className="mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Improvements</p>
                        <ul className="space-y-0.5">
                          {entry.improvements.map((f, j) => (
                            <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                              <span className="text-blue-400 flex-shrink-0 mt-0.5">↑</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {entry.fixes && entry.fixes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Bug Fixes</p>
                        <ul className="space-y-0.5">
                          {entry.fixes.map((f, j) => (
                            <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                              <span className="text-red-400 flex-shrink-0 mt-0.5">✕</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {i < entries.length - 1 && <div className="mt-4 border-b border-gray-100" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
