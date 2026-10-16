// Moteur de cassage de mots de passe PDF
// Supporte plusieurs stratégies d'attaque avec progression en temps réel

import { decryptPDF } from './pdfDecryptor';
import {
  COMMON_PASSWORDS,
  SIMPLE_WORDS,
  generateNumericCombinations,
  generateAlphanumericCombinations,
  generateVariations,
  CHARSETS,
} from './dictionaries';

export type AttackStrategy =
  | 'dictionary'        // Dictionnaire de mots de passe courants
  | 'dictionary-leet'   // Dictionnaire + variations leet speak
  | 'numeric'           // PIN numériques (0-9999, etc.)
  | 'bruteforce'        // Brute-force complet
  | 'mask'              // Attaque par masque (pattern)
  | 'wordlist'          // Liste de mots personnalisée
  | 'combined';         // Combinaison de toutes les méthodes

export interface CrackConfig {
  strategy: AttackStrategy;
  maxLength?: number;         // Longueur max pour brute-force
  charset?: keyof typeof CHARSETS; // Jeu de caractères
  mask?: string;              // Masque pour l'attaque par masque (? = wildcard)
  customWordlist?: string;    // Liste de mots personnalisée (séparée par des retours à la ligne)
  batchSize?: number;         // Nombre de tentatives avant yield
}

export interface CrackProgress {
  currentPassword: string;
  attempts: number;
  speed: number;              // Tentatives par seconde
  elapsed: number;            // Temps écoulé en ms
  strategy: string;           // Stratégie en cours
  totalEstimate?: number;     // Estimation du total (si calculable)
}

export interface CrackResult {
  success: boolean;
  password?: string;
  decryptedBytes?: Uint8Array;
  attempts: number;
  elapsed: number;
  speed: number;
  error?: string;
}

// Fonction pour tester un mot de passe (cache pour éviter les re-décodages)
async function tryPassword(
  pdfBytes: Uint8Array,
  password: string
): Promise<{ success: boolean; decryptedBytes?: Uint8Array }> {
  const result = await decryptPDF(pdfBytes, password);
  return {
    success: result.success,
    decryptedBytes: result.decryptedBytes,
  };
}

// Génère les mots de passe selon la stratégie
async function* generatePasswords(config: CrackConfig): AsyncGenerator<string> {
  const { strategy } = config;

  switch (strategy) {
    case 'dictionary':
      for (const pwd of COMMON_PASSWORDS) {
        yield pwd;
      }
      break;

    case 'dictionary-leet':
      for (const pwd of COMMON_PASSWORDS) {
        for (const variation of generateVariations(pwd)) {
          yield variation;
        }
      }
      for (const word of SIMPLE_WORDS) {
        yield word;
      }
      break;

    case 'numeric': {
      const maxLen = config.maxLength || 6;
      for (let len = 1; len <= maxLen; len++) {
        for (const combo of generateNumericCombinations(len)) {
          yield combo;
        }
      }
      break;
    }

    case 'bruteforce': {
      const maxLen = config.maxLength || 4;
      const charset = CHARSETS[config.charset || 'lowercase'];
      for (let len = 1; len <= maxLen; len++) {
        for (const combo of generateAlphanumericCombinations(len, charset)) {
          yield combo;
        }
      }
      break;
    }

    case 'mask': {
      const mask = config.mask || '';
      if (!mask) break;
      for (const combo of generateFromMask(mask)) {
        yield combo;
      }
      break;
    }

    case 'wordlist': {
      const words = (config.customWordlist || '').split(/[\r\n]+/).filter(w => w.trim());
      for (const word of words) {
        yield word.trim();
      }
      break;
    }

    case 'combined': {
      // 1. Dictionnaire courant
      for (const pwd of COMMON_PASSWORDS) {
        yield pwd;
      }
      // 2. PIN courts (1-4 chiffres)
      for (let len = 1; len <= 4; len++) {
        for (const combo of generateNumericCombinations(len)) {
          yield combo;
        }
      }
      // 3. Variations leet
      for (const pwd of COMMON_PASSWORDS.slice(0, 100)) {
        for (const variation of generateVariations(pwd)) {
          yield variation;
        }
      }
      break;
    }
  }
}

// Génère des combinaisons à partir d'un masque
// ? = n'importe quel caractère alphanumérique
// ?l = lettre minuscule, ?u = majuscule, ?d = chiffre, ?s = symbole
function* generateFromMask(mask: string): Generator<string> {
  const positions: string[] = [];
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === '?') {
      if (i + 1 < mask.length) {
        switch (mask[i + 1]) {
          case 'l': positions.push(CHARSETS.lowercase); i++; break;
          case 'u': positions.push(CHARSETS.uppercase); i++; break;
          case 'd': positions.push(CHARSETS.numeric); i++; break;
          case 's': positions.push('!@#$%^&*'); i++; break;
          default: positions.push(CHARSETS.alphanumeric); break;
        }
      } else {
        positions.push(CHARSETS.alphanumeric);
      }
    } else {
      positions.push(mask[i]);
    }
  }

  // Générer toutes les combinaisons
  const total = positions.reduce((acc, p) => acc * p.length, 1);
  
  if (total > 10000000) {
    // Trop de combinaisons, on limite
    return;
  }

  for (let i = 0; i < total; i++) {
    let result = '';
    let num = i;
    for (let j = positions.length - 1; j >= 0; j--) {
      const charset = positions[j];
      result = charset[num % charset.length] + result;
      num = Math.floor(num / charset.length);
    }
    yield result;
  }
}

