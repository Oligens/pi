use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Key, Nonce};
use rand::{rngs::OsRng, RngCore};
use zeroize::Zeroizing;

use super::VaultError;

pub const NONCE_LEN: usize = 12;

pub fn encrypt(key_bytes: &[u8; 32], plaintext: &[u8], aad: &[u8]) -> Result<Vec<u8>, VaultError> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), aes_gcm::aead::Payload { msg: plaintext, aad })
        .map_err(|_| VaultError::Crypto)?;
    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt(key_bytes: &[u8; 32], envelope: &[u8], aad: &[u8]) -> Result<Zeroizing<Vec<u8>>, VaultError> {
    if envelope.len() < NONCE_LEN + 16 { return Err(VaultError::InvalidFormat); }
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&envelope[..NONCE_LEN]), aes_gcm::aead::Payload { msg: &envelope[NONCE_LEN..], aad })
        .map_err(|_| VaultError::AuthenticationFailed)?;
    Ok(Zeroizing::new(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip() {
        let key = [7u8; 32];
        let encrypted = encrypt(&key, b"secret", b"name.txt").unwrap();
        assert_eq!(decrypt(&key, &encrypted, b"name.txt").unwrap().as_slice(), b"secret");
    }
    #[test]
    fn tampering_is_rejected() {
        let key = [9u8; 32];
        let mut encrypted = encrypt(&key, b"secret", b"name.txt").unwrap();
        encrypted[NONCE_LEN] ^= 1;
        assert!(decrypt(&key, &encrypted, b"name.txt").is_err());
    }
    #[test]
    fn wrong_aad_is_rejected() {
        let key = [3u8; 32];
        let encrypted = encrypt(&key, b"secret", b"name.txt").unwrap();
        assert!(decrypt(&key, &encrypted, b"other.txt").is_err());
    }
}
