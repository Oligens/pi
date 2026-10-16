// Décodeurs pour différents formats d'encodage
// Support complet UTF-8 pour le texte ET fichiers binaires (images, PDF, ZIP, etc.)

export interface DecodeResult {
  success: boolean;
  decoded: string;              // Texte décodé (ou placeholder si binaire)
  decodedBytes?: Uint8Array;    // Octets bruts (indispensable pour les fichiers binaires)
  encoding: string;
  error?: string;
  isBinary?: boolean;           // Indique si le contenu est binaire (non-texte)
  mimeType?: string;            // Type MIME détecté pour les fichiers binaires
}

// ============================================================
// UTILITAIRES
// ============================================================

// Détection du type MIME via les magic bytes
export function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length < 4) return 'application/octet-stream';
  
  const header = Array.from(bytes.slice(0, 16));
  const headerStr = String.fromCharCode(...bytes.slice(0, 8));
  
  // Images
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return 'image/png';
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return 'image/jpeg';
  if (headerStr.startsWith('GIF87a') || headerStr.startsWith('GIF89a')) return 'image/gif';
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return 'image/webp';
  if (header[0] === 0x42 && header[1] === 0x4D) return 'image/bmp';
  if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x00 && header[3] === 0x0C) return 'image/x-icon';
  
  // Documents
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) return 'application/pdf';
  if (header[0] === 0x50 && header[1] === 0x4B && (header[2] === 0x03 || header[2] === 0x05)) return 'application/zip';
  if (header[0] === 0x1F && header[1] === 0x8B) return 'application/gzip';
  if (header[0] === 0x42 && header[1] === 0x5A && header[2] === 0x68) return 'application/x-bzip2';
  if (header[0] === 0x37 && header[1] === 0x7A && header[2] === 0xBC && header[3] === 0xAF) return 'application/x-7z-compressed';
  if (header[0] === 0x7F && header[1] === 0x45 && header[2] === 0x4C && header[3] === 0x46) return 'application/x-elf';
  
  // Audio/Vidéo
  if (headerStr.startsWith('RIFF') && bytes[8] === 0x57 && bytes[9] === 0x41) return 'audio/wav';
  if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) return 'audio/ogg';
  if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) return 'audio/flac';
  if (headerStr.startsWith('ID3') || (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0)) return 'audio/mpeg';
  
  // Web
  if (headerStr.startsWith('<!DOCTYPE') || headerStr.startsWith('<html') || headerStr.startsWith('<HTML')) return 'text/html';
  if (headerStr.startsWith('<?xml')) return 'application/xml';
  if (headerStr.startsWith('{') || headerStr.startsWith('[')) return 'application/json';
  
  // Exécutables
  if (header[0] === 0x4D && header[1] === 0x5A) return 'application/x-dosexec';
  if (header[0] === 0x7F && header[1] === 0x45 && header[2] === 0x4C && header[3] === 0x46) return 'application/x-elf';
  
  // Fonts
  if (header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) return 'font/ttf';
  if (headerStr.startsWith('wOFF')) return 'font/woff';
  if (headerStr.startsWith('wOF2')) return 'font/woff2';
  
  return 'application/octet-stream';
}

// Vérifie si un Uint8Array contient du texte UTF-8 valide
function isValidUTF8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

// Convertit un Uint8Array en string UTF-8 (avec fallback)
function bytesToString(bytes: Uint8Array): { text: string; isBinary: boolean } {
  if (isValidUTF8(bytes)) {
    const text = new TextDecoder('utf-8').decode(bytes);
    // Vérifier si le texte contient trop de caractères de contrôle (signe de binaire)
    const controlChars = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const ratio = controlChars / text.length;
    if (ratio > 0.1 && text.length > 100) {
      return { text: `[Contenu binaire - ${bytes.length} octets]`, isBinary: true };
    }
    return { text, isBinary: false };
  }
  return { text: `[Contenu binaire - ${bytes.length} octets]`, isBinary: true };
}

// ============================================================
// DÉCODEURS
// ============================================================

// Base64 Decoder (support texte ET fichiers binaires)
export function decodeBase64(input: string): DecodeResult {
  try {
    const cleaned = input.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
      return { success: false, decoded: '', encoding: 'Base64', error: 'Format Base64 invalide' };
    }
    
    const binaryString = atob(cleaned);
    const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    
    const { text, isBinary } = bytesToString(bytes);
    const mimeType = isBinary ? detectMimeType(bytes) : undefined;
    
    return { 
      success: true, 
      decoded: text, 
      decodedBytes: bytes,
      encoding: 'Base64',
      isBinary,
      mimeType
    };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Base64', error: 'Base64 invalide' };
  }
}

