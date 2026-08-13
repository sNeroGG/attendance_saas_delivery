import { FormEvent, useEffect, useState } from 'react';
import { ApiUser, api } from '../api/client';
import { AdminShell } from './AdminApp';
import { KioskScreen } from './KioskScreen';

function LoginScreen({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.login(login, password);
      api.setToken(response.access_token);
      onLogin(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <div className="brand login-brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Attendance</strong>
            <span>Control de asistencia</span>
          </div>
        </div>
        <h1>Iniciar sesión</h1>
        <p className="subtle">Acceso al panel administrativo</p>
        <form className="login-form" onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <label className="field">
            <span>Usuario</span>
            <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

export function App() {
  const isBackendAdminPath = window.location.pathname.includes('admindash');
  const [mode] = useState<'admin' | 'kiosk'>(isBackendAdminPath ? 'admin' : 'kiosk');
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    if (mode !== 'admin' || !api.token) return;
    api.request<ApiUser>('/auth/me').then(setUser).catch(() => api.clearToken());
  }, [mode]);

  if (mode === 'kiosk') {
    return (
      <div className="kiosk-shell">
        <KioskScreen />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <AdminShell
      user={user}
      onLogout={() => {
        api.clearToken();
        setUser(null);
      }}
    />
  );
}
