//! OS/session lifecycle integration boundary.
//! The frontend/desktop adapter should call `lock_for_security_event` for
//! suspend, sleep, logout, session change, application close and inactivity.

use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct SecureSession {
    key: Mutex<Option<Zeroizing<[u8; 32]>>>,
}

impl SecureSession {
    pub fn new() -> Self { Self { key: Mutex::new(None) } }
    pub fn lock_for_security_event(&self) {
        if let Ok(mut key) = self.key.lock() { *key = None; }
    }
}

impl Default for SecureSession { fn default() -> Self { Self::new() } }
