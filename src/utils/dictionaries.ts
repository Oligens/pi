// Dictionnaires de mots de passe pour le cassage PDF

// Mots de passe les plus courants (top 1000)
export const COMMON_PASSWORDS = [
  // Très courants
  '123456', 'password', '12345678', 'qwerty', 'abc123', '1234567',
  '123456789', '12345', '1234', '111111', '1234567890', '123123',
  'admin', 'letmein', 'welcome', 'monkey', 'master', 'dragon',
  'login', 'princess', 'football', 'shadow', 'sunshine', 'trustno1',
  'iloveyou', 'batman', 'access', 'hello', 'charlie', 'donald',
  'password1', 'qwerty123', '1q2w3e4r', '000000', '1qaz2wsx',
  'qazwsx', '123qwe', 'zaq12wsx', '121212', 'flower', 'passw0rd',
  
  // Français courants
  'motdepasse', 'bonjour', 'france', 'paris', 'amour', 'soleil',
  'football', 'nicolas', 'thomas', 'alexandre', 'jean', 'pierre',
  'michel', 'jacques', 'philippe', 'christophe', 'julien', 'maxime',
  
  // Patterns clavier AZERTY
  'azerty', 'azertyuiop', 'qsdfgh', 'wxcvbn', 'azert', 'aqwxsx',
  
  // Patterns clavier QWERTY
  'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'qwert', 'qazwsx',
  
  // Dates et années
  '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017',
  '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997',
  '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005',
  '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013',
  '2014', '2015', '2016',
  
  // Noms communs
  'john', 'michael', 'david', 'james', 'robert', 'joseph', 'william',
  'andrew', 'joshua', 'daniel', 'matthew', 'anthony', 'christopher',
  'sophie', 'emma', 'olivia', 'isabella', 'mia', 'charlotte',
  
  // Animaux
  'chien', 'chat', 'loulou', 'minou', 'rex', 'buddy', 'max',
  
  // Sports
  'psg', 'om', 'ol', 'rcm', 'foot', 'tennis', 'rugby',
  
  // Autres courants
  'secret', 'test', 'pass', 'root', 'toor', 'guest', 'user',
  'changeme', 'default', 'temp', 'temp123', 'test123', 'pass123',
];

// Mots simples pour brute-force court
export const SIMPLE_WORDS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

// Génère des combinaisons numériques (0000-9999)
export function* generateNumericCombinations(length: number): Generator<string> {
  const max = Math.pow(10, length);
  for (let i = 0; i < max; i++) {
    yield i.toString().padStart(length, '0');
  }
}

// Génère des combinaisons alphanumériques
export function* generateAlphanumericCombinations(
  length: number,
  charset: string
): Generator<string> {
  const base = charset.length;
  const max = Math.pow(base, length);
  
  for (let i = 0; i < max; i++) {
    let result = '';
    let num = i;
    for (let j = 0; j < length; j++) {
      result = charset[num % base] + result;
      num = Math.floor(num / base);
    }
    yield result;
  }
}

// Génère des variations d'un mot (majuscules, chiffres ajoutés, etc.)
export function* generateVariations(word: string): Generator<string> {
  yield word;
  yield word.toLowerCase();
  yield word.toUpperCase();
  yield word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  
  // Ajouter des chiffres courants
  for (let i = 0; i <= 999; i++) {
    yield word + i;
    yield word + i.toString().padStart(2, '0');
    yield word + i.toString().padStart(3, '0');
  }
  
  // Remplacer lettres par chiffres (leet speak)
  const leetMap: Record<string, string[]> = {
    'a': ['4', '@'],
    'e': ['3'],
    'i': ['1', '!'],
    'o': ['0'],
    's': ['5', '$'],
    't': ['7'],
    'l': ['1'],
  };
  
  // Générer quelques variations leet simples
  let leetWord = word;
  for (const [letter, replacements] of Object.entries(leetMap)) {
    if (leetWord.includes(letter)) {
      leetWord = leetWord.replace(letter, replacements[0]);
      yield leetWord;
    }
  }
}

// Jeux de caractères pour le brute-force
export const CHARSETS = {
  numeric: '0123456789',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  all: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?',
};
