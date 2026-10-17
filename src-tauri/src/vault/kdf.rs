use argon2::{Algorithm, Argon2, Params, Version};
use rand::{rngs::OsRng, RngCore};

use super::VaultError;

pub const SALT_LEN: usize = 32;
pub const KEY_LEN: usize = 32;
pub const MEMORY_KIB: u32 = 64 * 1024;
pub const ITERATIONS: u32 = 3;
pub const PARALLELISM: u32 = 2;

pub fn random_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn derive_key(password: &[u8], salt: &[u8]) -> Result<[u8; KEY_LEN], VaultError> {
    let params = Params::new(MEMORY_KIB, ITERATIONS, PARALLELISM, Some(KEY_LEN))
        .map_err(|_| VaultError::Kdf)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon
        .hash_password_into(password, salt, &mut key)
        .map_err(|_| VaultError::Kdf)?;
    Ok(key)
}
