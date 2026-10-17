use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use super::{crypto, VaultError};

const MAGIC: &[u8] = b"PIVLT01\0";
const VERSION: u8 = 1;
const MAX_NAME_BYTES: usize = 4096;
const MAX_RECORD_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub id: String,
    pub encrypted_name: Vec<u8>,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub entries: Vec<ManifestEntry>,
}

impl Default for Manifest {
    fn default() -> Self { Self { version: 1, entries: Vec::new() } }
}

pub fn data_dir(root: &Path) -> PathBuf { root.join("data") }
pub fn manifest_path(root: &Path) -> PathBuf { root.join("manifest.bin") }

pub fn load_manifest(root: &Path, key: &[u8; 32]) -> Result<Manifest, VaultError> {
    let path = manifest_path(root);
    if !path.exists() { return Ok(Manifest::default()); }
    let envelope = fs::read(path)?;
    let plain = crypto::decrypt(key, &envelope, b"pi-vault-manifest-v1")?;
    serde_json::from_slice(&plain).map_err(|_| VaultError::InvalidFormat)
}

pub fn save_manifest_atomic(root: &Path, key: &[u8; 32], manifest: &Manifest) -> Result<(), VaultError> {
    let bytes = serde_json::to_vec(manifest).map_err(|_| VaultError::InvalidFormat)?;
    let envelope = crypto::encrypt(key, &bytes, b"pi-vault-manifest-v1")?;
    atomic_write(&manifest_path(root), &envelope)
}

pub fn encrypt_and_store(root: &Path, key: &[u8; 32], id: &str, name: &str, data: &[u8]) -> Result<ManifestEntry, VaultError> {
    validate_id(id)?;
    validate_name(name)?;
    if data.len() as u64 > MAX_RECORD_BYTES { return Err(VaultError::InvalidFormat); }
    fs::create_dir_all(data_dir(root))?;
    let aad = format!("pi-vault-file-v1:{id}:{name}");
    let envelope = crypto::encrypt(key, data, aad.as_bytes())?;
    let path = data_dir(root).join(format!("{id}.bin"));
    atomic_write(&path, &envelope)?;
    Ok(ManifestEntry { id: id.to_string(), encrypted_name: crypto::encrypt(key, name.as_bytes(), b"pi-vault-name-v1")?, size: data.len() as u64 })
}

pub fn read_and_decrypt(root: &Path, key: &[u8; 32], entry: &ManifestEntry, name: &str) -> Result<Zeroizing<Vec<u8>>, VaultError> {
    validate_id(&entry.id)?;
    validate_name(name)?;
    let path = data_dir(root).join(format!("{}.bin", entry.id));
    let envelope = fs::read(path)?;
    let aad = format!("pi-vault-file-v1:{}:{}", entry.id, name);
    crypto::decrypt(key, &envelope, aad.as_bytes())
}

pub fn decrypt_name(key: &[u8; 32], encrypted_name: &[u8]) -> Result<String, VaultError> {
    let plain = crypto::decrypt(key, encrypted_name, b"pi-vault-name-v1")?;
    String::from_utf8(plain.to_vec()).map_err(|_| VaultError::InvalidFormat)
}

fn validate_id(id: &str) -> Result<(), VaultError> {
    if id.is_empty() || id.len() > 128 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') { return Err(VaultError::InvalidFormat); }
    Ok(())
}

fn validate_name(name: &str) -> Result<(), VaultError> {
    let bytes = name.as_bytes();
    if bytes.is_empty() || bytes.len() > MAX_NAME_BYTES || name.contains(['/', '\\']) || name == "." || name == ".." { return Err(VaultError::InvalidFormat); }
    Ok(())
}

fn atomic_write(path: &Path, data: &[u8]) -> Result<(), VaultError> {
    let tmp = path.with_extension("tmp");
    let mut file = OpenOptions::new().create(true).truncate(true).write(true).open(&tmp)?;
    file.write_all(MAGIC)?;
    file.write_all(&[VERSION])?;
    file.write_all(&(data.len() as u64).to_le_bytes())?;
    file.write_all(data)?;
    file.sync_all()?;
    drop(file);
    fs::rename(&tmp, path)?;
    sync_parent(path)
}

pub fn read_envelope(path: &Path) -> Result<Vec<u8>, VaultError> {
    let mut file = File::open(path)?;
    let mut magic = [0u8; 8]; file.read_exact(&mut magic)?;
    if magic != MAGIC { return Err(VaultError::InvalidFormat); }
    let mut version = [0u8; 1]; file.read_exact(&mut version)?;
    if version[0] != VERSION { return Err(VaultError::InvalidFormat); }
    let mut len = [0u8; 8]; file.read_exact(&mut len)?;
    let len = u64::from_le_bytes(len);
    if len > MAX_RECORD_BYTES + 64 { return Err(VaultError::InvalidFormat); }
    let mut data = vec![0u8; len as usize]; file.read_exact(&mut data)?;
    Ok(data)
}

fn sync_parent(path: &Path) -> io::Result<()> {
    if let Some(parent) = path.parent() { File::open(parent)?.sync_all()?; }
    Ok(())
}
