import { useMemo, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useTaskGroupData } from './hooks/useTaskGroupData';
import { useSettings } from './contexts/SettingsContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientWorkspace from './pages/ClientWorkspace';
import Tasks from './pages/Tasks';
import TaskGroupWorkspace from './pages/TaskGroupWorkspace';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import ToastContainer from './components/Toast';
import ChangelogPopup from './components/ChangelogPopup';

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

  const taskGroupData = useTaskGroupData();

  const { settingsLoading, trashClient, trashTask, showToast, settings, saveSetting } = useSettings();

  const [explicitOrder, setExplicitOrder] = useState(null);

  const orderedClients = useMemo(() => {
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
    setExplicitOrder(ids);
    await saveSetting('client_order', JSON.stringify(ids));
  }, [saveSetting]);

  if (loading || settingsLoading || taskGroupData.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-appbg">
        <div className="text-center">
          <img src="/favicon.svg" alt="Logo" className="w-10 h-10 rounded-xl mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading WorkBoard...</p>
        </div>
      </div>
    );
  }

  if (error || taskGroupData.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-appbg">
        <div className="text-center max-w-md">
          <div className="w-10 h-10 bg-danger rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">!</span>
          </div>
          <p className="text-gray-900 font-semibold mb-1">Something went wrong</p>
          <p className="text-gray-500 text-sm">{error || taskGroupData.error}</p>
        </div>
      </div>
    );
  }

  const handleDeleteClient = async (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const trashItem = await trashClient(client);
    refetch();
    if (trashItem) showToast(`"${client.name}" moved to trash`);
  };

  const handleDeleteTask = async (clientId, taskId) => {
    const client = clients.find((c) => c.id === clientId);
    const task = client?.tasks.find((t) => t.id === taskId);
    if (!task || !client) return;
    await trashTask(task, clientId, client.name);
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

  const appMode = settings.app_mode || 'dual';

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-appbg">
        <Sidebar />
        <main className="flex-1 ml-[72px] page-enter">
          <Routes>
            <Route path="/" element={<Dashboard clients={orderedClients} actions={actions} />} />

            {/* Clients routes — hidden when Tasks Only mode */}
            {appMode !== 'tasks' ? (
              <>
                <Route path="/clients" element={<Clients clients={orderedClients} actions={actions} />} />
                <Route path="/clients/:id" element={<ClientWorkspace clients={orderedClients} actions={actions} />} />
              </>
            ) : (
              <Route path="/clients/*" element={<Navigate to="/" replace />} />
            )}

            {/* Task routes — hidden when Clients Only mode */}
            {appMode !== 'clients' ? (
              <>
                <Route path="/tasks" element={<Tasks taskGroupData={taskGroupData} />} />
                <Route path="/tasks/:id" element={<TaskGroupWorkspace taskGroupData={taskGroupData} />} />
              </>
            ) : (
              <Route path="/tasks/*" element={<Navigate to="/" replace />} />
            )}

            <Route path="/payments" element={<Payments clients={orderedClients} />} />
            <Route path="/settings" element={<Settings clients={orderedClients} refetch={refetch} />} />
          </Routes>
        </main>
        <ToastContainer />
        <ChangelogPopup />
      </div>
    </BrowserRouter>
  );
}
