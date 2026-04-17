import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ChevronDown } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="white"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="white"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="white"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="white"/>
    </svg>
  );
}

export default function Login() {
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle } = useAuth();

  const [showEmail, setShowEmail]  = useState(false);
  const [mode, setMode]            = useState('signin');
  const [email, setEmail]          = useState('');
  const [password, setPassword]    = useState('');
  const [confirm, setConfirm]      = useState('');
  const [error, setError]          = useState('');
  const [info, setInfo]            = useState('');
  const [loading, setLoading]      = useState(false);

  // Wait for auth to resolve before deciding — prevents flash of login page
  if (authLoading) return null;
  // Already logged in — skip login and go straight to the app
  if (user) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) { setError(err.message); setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setLoading(true);
      const { error: err } = await signUp(email, password);
      setLoading(false);
      if (err) { setError(err.message); return; }
      setInfo('Check your email to confirm your account before signing in.');
      return;
    }

    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Logo */}
        <img src="/favicon.svg" alt="WorkBoard" className="w-9 h-9 rounded-xl mb-10" />

        {/* Hero heading */}
        <h1 className="font-display text-[3rem] sm:text-[4rem] leading-[1.05] font-normal text-gray-900 text-center mb-14">
          Your work,<br />organized.
        </h1>

        {/* Google — primary CTA */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-full text-white text-base font-normal transition-opacity hover:opacity-90 disabled:opacity-60 mb-4"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        {/* Email toggle */}
        <button
          onClick={() => { setShowEmail((v) => !v); setError(''); setInfo(''); }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          Sign in with email
          <ChevronDown
            size={15}
            className="transition-transform duration-200"
            style={{ transform: showEmail ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {/* Email / password form — collapsible */}
        {showEmail && (
          <form onSubmit={handleSubmit} className="w-full space-y-2.5 animate-slideUp">
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
            />
            {mode === 'signup' && (
              <input
                type="password"
                required
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
              />
            )}

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            {info  && <p className="text-xs text-green-600 text-center">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-white text-sm font-normal flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <p className="text-center text-xs text-gray-400 pt-1">
              {mode === 'signin' ? (
                <>Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(''); setInfo(''); }} className="underline text-gray-600 hover:text-gray-900">Sign up</button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }} className="underline text-gray-600 hover:text-gray-900">Sign in</button>
                </>
              )}
            </p>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-10 leading-relaxed">
          By using WorkBoard, you agree to our{' '}
          <a href="#" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
