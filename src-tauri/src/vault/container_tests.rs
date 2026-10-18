#[cfg(test)]
mod tests {
    use super::super::{container, crypto, kdf};
    use std::fs;

    #[test]
    fn manifest_round_trip_and_tamper_detection() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let key = kdf::derive_key(b"test-password", &[7u8; 32]).unwrap();
        let entry = container::encrypt_and_store(
            root,
            &key,
            "abc123",
            "secret.txt",
            b"classified",
        )
        .unwrap();
        let mut manifest = container::Manifest::default();
        manifest.entries.push(entry.clone());
        container::save_manifest_atomic(root, &key, &manifest).unwrap();
        let loaded = container::load_manifest(root, &key).unwrap();
        assert_eq!(loaded.entries.len(), 1);
        assert_eq!(
            container::decrypt_name(&key, &loaded.entries[0].encrypted_name).unwrap(),
            "secret.txt"
        );
        assert_eq!(
            container::read_and_decrypt(root, &key, &loaded.entries[0], "secret.txt")
                .unwrap()
                .as_slice(),
            b"classified"
        );

        let path = container::data_dir(root).join("abc123.bin");
        let mut bytes = fs::read(&path).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 1;
        fs::write(&path, bytes).unwrap();
        assert!(
            container::read_and_decrypt(root, &key, &loaded.entries[0], "secret.txt").is_err()
        );
    }

    #[test]
    fn wrong_aad_is_rejected() {
        let key = kdf::derive_key(b"password", &[8u8; 32]).unwrap();
        let envelope = crypto::encrypt(&key, b"data", b"correct-name").unwrap();
        assert!(crypto::decrypt(&key, &envelope, b"wrong-name").is_err());
    }
}
