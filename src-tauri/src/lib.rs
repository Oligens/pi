mod vault;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{fs, path::PathBuf, sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use vault::{container, crypto, kdf, VaultConfig, VaultError, VaultStatus};
use zeroize::Zeroizing;

const MAGIC: &[u8] = b"PI-VAULT-V1";
const HEADER_FILE: &str = "vault.header";
const VERIFIER_FILE: &str = "vault.verifier";

struct VaultRuntime { key: Mutex<Option<Zeroizing<[u8; 32]>>>, failures: Mutex<u32>, retry_until: Mutex<Option<Instant>> }
impl Default for VaultRuntime { fn default() -> Self { Self { key: Mutex::new(None), failures: Mutex::new(0), retry_until: Mutex::new(None) } } }

fn vault_root(app: &AppHandle) -> Result<PathBuf, VaultError> {
    let base = app.path().app_data_dir().map_err(|_| VaultError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "app data dir unavailable")))?;
    Ok(base.join("pi-vault"))
}
fn load_config(root: &PathBuf) -> Result<VaultConfig, VaultError> {
    serde_json::from_slice(&fs::read(root.join(HEADER_FILE))?).map_err(|_| VaultError::InvalidFormat)
}
fn current_key(state: &State<'_, VaultRuntime>) -> Result<Zeroizing<[u8; 32]>, String> {
    let key = state.key.lock().map_err(|_| "state poisoned".to_string())?;
    key.as_ref().cloned().ok_or_else(|| VaultError::Locked.to_string())
}

#[tauri::command]
fn vault_status(app: AppHandle, state: State<'_, VaultRuntime>) -> Result<VaultStatus, String> {
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    let initialized = root.join(HEADER_FILE).is_file() && root.join(VERIFIER_FILE).is_file();
    let unlocked = state.key.lock().map_err(|_| "state poisoned".to_string())?.is_some();
    let failures = *state.failures.lock().map_err(|_| "state poisoned".to_string())?;
    let retry_after_ms = state.retry_until.lock().map_err(|_| "state poisoned".to_string())?.and_then(|t| t.checked_duration_since(Instant::now())).unwrap_or(Duration::ZERO).as_millis() as u64;
    Ok(VaultStatus { initialized, unlocked, failures, retry_after_ms })
}

