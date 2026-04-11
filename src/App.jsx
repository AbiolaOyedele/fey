import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSupabaseData } from './hooks/useSupabaseData';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientWorkspace from './pages/ClientWorkspace';
import Payments from './pages/Payments';

export default function App() {
  const {
    clients,
    loading,
    error,
    addClient,
    deleteClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    deleteTask,
  } = useSupabaseData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-appbg">
        <div className="text-center">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-display font-bold text-sm">W</span>
          </div>
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

  const actions = {
    addClient,
    deleteClient,
    updateRetainer,
    toggleRetainerPaid,
    addTask,
    updateTask,
    deleteTask,
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-appbg">
        <Sidebar />
        <main className="flex-1 ml-[72px] page-enter">
          <Routes>
            <Route path="/" element={<Dashboard clients={clients} />} />
            <Route
              path="/clients"
              element={<Clients clients={clients} actions={actions} />}
            />
            <Route
              path="/clients/:id"
              element={<ClientWorkspace clients={clients} actions={actions} />}
            />
            <Route path="/payments" element={<Payments clients={clients} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
