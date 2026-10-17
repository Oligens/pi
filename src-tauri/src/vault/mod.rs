pub mod container;
pub mod crypto;
pub mod kdf;
pub mod memory;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault is locked")]
    Locked,
    #[error("invalid password or corrupted vault")]
    AuthenticationFailed,
    #[error("invalid vault format")]
    InvalidFormat,
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("cryptographic error")]
    Crypto,
    #[error("KDF error")]
    Kdf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub version: u32,
    pub algorithm: String,
    pub kdf: String,
    pub salt_b64: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub failures: u32,
    pub retry_after_ms: u64,
}
