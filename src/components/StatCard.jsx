import { Link } from 'react-router-dom';

export default function StatCard({ label, value, icon: Icon, color = 'text-primary', to }) {
  const Wrapper = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 block cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {Icon && <Icon size={18} className={color} />}
      </div>
      <p className={`text-2xl font-mono font-semibold ${color}`}>{value}</p>
    </Wrapper>
  );
}
