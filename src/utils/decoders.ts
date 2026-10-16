// Décodeurs pour différents formats d'encodage

export interface DecodeResult {
  success: boolean;
  decoded: string;
  encoding: string;
  error?: string;
}

// Base64 Decoder
export function decodeBase64(input: string): DecodeResult {
  try {
    const decoded = atob(input.trim());
    // Vérifier que le résultat est du texte valide
    const isValid = /^[\x00-\x7F\u0080-\uFFFF]*$/.test(decoded);
    if (isValid || decoded.length > 0) {
      return { success: true, decoded, encoding: 'Base64' };
    }
    return { success: false, decoded: '', encoding: 'Base64', error: 'Base64 invalide' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Base64', error: 'Base64 invalide' };
  }
}

// URL Encoding Decoder
export function decodeURLEncoding(input: string): DecodeResult {
  try {
    const decoded = decodeURIComponent(input.trim());
    return { success: true, decoded, encoding: 'URL Encoding' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'URL Encoding', error: 'URL encoding invalide' };
  }
}

// Hexadecimal Decoder
export function decodeHex(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:0x]/gi, '').replace(/^#/, '');
    if (!/^[0-9a-fA-F]+$/.test(cleaned) || cleaned.length % 2 !== 0) {
      return { success: false, decoded: '', encoding: 'Hexadecimal', error: 'Hex invalide' };
    }
    let decoded = '';
    for (let i = 0; i < cleaned.length; i += 2) {
      const charCode = parseInt(cleaned.substr(i, 2), 16);
      decoded += String.fromCharCode(charCode);
    }
    return { success: true, decoded, encoding: 'Hexadecimal' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Hexadecimal', error: 'Hex invalide' };
  }
}

// Binary Decoder
export function decodeBinary(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:]/g, '');
    if (!/^[01]+$/.test(cleaned)) {
      return { success: false, decoded: '', encoding: 'Binaire', error: 'Binaire invalide' };
    }
    // S'assurer que la longueur est un multiple de 8
    const padded = cleaned.padStart(Math.ceil(cleaned.length / 8) * 8, '0');
    let decoded = '';
    for (let i = 0; i < padded.length; i += 8) {
      const byte = padded.substr(i, 8);
      decoded += String.fromCharCode(parseInt(byte, 2));
    }
    return { success: true, decoded, encoding: 'Binaire' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Binaire', error: 'Binaire invalide' };
  }
}

// Octal Decoder
export function decodeOctal(input: string): DecodeResult {
  try {
    const cleaned = input.trim().replace(/[\s,;:\\]/g, '');
    if (!/^[0-7]+$/.test(cleaned)) {
      return { success: false, decoded: '', encoding: 'Octal', error: 'Octal invalide' };
    }
    const padded = cleaned.padStart(Math.ceil(cleaned.length / 3) * 3, '0');
    let decoded = '';
    for (let i = 0; i < padded.length; i += 3) {
      const charCode = parseInt(padded.substr(i, 3), 8);
      if (charCode > 255) {
        return { success: false, decoded: '', encoding: 'Octal', error: 'Valeur octal trop grande' };
      }
      decoded += String.fromCharCode(charCode);
    }
    return { success: true, decoded, encoding: 'Octal' };
  } catch (e) {
    return { success: false, decoded: '', encoding: 'Octal', error: 'Octal invalide' };
  }
}

// ROT13 Decoder
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

// Caesar Cipher Decoder (essaye tous les décalages)
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

// Morse Code Decoder
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

// HTML Entities Decoder
export function decodeHTMLEntities(input: string): DecodeResult {
  try {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input.trim();
    const decoded = textarea.value;
    if (decoded !== input.trim()) {
      return { success: true, decoded, encoding: 'HTML Entities' };
    }
    return { success: false, decoded: '', encoding: 'HTML Entities', error: 'Pas d\'entités HTML détectées' };
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
    const decoded = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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

// Atbash Cipher Decoder
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

// Brainfuck Decoder
export function decodeBrainfuck(input: string): DecodeResult {
  try {
    const code = input.replace(/[^+\-<>.,\[\]]/g, '');
    if (code.length === 0) {
      return { success: false, decoded: '', encoding: 'Brainfuck', error: 'Pas de code Brainfuck détecté' };
    }
    const tape = new Uint8Array(30000);
    let pointer = 0;
    let output = '';
    let i = 0;

    const loopStack: number[] = [];
    const loopMap: Record<number, number> = {};

    // Pré-calculer les boucles
    for (let j = 0; j < code.length; j++) {
      if (code[j] === '[') loopStack.push(j);
      if (code[j] === ']') {
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
        case '>': pointer++; break;
        case '<': pointer--; break;
        case '+': tape[pointer] = (tape[pointer] + 1) % 256; break;
        case '-': tape[pointer] = (tape[pointer] + 255) % 256; break;
        case '.': output += String.fromCharCode(tape[pointer]); break;
        case '[':
          if (tape[pointer] === 0) i = loopMap[i];
          break;
        case ']':
          if (tape[pointer] !== 0) i = loopMap[i];
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

// Détection automatique du format
export function detectEncoding(input: string): string[] {
  const trimmed = input.trim();
  const candidates: string[] = [];

  // Base64
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
  if (/[+\-<>.,\[\]]/.test(trimmed) && trimmed.replace(/[^+\-<>.,\[\]]/g, '').length > 5) {
    candidates.push('Brainfuck');
  }

  // ROT13 / César (toujours possible pour du texte alphabétique)
  if (/[a-zA-Z]/.test(trimmed)) {
    candidates.push('ROT13');
    candidates.push('César');
  }

  // Octal
  if (/^[0-7\s,;:\\]+$/.test(trimmed) && trimmed.replace(/[\s,;:\\]/g, '').length >= 3) {
    candidates.push('Octal');
  }

  // Atbash
  if (/[a-zA-Z]/.test(trimmed)) {
    candidates.push('Atbash');
  }

  return candidates.length > 0 ? candidates : ['Base64', 'URL Encoding', 'Hexadecimal'];
}

// Fonction principale de décodage
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

// Décodage en cascade (essaye tous les formats)
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