// URL Encoding Decoder (texte uniquement)
export function decodeURLEncoding(input: string): DecodeResult {
  try {
    const decoded = decodeURIComponent(input.trim());
    return { success: true, decoded, encoding: 'URL Encoding' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'URL Encoding', error: 'URL encoding invalide' };
  }
}

// Hexadecimal Decoder (support texte ET fichiers binaires)
export function decodeHex(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:0x]/gi, '').replace(/^#/, '');
    if (!/^[0-9a-fA-F]+$/.test(cleaned) || cleaned.length % 2 !== 0) {
      return { success: false, decoded: '', encoding: 'Hexadecimal', error: 'Hex invalide' };
    }
    
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16);
    }
    
    const { text, isBinary } = bytesToString(bytes);
    const mimeType = isBinary ? detectMimeType(bytes) : undefined;
    
    return { 
      success: true, 
      decoded: text, 
      decodedBytes: bytes,
      encoding: 'Hexadecimal',
      isBinary,
      mimeType
    };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Hexadecimal', error: 'Hex invalide' };
  }
}

// Binary Decoder (support texte ET fichiers binaires)
export function decodeBinary(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:]/g, '');
    if (!/^[01]+$/.test(cleaned)) {
      return { success: false, decoded: '', encoding: 'Binaire', error: 'Binaire invalide' };
    }
    
    const padded = cleaned.padStart(Math.ceil(cleaned.length / 8) * 8, '0');
    const bytes = new Uint8Array(padded.length / 8);
    
    for (let i = 0; i < padded.length; i += 8) {
      bytes[i / 8] = parseInt(padded.substr(i, 8), 2);
    }
    
    const { text, isBinary } = bytesToString(bytes);
    const mimeType = isBinary ? detectMimeType(bytes) : undefined;
    
    return { 
      success: true, 
      decoded: text, 
      decodedBytes: bytes,
      encoding: 'Binaire',
      isBinary,
      mimeType
    };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Binaire', error: 'Binaire invalide' };
  }
}

// Octal Decoder (support texte ET fichiers binaires)
export function decodeOctal(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:\\]/g, '');
    if (!/^[0-7]+$/.test(cleaned)) {
      return { success: false, decoded: '', encoding: 'Octal', error: 'Octal invalide' };
    }
    
    const padded = cleaned.padStart(Math.ceil(cleaned.length / 3) * 3, '0');
    const bytesArr: number[] = [];
    
    for (let i = 0; i < padded.length; i += 3) {
      const value = parseInt(padded.substr(i, 3), 8);
      if (value > 255) {
        return { success: false, decoded: '', encoding: 'Octal', error: 'Valeur octal trop grande' };
      }
      bytesArr.push(value);
    }
    
    const bytes = new Uint8Array(bytesArr);
    const { text, isBinary } = bytesToString(bytes);
    const mimeType = isBinary ? detectMimeType(bytes) : undefined;
    
    return { 
      success: true, 
      decoded: text, 
      decodedBytes: bytes,
      encoding: 'Octal',
      isBinary,
      mimeType
    };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Octal', error: 'Octal invalide' };
  }
}

// ROT13 Decoder (texte uniquement)
export function decodeROT13(input: string): DecodeResult {
  try {
    const decoded = input.replace(/[a-zA-Z]/g, (char) => {
      const base = char <= 'Z' ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
    });
    return { success: true, decoded, encoding: 'ROT13' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'ROT13', error: 'Erreur ROT13' };
  }
}

// Caesar Cipher Decoder (texte uniquement)
export function decodeCaesar(input: string, shift: number = 3): DecodeResult {
  try {
    const decoded = input.replace(/[a-zA-Z]/g, (char) => {
      const base = char <= 'Z' ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
    });
    return { success: true, decoded, encoding: `César (décalage ${shift})` };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'César', error: 'Erreur César' };
  }
}

// Morse Code Decoder (texte uniquement)
const MORSE_CODE: Record<string, string> = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3',
  '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
  '----.': '9', '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
  '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&',
  '---...': ':', '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-',
  '..--.-': '_', '.-..-.': '"', '...-..-': '$', '.--.-.': '@',
};

