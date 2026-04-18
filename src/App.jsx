import { useMemo, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useTaskGroupData } from './hooks/useTaskGroupData';
import { useSettings } from './contexts/SettingsContext';
import { useDemoDataCtx } from './contexts/DemoContext';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import DemoBanner from './components/DemoBanner';
import Dashboard from './pages/Dashboard';
import TaskDashboard from './pages/TaskDashboard';
import Clients from './pages/Clients';
import ClientWorkspace from './pages/ClientWorkspace';
import Tasks from './pages/Tasks';
import TaskGroupWorkspace from './pages/TaskGroupWorkspace';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import SharedClientPage from './pages/SharedClientPage';
import ToastContainer from './components/Toast';
import WelcomeGuide from './components/WelcomeGuide';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!IS_DEMO && !user) return <Navigate to="/login" replace />;
  return children;
}

// Redirects new users to /onboarding until they complete it
function OnboardingGate({ children }) {
  const { settings, settingsLoading } = useSettings();
  // Wait for settings to load from Supabase before deciding — avoids false redirect
  if (!IS_DEMO && settingsLoading) return null;
  if (!IS_DEMO && settings.onboarding_complete !== 'true') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // Always call both hooks — each guards itself with IS_DEMO internally
  // Pass user?.id so queries are scoped to the authenticated user
  const supabaseData      = useSupabaseData(user?.id);
  const supabaseTaskGroup = useTaskGroupData(user?.id);

  // In demo mode this reads from DemoDataContext (provided by DemoProvider).
  // In normal mode DemoDataContext is null (DemoProvider is not rendered).
  const demoCtxData = useDemoDataCtx();

  // Pick the active data source
  const activeData      = (IS_DEMO && demoCtxData) ? demoCtxData      : supabaseData;
  const taskGroupData   = (IS_DEMO && demoCtxData) ? demoCtxData.taskGroupData : supabaseTaskGroup;

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
  } = activeData;

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

  // Only wait for data when auth has resolved and a user is actually logged in.
  // If auth is still resolving OR if there's no user yet, skip data loading so
  // the router can render and ProtectedRoute can redirect to /login.
  const dataLoading = !IS_DEMO && !!user && (loading || settingsLoading || taskGroupData.loading);

  if (authLoading || dataLoading) {
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
      <Routes>
        {/* Fully public routes — no auth required */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        <Route path="/share/:token" element={<SharedClientPage />} />

        {/* Onboarding — protected but no sidebar/shell */}
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />

        {/* Protected routes — gated behind onboarding */}
        <Route path="/*" element={
          <ProtectedRoute>
            <OnboardingGate>
            <div className="flex flex-col min-h-screen bg-appbg overflow-x-hidden">
              {IS_DEMO && <DemoBanner />}
              <div className="flex flex-1 overflow-x-hidden">
                <Sidebar />
                <main className="flex-1 min-w-0 ml-0 lg:ml-[72px] pb-16 lg:pb-0 page-enter">
                  <Routes>
                    <Route path="/" element={
                      appMode === 'tasks'
                        ? <TaskDashboard
                            groups={taskGroupData.groups || []}
                            standaloneTasks={taskGroupData.standaloneTasks || []}
                            onToggleGroupTask={taskGroupData.updateGroupTask}
                            onToggleStandaloneTask={taskGroupData.updateStandaloneTask}
                          />
                        : <Dashboard clients={orderedClients} actions={actions} />
                    } />

                    {appMode !== 'tasks' ? (
                      <>
                        <Route path="/clients" element={<Clients clients={orderedClients} actions={actions} />} />
                        <Route path="/clients/:id" element={<ClientWorkspace clients={orderedClients} actions={actions} />} />
                      </>
                    ) : (
                      <Route path="/clients/*" element={<Navigate to="/" replace />} />
                    )}

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
              </div>
            </div>
            <ToastContainer />
            <WelcomeGuide />
            </OnboardingGate>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
