import { invoke } from '@tauri-apps/api/core';

export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  root: string;
  failures: number;
  retry_after_ms: number;
}

export const vault = {
  status: () => invoke<VaultStatus>('vault_status'),
  initialize: (password: string) => invoke<void>('vault_initialize', { password }),
  unlock: (password: string) => invoke<void>('vault_unlock', { password }),
  lock: () => invoke<void>('vault_lock'),
  encryptBytes: (name: string, data: number[]) => invoke<number[]>('vault_encrypt_bytes', { name, data }),
  decryptBytes: (name: string, envelope: number[]) => invoke<number[]>('vault_decrypt_bytes', { name, envelope }),
};
