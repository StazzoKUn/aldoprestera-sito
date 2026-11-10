import { useState } from 'preact/hooks';

export default function GestioneLogin({ logo }: { logo: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/gestione/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        location.assign('/gestione');
        return;
      }
      setError(data?.error ?? 'Accesso non riuscito.');
    } catch {
      setError('Non riusciamo a collegarci. Riprova.');
    }
    setBusy(false);
  };

  return (
    <main class="g-login">
      <img src={logo} alt="Aldo Prestera Pizzeria" width={220} class="g-login__logo" />
      <h1>Gestione ordini</h1>
      <form onSubmit={submit} class="g-login__form" noValidate>
        <label class="g-label" for="g-user">
          Utente
        </label>
        <input id="g-user" class="g-input" type="text" autocomplete="username" autocapitalize="none" required value={username} onInput={(e) => setUsername((e.currentTarget as HTMLInputElement).value)} />
        <label class="g-label" for="g-pass">
          Password
        </label>
        <input id="g-pass" class="g-input" type="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
        {error && (
          <p class="g-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="g-btn g-btn--primary" disabled={busy || !username || !password}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </main>
  );
}
