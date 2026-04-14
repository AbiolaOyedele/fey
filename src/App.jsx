import { useMemo, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useSettings } from './contexts/SettingsContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientWorkspace from './pages/ClientWorkspace';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import ToastContainer from './components/Toast';

export default function App() {
  const {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    reorderTasks,
    deleteTask,
    refetch,
  } = useSupabaseData();

  const { settingsLoading, trashClient, trashTask, showToast, settings, saveSetting } = useSettings();

  // Explicit order state — updated immediately on drag, no settings roundtrip needed
  const [explicitOrder, setExplicitOrder] = useState(null);

  const orderedClients = useMemo(() => {
    // Prefer the in-memory explicit order (set on drag) over the persisted settings value
    let order = explicitOrder;
    if (!order && settings.client_order) {
      try {
        const parsed = JSON.parse(settings.client_order);
        if (Array.isArray(parsed) && parsed.length > 0) order = parsed;
      } catch { /* ignore */ }
    }
    if (!order) return clients;
    return [...clients].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }, [clients, explicitOrder, settings.client_order]);

  const saveClientOrder = useCallback(async (ids) => {
    setExplicitOrder(ids);                              // immediate — reorders all consumers at once
    await saveSetting('client_order', JSON.stringify(ids)); // persist to Supabase
  }, [saveSetting]);

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-appbg">
        <div className="text-center">
          <img src="/favicon.svg" alt="Logo" className="w-10 h-10 rounded-xl mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading WorkBoard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-appbg">
        <div className="text-center max-w-md">
          <div className="w-10 h-10 bg-danger rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">!</span>
          </div>
          <p className="text-gray-900 font-semibold mb-1">Something went wrong</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Wrap deleteClient to use trash + toast (trashClient already deletes from DB)
  const handleDeleteClient = async (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    // trashClient handles DB deletion + inserting into trash table
    const trashItem = await trashClient(client);
    // Just update local state (don't call deleteClient which would try DB delete again)
    refetch();

    if (trashItem) {
      showToast(`"${client.name}" moved to trash`);
    }
  };

  // Wrap deleteTask to use trash + toast (trashTask already deletes from DB)
  const handleDeleteTask = async (clientId, taskId) => {
    const client = clients.find((c) => c.id === clientId);
    const task = client?.tasks.find((t) => t.id === taskId);
    if (!task || !client) return;

    // trashTask handles DB deletion + inserting into trash table
    await trashTask(task, clientId, client.name);
    // Just update local state
    refetch();

    showToast(`"${task.title}" moved to trash`);
  };

  const actions = {
    addClient,
    updateClient,
    deleteClient: handleDeleteClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    reorderTasks,
    deleteTask: handleDeleteTask,
    refetch,
    saveClientOrder,
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-appbg">
        <Sidebar />
        <main className="flex-1 ml-[72px] page-enter">
          <Routes>
            <Route path="/" element={<Dashboard clients={orderedClients} actions={actions} />} />
            <Route
              path="/clients"
              element={<Clients clients={orderedClients} actions={actions} />}
            />
            <Route
              path="/clients/:id"
              element={<ClientWorkspace clients={orderedClients} actions={actions} />}
            />
            <Route path="/payments" element={<Payments clients={orderedClients} />} />
            <Route path="/settings" element={<Settings clients={orderedClients} refetch={refetch} />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}
