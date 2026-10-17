import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { useVault } from '../../hooks/useVault';

interface Props { open: boolean; onClose: () => void; }

export function VaultUnlock({ open, onClose }: Props) {
  const { status, busy, error, initialize, unlock } = useVault();
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    if (status?.initialized) await unlock(password); else await initialize(password);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Private vault">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 p-2"><LockKeyhole size={20} /></div>
            <div><p className="text-sm font-semibold">Private Vault</p><p className="text-xs text-white/45">Local • zero-knowledge</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label className="mb-2 block text-xs text-white/55">{status?.initialized ? 'Vault password' : 'Create vault password'}</label>
        <input autoFocus type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/30" />
        {error && <p className="mt-3 text-xs text-red-300" role="alert">{error}</p>}
        {status?.retry_after_ms ? <p className="mt-3 text-xs text-amber-300">Nouvel essai dans {Math.ceil(status.retry_after_ms / 1000)} s.</p> : null}
        <button disabled={busy || !password || !!status?.retry_after_ms} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">
          <ShieldCheck size={17} /> {busy ? 'Vérification…' : status?.initialized ? 'Déverrouiller' : 'Créer le coffre'}
        </button>
      </form>
    </div>
  );
}
