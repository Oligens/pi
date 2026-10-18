import { useCallback, useEffect, useMemo, useState } from 'react';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { vault, type VaultItem, type VaultQuota, type VaultStatus } from '../../services/vault';

const SHORTCUT = 'CommandOrControl+Shift+J';
const BYTES_PER_GB = 1024 * 1024 * 1024;

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} Ko`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} Mo`;
  return `${(value / 1024 ** 3).toFixed(2)} Go`;
}

function isTauriRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export default function VaultPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [quota, setQuota] = useState<VaultQuota | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [quotaGb, setQuotaGb] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const nextStatus = await vault.status();
      setStatus(nextStatus);
      if (nextStatus.unlocked) {
        const [nextQuota, nextItems] = await Promise.all([vault.quota(), vault.list()]);
        setQuota(nextQuota);
        setItems(nextItems);
        setQuotaGb((nextQuota.quota_bytes / BYTES_PER_GB).toFixed(2).replace(/\.00$/, ''));
      } else {
        setQuota(null);
        setItems([]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
    setError('');
    setMessage('');
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const onToggle = () => toggle();
    window.addEventListener('pi-vault-toggle', onToggle);

    let registered = false;
    const setupShortcut = async () => {
      if (!isTauriRuntime()) return;
      try {
        await register(SHORTCUT, (event) => {
          if (event.state === 'Pressed') toggle();
        });
        registered = true;
      } catch (err) {
        setError(`Raccourci global indisponible : ${String(err)}`);
      }
    };
    void setupShortcut();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTauriRuntime() && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pi-vault-toggle', onToggle);
      window.removeEventListener('keydown', onKeyDown);
      if (registered) void unregister(SHORTCUT).catch(() => undefined);
    };
  }, [refresh, toggle]);

  const run = useCallback(async (operation: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      if (success) setMessage(success);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const submitCredentials = async () => {
    if (!password) return setError('Mot de passe requis.');
    if (!status?.initialized && password !== confirmation) return setError('Les mots de passe ne correspondent pas.');
    await run(
      () => status?.initialized ? vault.unlock(password) : vault.initialize(password),
      status?.initialized ? 'Coffre déverrouillé.' : 'Coffre initialisé et déverrouillé.'
    );
    setPassword('');
    setConfirmation('');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    await run(() => vault.importBytes(file.name, bytes).then(() => undefined), `« ${file.name} » chiffré et ajouté.`);
  };

  const handleExport = async (item: VaultItem) => {
    await run(async () => {
      const bytes = await vault.exportBytes(item.id);
      const blob = new Blob([new Uint8Array(bytes)]);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.name;
      anchor.click();
      URL.revokeObjectURL(url);
    }, `« ${item.name} » exporté.`);
  };

  const handleQuota = async () => {
    const gb = Number(quotaGb);
    if (!Number.isFinite(gb) || gb < 0.001) return setError('Quota invalide. Minimum : 0,001 Go.');
    await run(() => vault.setQuota(Math.round(gb * BYTES_PER_GB)).then(() => undefined), 'Quota virtuel mis à jour.');
  };

  const usageWidth = useMemo(() => `${Math.min(100, Math.max(0, quota?.usage_percent ?? 0))}%`, [quota]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <section className="w-full max-w-5xl overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/95 text-white shadow-2xl shadow-cyan-950/40">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PI • HIDDEN PRIVATE VAULT</p>
            <h2 className="mt-1 text-2xl font-semibold">Coffre privé chiffré</h2>
            <p className="text-xs text-slate-400">AES-256-GCM · Argon2id · noms de fichiers chiffrés · Ctrl+Shift+J</p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">Fermer</button>
        </header>

        <div className="max-h-[78vh] overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {message && <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}

          {!status?.initialized || !status.unlocked ? (
            <div className="mx-auto max-w-md rounded-2xl border border-cyan-400/20 bg-white/[0.04] p-6">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">🔐</div>
                <h3 className="text-lg font-semibold">{status?.initialized ? 'Déverrouiller le coffre' : 'Créer le coffre privé'}</h3>
                <p className="mt-1 text-xs text-slate-400">La clé dérivée du mot de passe reste côté Rust et est effacée au verrouillage.</p>
              </div>
              <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe maître" className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400/50" onKeyDown={(e) => e.key === 'Enter' && void submitCredentials()} />
              {!status?.initialized && <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirmer le mot de passe" className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400/50" onKeyDown={(e) => e.key === 'Enter' && void submitCredentials()} />}
              <button disabled={busy} onClick={() => void submitCredentials()} className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">{busy ? 'Traitement…' : status?.initialized ? 'Déverrouiller' : 'Créer et ouvrir'}</button>
              <p className="mt-4 text-center text-[11px] text-slate-500">Le quota virtuel initial est de 1 Go. Il ne modifie pas la capacité réelle du disque.</p>
            </div>
          ) : (
            <>
              <div className="mb-5 grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-300">Stockage virtuel</span><span className="text-cyan-300">{formatBytes(quota?.used_bytes ?? 0)} / {formatBytes(quota?.quota_bytes ?? 0)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: usageWidth }} /></div>
                  <div className="mt-2 text-xs text-slate-500">{(quota?.usage_percent ?? 0).toFixed(1)} % utilisé · {formatBytes(quota?.free_bytes ?? 0)} disponibles</div>
                </div>
                <button disabled={busy} onClick={() => void run(() => vault.lock(), 'Coffre verrouillé.')} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50">🔒 Verrouiller</button>
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]">
                <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="block text-sm font-medium">Quota virtuel</span>
                  <span className="mt-1 block text-xs text-slate-500">Abstraction interne au coffre, sans falsifier l'espace disque du système.</span>
                  <div className="mt-3 flex gap-2"><input type="number" min="0.001" step="0.1" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" /><span className="flex items-center rounded-xl bg-white/5 px-3 text-sm text-slate-400">Go</span></div>
                </label>
                <button disabled={busy} onClick={() => void handleQuota()} className="self-end rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50">Appliquer le quota</button>
              </div>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div><h3 className="font-semibold">Fichiers protégés</h3><p className="text-xs text-slate-500">{items.length} élément(s) · manifest et noms chiffrés</p></div>
                <label className="cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">＋ Importer un fichier<input type="file" className="hidden" disabled={busy} onChange={(e) => void handleImport(e)} /></label>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10">
                {items.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Le coffre est vide. Les fichiers importés sont chiffrés avant stockage.</div> : items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-b-0 hover:bg-white/[0.03]">
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{item.name}</div><div className="text-xs text-slate-500">{formatBytes(item.size)} · {item.id.slice(0, 12)}…</div></div>
                    <div className="flex shrink-0 gap-2"><button disabled={busy} onClick={() => void handleExport(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10">Exporter</button><button disabled={busy} onClick={() => void run(() => vault.delete(item.id), 'Fichier supprimé du coffre.')} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">Supprimer</button></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
