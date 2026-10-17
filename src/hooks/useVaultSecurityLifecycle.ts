import { useEffect } from 'react';
import { vault } from '../services/vault';

/** Defense-in-depth lifecycle lock. Native sleep/session hooks should be added in Rust/Tauri for OS-level coverage. */
export function useVaultSecurityLifecycle(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const lock = () => { void vault.lock(); };
    const onVisibility = () => { if (document.visibilityState !== 'visible') lock(); };
    const onBlur = () => lock();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);
}
