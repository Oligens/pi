pub mod container;
pub mod crypto;
pub mod kdf;
pub mod memory;

#[cfg(test)]
mod container_tests;

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const DEFAULT_QUOTA_BYTES: u64 = 1024 * 1024 * 1024;

fn default_quota_bytes() -> u64 { DEFAULT_QUOTA_BYTES }

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
    #[error("virtual vault quota exceeded")]
    QuotaExceeded,
    #[error("invalid quota")]
    InvalidQuota,
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
    #[serde(default = "default_quota_bytes")]
    pub quota_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub failures: u32,
    pub retry_after_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultQuota {
    pub quota_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f64,
}