// Estime le nombre total de tentatives
function estimateTotal(config: CrackConfig): number | undefined {
  const { strategy } = config;
  
  switch (strategy) {
    case 'dictionary':
      return COMMON_PASSWORDS.length;
    case 'numeric': {
      const maxLen = config.maxLength || 6;
      let total = 0;
      for (let len = 1; len <= maxLen; len++) {
        total += Math.pow(10, len);
      }
      return total;
    }
    case 'bruteforce': {
      const maxLen = config.maxLength || 4;
      const charset = CHARSETS[config.charset || 'lowercase'];
      let total = 0;
      for (let len = 1; len <= maxLen; len++) {
        total += Math.pow(charset.length, len);
      }
      return total;
    }
    case 'mask': {
      if (!config.mask) return undefined;
      let total = 1;
      const mask = config.mask;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === '?') {
          if (i + 1 < mask.length) {
            switch (mask[i + 1]) {
              case 'l': total *= 26; i++; break;
              case 'u': total *= 26; i++; break;
              case 'd': total *= 10; i++; break;
              case 's': total *= 8; i++; break;
              default: total *= 62; break;
            }
          } else {
            total *= 62;
          }
        }
      }
      return total;
    }
    case 'wordlist':
      return (config.customWordlist || '').split(/[\r\n]+/).filter(w => w.trim()).length;
    default:
      return undefined;
  }
}

// Classe principale du cracker
export class PDFCracker {
  private pdfBytes: Uint8Array;
  private config: CrackConfig;
  private cancelled = false;
  private paused = false;
  private onProgress?: (progress: CrackProgress) => void;
  private foundPasswords: Set<string> = new Set(); // Éviter les doublons

  constructor(pdfBytes: Uint8Array, config: CrackConfig) {
    this.pdfBytes = pdfBytes;
    this.config = config;
  }

  setProgressCallback(callback: (progress: CrackProgress) => void) {
    this.onProgress = callback;
  }

  cancel() {
    this.cancelled = true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  async crack(): Promise<CrackResult> {
    const startTime = Date.now();
    let attempts = 0;
    const batchSize = this.config.batchSize || 10;
    const totalEstimate = estimateTotal(this.config);
    this.foundPasswords.clear();

    const passwordGenerator = generatePasswords(this.config);

    while (!this.cancelled) {
      // Gérer la pause
      while (this.paused && !this.cancelled) {
        await sleep(100);
      }

      if (this.cancelled) break;

      // Traiter un lot de mots de passe
      const batch: string[] = [];
      for (let i = 0; i < batchSize; i++) {
        const next = await passwordGenerator.next();
        if (next.done) break;
        const pwd = next.value;
        if (!this.foundPasswords.has(pwd)) {
          this.foundPasswords.add(pwd);
          batch.push(pwd);
        }
      }

      if (batch.length === 0) break; // Plus de mots de passe à essayer

      // Tester le lot
      for (const pwd of batch) {
        if (this.cancelled) break;

        attempts++;
        const elapsed = Date.now() - startTime;
        const speed = elapsed > 0 ? Math.round((attempts / elapsed) * 1000) : 0;

        // Reporter la progression
        if (this.onProgress) {
          this.onProgress({
            currentPassword: pwd,
            attempts,
            speed,
            elapsed,
            strategy: this.config.strategy,
            totalEstimate,
          });
        }

        // Tester le mot de passe
        try {
          const result = await tryPassword(this.pdfBytes, pwd);
          if (result.success) {
            return {
              success: true,
              password: pwd,
              decryptedBytes: result.decryptedBytes,
              attempts,
              elapsed: Date.now() - startTime,
              speed: Math.round((attempts / (Date.now() - startTime)) * 1000),
            };
          }
        } catch {
          // Continuer même si une tentative échoue
        }
      }

      // Yield pour garder l'UI réactive
      await sleep(0);
    }

    return {
      success: false,
      attempts,
      elapsed: Date.now() - startTime,
      speed: Math.round((attempts / Math.max(1, Date.now() - startTime)) * 1000),
      error: this.cancelled ? 'Cassage annulé par l\'utilisateur' : 'Mot de passe non trouvé',
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction helper pour estimer le temps restant
export function estimateTimeRemaining(
  attempts: number,
  total: number,
  speed: number
): string {
  if (speed === 0 || total === 0) return 'Calcul...';
  const remaining = total - attempts;
  const seconds = remaining / speed;
  
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}j`;
}

// Vérifie si une stratégie est raisonnable (pas trop longue)
export function isStrategyFeasible(config: CrackConfig): { feasible: boolean; estimate?: string } {
  const total = estimateTotal(config);
  if (!total) return { feasible: true };
  
  // Estimer ~5 tentatives/seconde (conservateur pour PDF)
  const estimatedSpeed = 5;
  const seconds = total / estimatedSpeed;
  
  if (seconds < 60) return { feasible: true, estimate: `< 1 minute` };
  if (seconds < 3600) return { feasible: true, estimate: `~${Math.round(seconds / 60)} minutes` };
  if (seconds < 86400) return { feasible: true, estimate: `~${(seconds / 3600).toFixed(1)} heures` };
  if (seconds < 86400 * 7) return { feasible: false, estimate: `~${(seconds / 86400).toFixed(1)} jours (déconseillé)` };
  return { feasible: false, estimate: `Plusieurs semaines (impraticable)` };
}
