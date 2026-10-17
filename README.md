# Pi.Décodeur

Décodeur universel de fichiers encodés, avec une architecture desktop sécurisée pour un **Private Vault local**.

## Private Vault

La branche `feature/hidden-private-vault` introduit une séparation claire entre l'interface React et un cœur de sécurité Rust/Tauri :

- **Argon2id** + sel aléatoire 256 bits pour la dérivation de clé.
- **AES-256-GCM** pour le chiffrement authentifié.
- Clés et buffers sensibles gérés côté Rust avec `zeroize`.
- Backoff progressif après échecs d'authentification.
- Déclencheur discret `Ctrl+Shift+J` côté interface.
- Verrouillage défensif lors de la perte de visibilité/focus.
- Aucun secret du coffre ne doit être placé dans Git, les variables Vite, localStorage ou IndexedDB.

## Structure

```text
src/
├── components/vault/VaultUnlock.tsx
├── hooks/useVault.ts
├── hooks/useVaultSecurityLifecycle.ts
└── services/vault.ts

src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/default.json
├── build.rs
└── src/
    ├── main.rs
    ├── lib.rs
    └── vault/
        ├── mod.rs
        ├── kdf.rs
        ├── crypto.rs
        └── memory.rs

docs/SECURITY.md
```

## Développement desktop

Pré-requis : Node.js, Rust stable et les prérequis Tauri de la plateforme.

Après installation des dépendances JavaScript :

```bash
npm run desktop:dev
```

Build desktop :

```bash
npm run desktop:build
```

Tests Rust :

```bash
cd src-tauri
cargo fmt --check
cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

## Limites de sécurité

Le coffre est **application-layer encrypted**. Il ne peut pas garantir l'absence absolue de traces forensiques sur un SSD/OS : pagefile, hibernation, journaux, snapshots, sauvegardes, crash dumps et wear-leveling peuvent conserver des données indépendamment du code du coffre.

Pour un niveau de menace élevé, utiliser en complément le chiffrement complet du disque et/ou un conteneur de volume chiffré mature et audité.

Voir [`docs/SECURITY.md`](docs/SECURITY.md) pour le modèle de sécurité et la checklist de pré-production.