export function decodeMorse(input: string): DecodeResult {
  try {
    const trimmed = input.trim();
    if (!/^[.\-\s/|]+$/.test(trimmed)) {
      return { success: false, decoded: '', encoding: 'Morse', error: 'Code Morse invalide' };
    }
    
    const words = trimmed.split(/\s{3,}|\/|\|/);
    const decoded = words.map(word => {
      const letters = word.trim().split(/\s+/);
      return letters.map(letter => MORSE_CODE[letter] || '').join('');
    }).join(' ');
    
    return { success: true, decoded, encoding: 'Morse' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Morse', error: 'Code Morse invalide' };
  }
}

// HTML Entities Decoder (compatible navigateur et Node.js)
export function decodeHTMLEntities(input: string): DecodeResult {
  try {
    const trimmed = input.trim();
    
    if (!/&[#\w]+;/.test(trimmed)) {
      return { success: false, decoded: '', encoding: 'HTML Entities', error: 'Pas d\'entités HTML détectées' };
    }
    
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = trimmed;
      const decoded = textarea.value;
      return { success: true, decoded, encoding: 'HTML Entities' };
    }
    
    // Fallback Node.js
    const decoded = trimmed
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    return { success: true, decoded, encoding: 'HTML Entities' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'HTML Entities', error: 'Entités HTML invalides' };
  }
}

// Unicode Escape Decoder
export function decodeUnicode(input: string): DecodeResult {
  try {
    const cleaned = input.trim();
    if (!/\\u[0-9a-fA-F]{4}/.test(cleaned) && !/\\x[0-9a-fA-F]{2}/.test(cleaned)) {
      return { success: false, decoded: '', encoding: 'Unicode', error: 'Pas de séquences Unicode détectées' };
    }
    
    const decoded = cleaned
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    
    return { success: true, decoded, encoding: 'Unicode Escape' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Unicode', error: 'Unicode invalide' };
  }
}

// Decimal ASCII Decoder
export function decodeDecimalASCII(input: string): DecodeResult {
  try {
    const cleaned = input.trim();
    const numbers = cleaned.split(/[\s,;]+/).map(Number);
    
    if (numbers.some(n => isNaN(n) || n < 0 || n > 127)) {
      return { success: false, decoded: '', encoding: 'ASCII Décimal', error: 'Valeurs décimales invalides' };
    }
    
    const decoded = numbers.map(n => String.fromCharCode(n)).join('');
    return { success: true, decoded, encoding: 'ASCII Décimal' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'ASCII Décimal', error: 'ASCII décimal invalide' };
  }
}

// Atbash Cipher Decoder (texte uniquement)
export function decodeAtbash(input: string): DecodeResult {
  try {
    const decoded = input.replace(/[a-zA-Z]/g, (char) => {
      const base = char <= 'Z' ? 65 : 97;
      return String.fromCharCode(base + (25 - (char.charCodeAt(0) - base)));
    });
    return { success: true, decoded, encoding: 'Atbash' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Atbash', error: 'Erreur Atbash' };
  }
}

// Brainfuck Decoder (robuste avec validation)
export function decodeBrainfuck(input: string): DecodeResult {
  try {
    const code = input.replace(/[^+\-<>.,\[\]]/g, '');
    
    if (code.length === 0) {
      return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Pas de code Brainfuck détecté' };
    }
    
    // Validation des crochets
    let bracketCount = 0;
    for (const char of code) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (bracketCount < 0) {
        return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Crochets non appariés' };
      }
    }
    
    if (bracketCount !== 0) {
      return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Crochets non appariés' };
    }
    
    const tape = new Uint8Array(30000);
    let pointer = 0;
    let output = '';
    let i = 0;
    
    const loopStack: number[] = [];
    const loopMap: Record<number, number> = {};
    
    for (let j = 0; j < code.length; j++) {
      if (code[j] === '[') {
        loopStack.push(j);
      }
      if (code[j] === ']') {
        if (loopStack.length === 0) {
          return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Crochets non appariés' };
        }
        const open = loopStack.pop()!;
        loopMap[open] = j;
        loopMap[j] = open;
      }
    }
    
    let iterations = 0;
    const maxIterations = 1000000;
    
    while (i < code.length && iterations < maxIterations) {
      iterations++;
      switch (code[i]) {
        case '>': 
          pointer = (pointer + 1) % tape.length;
          break;
        case '<': 
          pointer = (pointer - 1 + tape.length) % tape.length;
          break;
        case '+': 
          tape[pointer] = (tape[pointer] + 1) % 256; 
          break;
        case '-': 
          tape[pointer] = (tape[pointer] + 255) % 256; 
          break;
        case '.': 
          output += String.fromCharCode(tape[pointer]); 
          break;
        case '[':
          if (tape[pointer] === 0) {
            i = loopMap[i] ?? i;
          }
          break;
        case ']':
          if (tape[pointer] !== 0) {
            i = loopMap[i] ?? i;
          }
          break;
      }
      i++;
    }
    
    if (output.length === 0) {
      return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Aucune sortie Brainfuck' };
    }
    
    return { success: true, decoded: output, encoding: 'Brainfuck' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Erreur Brainfuck' };
  }
}

// ============================================================
// DÉTECTION AUTOMATIQUE
// ============================================================

export function detectEncoding(input: string): string[] {
  const trimmed = input.trim();
  const candidates: string[] = [];

  // Base64 (validation stricte)
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 4 && trimmed.length % 4 === 0) {
    candidates.push('Base64');
  }

  // URL Encoding
  if (/%[0-9a-fA-F]{2}/.test(trimmed)) {
    candidates.push('URL Encoding');
  }

  // Hexadecimal
  if (/^(0x|#)?[0-9a-fA-F\s,;:]+$/i.test(trimmed) && trimmed.replace(/[\s,;:0x#]/gi, '').length % 2 === 0) {
    candidates.push('Hexadecimal');
  }

  // Binaire
  if (/^[\s,;:01]+$/.test(trimmed) && /[01]{8}/.test(trimmed.replace(/\s/g, ''))) {
    candidates.push('Binaire');
  }

  // Morse
  if (/^[.\-\s/|]+$/.test(trimmed) && trimmed.length > 0) {
    candidates.push('Morse');
  }

  // HTML Entities
  if (/&[#\w]+;/.test(trimmed)) {
    candidates.push('HTML Entities');
  }

  // Unicode Escape
  if (/\\u[0-9a-fA-F]{4}/.test(trimmed) || /\\x[0-9a-fA-F]{2}/.test(trimmed)) {
    candidates.push('Unicode');
  }

  // ASCII Décimal
  if (/^\d+(\s+\d+)*$/.test(trimmed)) {
    candidates.push('ASCII Décimal');
  }

  // Brainfuck
  const bfChars = trimmed.replace(/[^+\-<>.,\[\]]/g, '');
  if (bfChars.length > 10 && /[+\-<>.,\[\]]/.test(trimmed)) {
    candidates.push('Brainfuck');
  }

  // Octal
  if (/^[0-7\s,;:\\]+$/.test(trimmed) && trimmed.replace(/[\s,;:\\]/g, '').length >= 3) {
    candidates.push('Octal');
  }

  return candidates.length > 0 ? candidates : ['Base64', 'URL Encoding', 'Hexadecimal'];
}

// ============================================================
// FONCTIONS PRINCIPALES
// ============================================================

export function decode(input: string, encoding: string): DecodeResult {
  switch (encoding) {
    case 'Base64': return decodeBase64(input);
    case 'URL Encoding': return decodeURLEncoding(input);
    case 'Hexadecimal': return decodeHex(input);
    case 'Binaire': return decodeBinary(input);
    case 'Octal': return decodeOctal(input);
    case 'ROT13': return decodeROT13(input);
    case 'César': return decodeCaesar(input);
    case 'Morse': return decodeMorse(input);
    case 'HTML Entities': return decodeHTMLEntities(input);
    case 'Unicode': return decodeUnicode(input);
    case 'ASCII Décimal': return decodeDecimalASCII(input);
    case 'Atbash': return decodeAtbash(input);
    case 'Brainfuck': return decodeBrainfuck(input);
    default: return { success: false, decoded: '', encoding, error: 'Format non supporté' };
  }
}

export function autoDecode(input: string): DecodeResult[] {
  const encodings = detectEncoding(input);
  const results: DecodeResult[] = [];

  for (const encoding of encodings) {
    const result = decode(input, encoding);
    if (result.success) {
      results.push(result);
    }
  }

  return results;
}

// Utilitaire pour obtenir l'extension de fichier à partir du MIME
export function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/x-bzip2': 'bz2',
    'application/x-7z-compressed': '7z',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/mpeg': 'mp3',
    'text/html': 'html',
    'application/xml': 'xml',
    'application/json': 'json',
    'application/x-dosexec': 'exe',
    'application/x-elf': 'elf',
    'font/ttf': 'ttf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'application/octet-stream': 'bin',
  };
  return mimeToExt[mimeType] || 'bin';
}
