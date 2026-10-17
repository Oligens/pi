mod vault;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{fs, path::PathBuf, sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, Manager, State};
use vault::{crypto, kdf, VaultConfig, VaultError, VaultStatus};
use zeroize::Zeroizing;

const MAGIC: &[u8] = b"PI-VAULT-V1";
const HEADER_FILE: &str = "vault.header";
const VERIFIER_FILE: &str = "vault.verifier";

struct VaultRuntime {
    root: Mutex<Option<PathBuf>>,
    key: Mutex<Option<Zeroizing<[u8; 32]>>>,
    failures: Mutex<u32>,
    retry_until: Mutex<Option<Instant>>,
}

impl Default for VaultRuntime {
    fn default() -> Self {
        Self { root: Mutex::new(None), key: Mutex::new(None), failures: Mutex::new(0), retry_until: Mutex::new(None) }
    }
}

fn vault_root(app: &AppHandle) -> Result<PathBuf, VaultError> {
    let base = app.path().app_data_dir().map_err(|_| VaultError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "app data dir unavailable")))?;
    Ok(base.join("pi-vault"))
}

fn load_config(root: &PathBuf) -> Result<VaultConfig, VaultError> {
    let bytes = fs::read(root.join(HEADER_FILE))?;
    serde_json::from_slice(&bytes).map_err(|_| VaultError::InvalidFormat)
}

#[tauri::command]
fn vault_status(app: AppHandle, state: State<'_, VaultRuntime>) -> Result<VaultStatus, String> {
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    let initialized = root.join(HEADER_FILE).is_file() && root.join(VERIFIER_FILE).is_file();
    let unlocked = state.key.lock().map_err(|_| "state poisoned".to_string())?.is_some();
    let failures = *state.failures.lock().map_err(|_| "state poisoned".to_string())?;
    let retry_after_ms = state.retry_until.lock().map_err(|_| "state poisoned".to_string())?
        .and_then(|t| t.checked_duration_since(Instant::now()))
        .unwrap_or(Duration::ZERO).as_millis() as u64;
    Ok(VaultStatus { initialized, unlocked, root, failures, retry_after_ms })
}

#[tauri::command]
fn vault_initialize(app: AppHandle, password: String, state: State<'_, VaultRuntime>) -> Result<(), String> {
    if password.is_empty() { return Err("password must not be empty".into()); }
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("data")).map_err(|e| e.to_string())?;
    if root.join(HEADER_FILE).exists() { return Err("vault already initialized".into()); }

    let salt = kdf::random_salt();
    let key = kdf::derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
    let verifier = crypto::encrypt(&key, MAGIC, b"pi-vault-verifier-v1").map_err(|e| e.to_string())?;
    let config = VaultConfig {
        version: 1,
        algorithm: "AES-256-GCM".into(),
        kdf: "Argon2id".into(),
        salt_b64: STANDARD.encode(salt),
        memory_kib: kdf::MEMORY_KIB,
        iterations: kdf::ITERATIONS,
        parallelism: kdf::PARALLELISM,
    };
    fs::write(root.join(HEADER_FILE), serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::write(root.join(VERIFIER_FILE), verifier).map_err(|e| e.to_string())?;
    *state.root.lock().map_err(|_| "state poisoned".to_string())? = Some(root);
    Ok(())
}

#[tauri::command]
fn vault_unlock(app: AppHandle, password: String, state: State<'_, VaultRuntime>) -> Result<(), String> {
    if password.is_empty() { return Err("invalid credentials".into()); }
    let now = Instant::now();
    if let Some(until) = *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? {
        if until > now { return Err("retry later".into()); }
    }
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    let config = load_config(&root).map_err(|e| e.to_string())?;
    let salt = STANDARD.decode(config.salt_b64).map_err(|_| "invalid vault salt".to_string())?;
    let key = kdf::derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
    let verifier = fs::read(root.join(VERIFIER_FILE)).map_err(|_| "invalid credentials".to_string())?;
    match crypto::decrypt(&key, &verifier, b"pi-vault-verifier-v1") {
        Ok(plain) if plain.as_slice() == MAGIC => {
            *state.key.lock().map_err(|_| "state poisoned".to_string())? = Some(Zeroizing::new(key));
            *state.root.lock().map_err(|_| "state poisoned".to_string())? = Some(root);
            *state.failures.lock().map_err(|_| "state poisoned".to_string())? = 0;
            *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? = None;
            Ok(())
        }
        _ => {
            let mut failures = state.failures.lock().map_err(|_| "state poisoned".to_string())?;
            *failures = failures.saturating_add(1);
            let seconds = 1u64 << (*failures).min(6);
            *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? = Some(Instant::now() + Duration::from_secs(seconds));
            Err("invalid credentials".into())
        }
    }
}

#[tauri::command]
fn vault_lock(state: State<'_, VaultRuntime>) -> Result<(), String> {
    *state.key.lock().map_err(|_| "state poisoned".to_string())? = None;
    *state.root.lock().map_err(|_| "state poisoned".to_string())? = None;
    Ok(())
}

#[tauri::command]
fn vault_encrypt_bytes(state: State<'_, VaultRuntime>, name: String, data: Vec<u8>) -> Result<Vec<u8>, String> {
    if name.is_empty() || name.len() > 512 { return Err("invalid item name".into()); }
    let key = state.key.lock().map_err(|_| "state poisoned".to_string())?;
    let key = key.as_ref().ok_or_else(|| VaultError::Locked.to_string())?;
    crypto::encrypt(&**key, &data, name.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_decrypt_bytes(state: State<'_, VaultRuntime>, name: String, envelope: Vec<u8>) -> Result<Vec<u8>, String> {
    let key = state.key.lock().map_err(|_| "state poisoned".to_string())?;
    let key = key.as_ref().ok_or_else(|| VaultError::Locked.to_string())?;
    crypto::decrypt(&**key, &envelope, name.as_bytes()).map(|p| p.to_vec()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(VaultRuntime::default())
        .invoke_handler(tauri::generate_handler![vault_status, vault_initialize, vault_unlock, vault_lock, vault_encrypt_bytes, vault_decrypt_bytes])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running Pi.Décodeur");
}
