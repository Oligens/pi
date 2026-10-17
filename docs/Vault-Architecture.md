# Pi.Décodeur — Hidden Private Vault

## Security boundary

The vault is a local desktop security boundary. React is only the presentation layer; cryptographic operations and filesystem persistence live in Rust/Tauri.

## Container

- Argon2id derives a 256-bit key from the password and a random 256-bit salt.
- AES-256-GCM authenticates every manifest, filename and file payload.
- Filenames are encrypted; the on-disk record identifier is random and contains no user filename.
- The manifest is encrypted and authenticated.
- Writes use a temporary file, `sync_all`, atomic rename and parent-directory sync where supported.
- File records have a versioned envelope and bounded length to reject malformed/corrupted input.

## Import/export

Import is performed through the Rust command boundary. The encrypted record is written before the encrypted manifest is committed. Export decrypts into memory and returns bytes to the desktop UI; callers must not write plaintext to the default Downloads folder automatically.

## Locking

The master key is held in a `Zeroizing` container and is removed on explicit lock. Authentication failures use exponential retry delay. The desktop lifecycle layer should call `vault_lock` on suspend, sleep, logout/session change, application close and configured inactivity timeout.

## Forensic limitations

This design minimizes application-level plaintext persistence but cannot guarantee forensic invisibility. Operating-system paging, hibernation, crash dumps, filesystem journals, SSD wear-leveling/TRIM, snapshots and backups are outside the application's cryptographic control. For high-assurance scenarios, use full-disk/OS encrypted storage and avoid opening plaintext in applications that create their own caches.

## Never store

Passwords, derived keys, plaintext manifests, plaintext filenames or decrypted files must never be placed in Git, browser localStorage, IndexedDB, remote APIs, analytics, logs or environment variables.
