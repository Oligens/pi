# Pi.Décodeur — Private Vault Security Model

## Security goals

- Local-only vault: no password, key, plaintext file or vault metadata is sent to a remote service by the vault core.
- Password-based key derivation uses Argon2id with a random 256-bit salt.
- Vault data uses AES-256-GCM with a fresh 96-bit nonce per encryption operation and authenticated additional data.
- Secret key material is held in Rust and wrapped with `zeroize` where practical.
- Authentication failures use progressive local backoff.
- The React layer communicates with the Rust security core through Tauri IPC.
- The UI exposes an intentionally discreet Ctrl+Shift+J trigger; this is a convenience mechanism, not a security boundary.

## Current architecture

```text
React / TypeScript
  ├─ VaultUnlock
  ├─ useVault
  └─ services/vault.ts
          │ Tauri IPC
          ▼
Rust / Tauri
  ├─ vault/kdf.rs       Argon2id
  ├─ vault/crypto.rs    AES-256-GCM
  ├─ vault/memory.rs    zeroizing buffers
  └─ lib.rs             locked runtime + commands
```

## Important forensic limitation

The application must **not** claim that it leaves zero forensic traces. A normal application cannot guarantee recovery resistance against every storage and operating-system mechanism. SSD wear-leveling, filesystem journals, snapshots, backups, hibernation/pagefile, crash dumps and RAM acquisition are outside the cryptographic primitive itself.

For high-risk scenarios, the recommended mode is a full-disk encrypted OS plus an encrypted volume/container managed by a mature, independently reviewed storage system. The Pi vault is an application-layer encrypted store, not a replacement for operating-system disk encryption.

## Rules

- Never store passwords or derived keys in localStorage, IndexedDB, URLs, logs, analytics, crash reports or Git.
- Never export decrypted files automatically to Downloads or temporary browser storage.
- Do not implement fake filesystem errors or deceptive OS-level behavior as a substitute for an explicit public/private storage quota.
- Do not call the vault cryptographic implementation from `passwordCracker.ts`; password auditing and vault authentication are separate trust domains.
- Every new persistence format must be versioned and authenticated before release.

## Pre-release security checklist

- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- `npm ci`
- `npm run typecheck`
- `npm run build`
- dependency and secret scanning
- corruption/tampering tests
- lock/unlock lifecycle tests
- review of crash, suspend/resume and OS session behavior
