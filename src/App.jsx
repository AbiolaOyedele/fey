import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import { createDefaultClients } from './data/defaultClients';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientWorkspace from './pages/ClientWorkspace';
import Payments from './pages/Payments';

export default function App() {
  const [data, setData] = useLocalStorage('workboard_data', {
    clients: createDefaultClients(),
  });

  const updateClients = (fn) => {
    setData((prev) => ({
      ...prev,
      clients: typeof fn === 'function' ? fn(prev.clients) : fn,
    }));
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-appbg">
        <Sidebar />
        <main className="flex-1 ml-[72px] page-enter">
          <Routes>
            <Route path="/" element={<Dashboard clients={data.clients} />} />
            <Route
              path="/clients"
              element={<Clients clients={data.clients} updateClients={updateClients} />}
            />
            <Route
              path="/clients/:id"
              element={<ClientWorkspace clients={data.clients} updateClients={updateClients} />}
            />
            <Route path="/payments" element={<Payments clients={data.clients} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