#[tauri::command]
fn vault_initialize(app: AppHandle, password: String, state: State<'_, VaultRuntime>) -> Result<(), String> {
    if password.is_empty() { return Err("password must not be empty".into()); }
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(container::data_dir(&root)).map_err(|e| e.to_string())?;
    if root.join(HEADER_FILE).exists() { return Err("vault already initialized".into()); }
    let salt = kdf::random_salt();
    let key = kdf::derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
    let verifier = crypto::encrypt(&key, MAGIC, b"pi-vault-verifier-v1").map_err(|e| e.to_string())?;
    let config = VaultConfig { version: 1, algorithm: "AES-256-GCM".into(), kdf: "Argon2id".into(), salt_b64: STANDARD.encode(salt), memory_kib: kdf::MEMORY_KIB, iterations: kdf::ITERATIONS, parallelism: kdf::PARALLELISM };
    fs::write(root.join(HEADER_FILE), serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::write(root.join(VERIFIER_FILE), verifier).map_err(|e| e.to_string())?;
    *state.key.lock().map_err(|_| "state poisoned".to_string())? = Some(Zeroizing::new(key));
    Ok(())
}

#[tauri::command]
fn vault_unlock(app: AppHandle, password: String, state: State<'_, VaultRuntime>) -> Result<(), String> {
    if password.is_empty() { return Err("invalid credentials".into()); }
    if let Some(until) = *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? { if until > Instant::now() { return Err("retry later".into()); } }
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    let config = load_config(&root).map_err(|e| e.to_string())?;
    let salt = STANDARD.decode(config.salt_b64).map_err(|_| "invalid vault salt".to_string())?;
    let key = kdf::derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;
    let verifier = fs::read(root.join(VERIFIER_FILE)).map_err(|_| "invalid credentials".to_string())?;
    match crypto::decrypt(&key, &verifier, b"pi-vault-verifier-v1") {
        Ok(plain) if plain.as_slice() == MAGIC => { *state.key.lock().map_err(|_| "state poisoned".to_string())? = Some(Zeroizing::new(key)); *state.failures.lock().map_err(|_| "state poisoned".to_string())? = 0; *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? = None; Ok(()) }
        _ => { let mut failures = state.failures.lock().map_err(|_| "state poisoned".to_string())?; *failures = failures.saturating_add(1); let seconds = 1u64 << (*failures).min(6); *state.retry_until.lock().map_err(|_| "state poisoned".to_string())? = Some(Instant::now() + Duration::from_secs(seconds)); Err("invalid credentials".into()) }
    }
}

#[tauri::command]
fn vault_lock(state: State<'_, VaultRuntime>) -> Result<(), String> { *state.key.lock().map_err(|_| "state poisoned".to_string())? = None; Ok(()) }

#[tauri::command]
fn vault_import_bytes(app: AppHandle, state: State<'_, VaultRuntime>, name: String, data: Vec<u8>) -> Result<String, String> {
    let key = current_key(&state)?;
    let root = vault_root(&app).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().simple().to_string();
    let mut manifest = container::load_manifest(&root, &key).map_err(|e| e.to_string())?;
    let entry = container::encrypt_and_store(&root, &key, &id, &name, &data).map_err(|e| e.to_string())?;
    manifest.entries.push(entry);
    container::save_manifest_atomic(&root, &key, &manifest).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn vault_list(app: AppHandle, state: State<'_, VaultRuntime>) -> Result<Vec<(String, String, u64)>, String> {
    let key = current_key(&state)?; let root = vault_root(&app).map_err(|e| e.to_string())?;
    let manifest = container::load_manifest(&root, &key).map_err(|e| e.to_string())?;
    manifest.entries.into_iter().map(|e| { let name = container::decrypt_name(&key, &e.encrypted_name).map_err(|x| x.to_string())?; Ok((e.id, name, e.size)) }).collect()
}

#[tauri::command]
fn vault_export_bytes(app: AppHandle, state: State<'_, VaultRuntime>, id: String) -> Result<Vec<u8>, String> {
    let key = current_key(&state)?; let root = vault_root(&app).map_err(|e| e.to_string())?;
    let manifest = container::load_manifest(&root, &key).map_err(|e| e.to_string())?;
    let entry = manifest.entries.iter().find(|e| e.id == id).ok_or_else(|| "item not found".to_string())?;
    let name = container::decrypt_name(&key, &entry.encrypted_name).map_err(|e| e.to_string())?;
    container::read_and_decrypt(&root, &key, entry, &name).map(|p| p.to_vec()).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_delete(app: AppHandle, state: State<'_, VaultRuntime>, id: String) -> Result<(), String> {
    let key = current_key(&state)?; let root = vault_root(&app).map_err(|e| e.to_string())?;
    let mut manifest = container::load_manifest(&root, &key).map_err(|e| e.to_string())?;
    let before = manifest.entries.len(); manifest.entries.retain(|e| e.id != id);
    if before == manifest.entries.len() { return Err("item not found".into()); }
    let _ = fs::remove_file(container::data_dir(&root).join(format!("{id}.bin")));
    container::save_manifest_atomic(&root, &key, &manifest).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_encrypt_bytes(state: State<'_, VaultRuntime>, name: String, data: Vec<u8>) -> Result<Vec<u8>, String> { let key = current_key(&state)?; crypto::encrypt(&key, &data, name.as_bytes()).map_err(|e| e.to_string()) }
#[tauri::command]
fn vault_decrypt_bytes(state: State<'_, VaultRuntime>, name: String, envelope: Vec<u8>) -> Result<Vec<u8>, String> { let key = current_key(&state)?; crypto::decrypt(&key, &envelope, name.as_bytes()).map(|p| p.to_vec()).map_err(|e| e.to_string()) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().manage(VaultRuntime::default()).invoke_handler(tauri::generate_handler![vault_status, vault_initialize, vault_unlock, vault_lock, vault_import_bytes, vault_list, vault_export_bytes, vault_delete, vault_encrypt_bytes, vault_decrypt_bytes]).setup(|_app| Ok(())).run(tauri::generate_context!()).expect("error while running Pi.Décodeur");
}
