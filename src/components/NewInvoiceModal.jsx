import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckSquare, Users, Edit3, ChevronRight, Check } from 'lucide-react';

export default function NewInvoiceModal({ clients = [], onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('choose'); // 'choose' | 'tasks' | 'client'
  const [taskFilter, setTaskFilter] = useState('all'); // all | unpaid | paid
  const [selectedTasks, setSelectedTasks] = useState({}); // { taskId: { task, client } }
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientTaskFilter, setClientTaskFilter] = useState('all');

  // Build full task list grouped by client
  const allTaskGroups = clients
    .filter((c) => c.tasks && c.tasks.length > 0)
    .map((c) => ({
      client: c,
      tasks: c.tasks.filter((t) => {
        if (taskFilter === 'unpaid') return !t.paid;
        if (taskFilter === 'paid') return t.paid;
        return true;
      }),
    }))
    .filter((g) => g.tasks.length > 0);

  const toggleTask = (task, client) => {
    setSelectedTasks((prev) => {
      const next = { ...prev };
      if (next[task.id]) { delete next[task.id]; }
      else { next[task.id] = { task, client }; }
      return next;
    });
  };

  const toggleAllForGroup = (group) => {
    const allSelected = group.tasks.every((t) => selectedTasks[t.id]);
    setSelectedTasks((prev) => {
      const next = { ...prev };
      if (allSelected) {
        group.tasks.forEach((t) => delete next[t.id]);
      } else {
        group.tasks.forEach((t) => { next[t.id] = { task: t, client: group.client }; });
      }
      return next;
    });
  };

  const confirmTaskSelection = () => {
    const entries = Object.values(selectedTasks);
    if (!entries.length) return;

    // Determine primary client (most tasks)
    const clientCounts = {};
    entries.forEach(({ client }) => { clientCounts[client.id] = (clientCounts[client.id] || 0) + 1; });
    const primaryClientId = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0][0];
    const primaryClient = clients.find((c) => c.id === primaryClientId);

    const lineItems = entries.map(({ task }) => ({
      id: `task-${task.id}`,
      description: task.title,
      qty: 1,
      price: parseFloat(task.amount) || 0,
      amount: parseFloat(task.amount) || 0,
      task_id: task.id,
    }));

    navigate('/invoices/new', {
      state: {
        prefillClientId: primaryClientId,
        prefillClient: primaryClient,
        prefillLineItems: lineItems,
        prefillTaskIds: entries.map(({ task }) => task.id),
      },
    });
  };

  const confirmClientSelection = () => {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    const tasks = client.tasks.filter((t) => {
      if (clientTaskFilter === 'unpaid') return !t.paid;
      if (clientTaskFilter === 'paid') return t.paid;
      return true;
    });

    const lineItems = tasks.map((t) => ({
      id: `task-${t.id}`,
      description: t.title,
      qty: 1,
      price: t.amount || 0,
      amount: t.amount || 0,
      task_id: t.id,
    }));

    navigate('/invoices/new', {
      state: {
        prefillClientId: client.id,
        prefillClient: client,
        prefillLineItems: lineItems,
        prefillTaskIds: tasks.map((t) => t.id),
      },
    });
  };

  const goManual = () => {
    navigate('/invoices/new', { state: {} });
  };

  const selectedCount = Object.keys(selectedTasks).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          {step !== 'choose' && (
            <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-3">
              <ChevronRight size={14} className="rotate-180" />Back
            </button>
          )}
          <h2 className="font-display text-lg font-bold text-gray-900">
            {step === 'choose' ? 'New Invoice' : step === 'tasks' ? 'Select Tasks' : 'Invoice for Client'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 ml-auto">
            <X size={18} />
          </button>
        </div>

        {/* Choose step */}
        {step === 'choose' && (
          <div className="p-6 space-y-3">
            <button
              onClick={() => setStep('tasks')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 transition-colors">
                <CheckSquare size={18} className="text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Select tasks to invoice</p>
                <p className="text-xs text-gray-400 mt-0.5">Pick specific tasks from any client</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>

            <button
              onClick={() => setStep('client')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                <Users size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Invoice all items for a client</p>
                <p className="text-xs text-gray-400 mt-0.5">Pull all (or filtered) tasks for one client</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>

            <button
              onClick={goManual}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                <Edit3 size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Create manually</p>
                <p className="text-xs text-gray-400 mt-0.5">Start with a blank invoice</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          </div>
        )}

        {/* Select tasks step */}
        {step === 'tasks' && (
          <>
            <div className="px-6 pt-4 pb-3 flex-shrink-0">
              <div className="flex gap-2">
                {['all', 'unpaid', 'paid'].map((f) => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${taskFilter === f ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={taskFilter === f ? { backgroundColor: 'var(--accent)' } : {}}
                  >{f === 'all' ? 'All Tasks' : f === 'unpaid' ? 'Unpaid' : 'Paid'}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {allTaskGroups.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No tasks match this filter.</p>
              ) : (
                <div className="space-y-4">
                  {allTaskGroups.map(({ client, tasks }) => {
                    const allSel = tasks.every((t) => selectedTasks[t.id]);
                    return (
                      <div key={client.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={() => toggleAllForGroup({ client, tasks })} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSel ? 'border-transparent' : 'border-gray-300'}`} style={allSel ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
                              {allSel && <Check size={10} className="text-white" />}
                            </div>
                          </button>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{client.name}</span>
                        </div>
                        <div className="space-y-1 pl-6">
                          {tasks.map((task) => {
                            const sel = !!selectedTasks[task.id];
                            return (
                              <button key={task.id} onClick={() => toggleTask(task, client)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${sel ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${sel ? 'border-transparent' : 'border-gray-300'}`} style={sel ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
                                  {sel && <Check size={10} className="text-white" />}
                                </div>
                                <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                                {task.amount > 0 && (
                                  <span className="text-xs font-medium text-gray-500 flex-shrink-0">{task.currency || 'NGN'} {task.amount.toLocaleString()}</span>
                                )}
                                {task.paid && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full flex-shrink-0">Paid</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={confirmTaskSelection}
                disabled={!selectedCount}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {selectedCount > 0 ? `Create Invoice with ${selectedCount} task${selectedCount !== 1 ? 's' : ''}` : 'Select at least one task'}
              </button>
            </div>
          </>
        )}

        {/* Client step */}
        {step === 'client' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Choose client</p>
                <div className="space-y-2">
                  {clients.map((c) => (
                    <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selectedClientId === c.id ? '' : 'border-gray-100 hover:border-gray-200'}`}
                      style={selectedClientId === c.id ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)' } : {}}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: c.color || 'var(--accent)' }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.tasks?.length || 0} task{c.tasks?.length !== 1 ? 's' : ''}</p>
                      </div>
                      {selectedClientId === c.id && <Check size={16} style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
              </div>

              {selectedClientId && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Which tasks?</p>
                  <div className="flex gap-2">
                    {['all', 'unpaid', 'paid'].map((f) => (
                      <button key={f} onClick={() => setClientTaskFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${clientTaskFilter === f ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                        style={clientTaskFilter === f ? { backgroundColor: 'var(--accent)' } : {}}
                      >{f === 'all' ? 'All tasks' : f}</button>
                    ))}
                  </div>
                  {selectedClientId && (() => {
                    const c = clients.find((x) => x.id === selectedClientId);
                    const count = c?.tasks?.filter((t) => {
                      if (clientTaskFilter === 'unpaid') return !t.paid;
                      if (clientTaskFilter === 'paid') return t.paid;
                      return true;
                    }).length || 0;
                    return <p className="text-xs text-gray-400 mt-2">{count} task{count !== 1 ? 's' : ''} will be added as line items</p>;
                  })()}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={confirmClientSelection}
                disabled={!selectedClientId}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {selectedClientId ? 'Create Invoice' : 'Select a client'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
