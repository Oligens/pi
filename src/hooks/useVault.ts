import { useCallback, useEffect, useState } from 'react';
import { vault, type VaultStatus } from '../services/vault';

export function useVault() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await vault.status()); } catch (e) { setError(String(e)); }
  }, []);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await operation(); await refresh(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }, [refresh]);

  const initialize = useCallback((password: string) => run(() => vault.initialize(password)), [run]);
  const unlock = useCallback((password: string) => run(() => vault.unlock(password)), [run]);
  const lock = useCallback(() => run(() => vault.lock()), [run]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('pi:vault-trigger'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { status, busy, error, refresh, initialize, unlock, lock };
}
