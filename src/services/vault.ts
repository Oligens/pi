import { invoke } from '@tauri-apps/api/core';

export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  failures: number;
  retry_after_ms: number;
}

export interface VaultItem {
  id: string;
  name: string;
  size: number;
}

export interface VaultQuota {
  quota_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
}

export const vault = {
  status: () => invoke<VaultStatus>('vault_status'),
  initialize: (password: string) => invoke<void>('vault_initialize', { password }),
  unlock: (password: string) => invoke<void>('vault_unlock', { password }),
  lock: () => invoke<void>('vault_lock'),
  quota: () => invoke<VaultQuota>('vault_quota'),
  setQuota: (quotaBytes: number) => invoke<VaultQuota>('vault_set_quota', { quotaBytes }),
  importBytes: (name: string, data: number[]) => invoke<string>('vault_import_bytes', { name, data }),
  list: async () => {
    const items = await invoke<Array<[string, string, number]>>('vault_list');
    return items.map(([id, name, size]) => ({ id, name, size }));
  },
  exportBytes: (id: string) => invoke<number[]>('vault_export_bytes', { id }),
  delete: (id: string) => invoke<void>('vault_delete', { id }),
  encryptBytes: (name: string, data: number[]) => invoke<number[]>('vault_encrypt_bytes', { name, data }),
  decryptBytes: (name: string, envelope: number[]) => invoke<number[]>('vault_decrypt_bytes', { name, envelope }),
};
