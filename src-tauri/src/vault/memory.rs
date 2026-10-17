use zeroize::{Zeroize, Zeroizing};

/// Secret bytes are zeroed when dropped. This reduces accidental key retention,
/// but cannot guarantee erasure from OS swap, crash dumps, or hardware caches.
pub type SecretBytes = Zeroizing<Vec<u8>>;

pub fn secret(bytes: Vec<u8>) -> SecretBytes {
    Zeroizing::new(bytes)
}

pub fn wipe(buf: &mut [u8]) {
    buf.zeroize();
}
