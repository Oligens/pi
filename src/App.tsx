import { useState, useCallback, useRef, useEffect } from 'react';
import {
  decode,
  autoDecode,
  detectEncoding,
  getExtensionFromMime,
  type DecodeResult,
} from './utils/decoders';
import { decryptPDF, isPDFEncrypted, type PDFDecryptResult } from './utils/pdfDecryptor';

const ENCODINGS = [
  { value: 'auto', label: '🔍 Détection automatique', desc: 'Détecte le format automatiquement' },
  { value: 'Base64', label: '🔢 Base64', desc: 'SGVsbG8gV29ybGQ= (texte ou fichier binaire)' },
  { value: 'URL Encoding', label: '🌐 URL Encoding', desc: '%48%65%6C%6C%6F (texte uniquement)' },
  { value: 'Hexadecimal', label: '🔣 Hexadécimal', desc: '48656C6C6F (texte ou fichier binaire)' },
  { value: 'Binaire', label: '💻 Binaire', desc: '01001000 01100101 (texte ou fichier binaire)' },
  { value: 'Octal', label: '🔢 Octal', desc: '110 145 154 (texte ou fichier binaire)' },
  { value: 'ROT13', label: '🔄 ROT13', desc: 'Uryyb Jbeyq (texte uniquement)' },
  { value: 'César', label: '🔀 César', desc: 'Décalage configurable (texte uniquement)' },
  { value: 'Morse', label: '📡 Morse', desc: '.... . .-.. .-.. --- (texte uniquement)' },
  { value: 'HTML Entities', label: '🏷️ HTML Entities', desc: '&#72;&#101;&#108; (texte uniquement)' },
  { value: 'Unicode', label: '🅰️ Unicode Escape', desc: '\\u0048\\u0065 (texte uniquement)' },
  { value: 'ASCII Décimal', label: '🔢 ASCII Décimal', desc: '72 101 108 (texte uniquement)' },
  { value: 'Atbash', label: '🔁 Atbash', desc: 'Svool Wliow (texte uniquement)' },
  { value: 'Brainfuck', label: '🧠 Brainfuck', desc: '++++++++[>...] (texte uniquement)' },
];

const MANUAL_ONLY = ['ROT13', 'César', 'Atbash'];

function App() {
  const [input, setInput] = useState('');
  const [selectedEncoding, setSelectedEncoding] = useState('auto');
  const [results, setResults] = useState<DecodeResult[]>([]);
  const [detectedEncodings, setDetectedEncodings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [caesarShift, setCaesarShift] = useState(3);
  const [copied, setCopied] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [blobUrls, setBlobUrls] = useState<Map<number, string>>(new Map());
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfDecryptResult, setPdfDecryptResult] = useState<PDFDecryptResult | null>(null);
  const [isPdfEncrypted, setIsPdfEncrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nettoyer les blob URLs au démontage
  useEffect(() => {
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  // Créer un blob URL pour un résultat binaire
  const getBlobUrl = useCallback((result: DecodeResult, index: number): string | null => {
    if (!result.decodedBytes || !result.isBinary) return null;
    
    if (blobUrls.has(index)) {
      return blobUrls.get(index)!;
    }
    
    const mimeType = result.mimeType || 'application/octet-stream';
    const blob = new Blob([result.decodedBytes as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    setBlobUrls((prev) => {
      const next = new Map(prev);
      next.set(index, url);
      return next;
    });
    
    return url;
  }, [blobUrls]);

  const handleDecode = useCallback(async () => {
    if (!input.trim()) {
      setResults([]);
      setDetectedEncodings([]);
      setIsPdfEncrypted(false);
      setPdfDecryptResult(null);
      // Nettoyer les anciens blob URLs
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      setBlobUrls(new Map());
      return;
    }

    const detected = detectEncoding(input);
    setDetectedEncodings(detected);

    let decodeResults: DecodeResult[];
    if (selectedEncoding === 'auto') {
      decodeResults = autoDecode(input);
    } else {
      const result = decode(input, selectedEncoding);
      decodeResults = result.success ? [result] : [{ ...result, error: result.error || 'Échec du décodage' }];
    }
    setResults(decodeResults);

    // Vérifier si le résultat est un PDF chiffré
    const pdfResult = decodeResults.find(r => r.isBinary && r.mimeType === 'application/pdf' && r.decodedBytes);
    if (pdfResult && pdfResult.decodedBytes) {
      const encrypted = await isPDFEncrypted(pdfResult.decodedBytes);
      setIsPdfEncrypted(encrypted);
      if (!encrypted) {
        setPdfDecryptResult(null);
      }
    } else {
      setIsPdfEncrypted(false);
      setPdfDecryptResult(null);
    }
  }, [input, selectedEncoding, blobUrls]);

  // Fonction de déchiffrement PDF
  const handleDecryptPDF = useCallback(async () => {
    const pdfResult = results.find(r => r.isBinary && r.mimeType === 'application/pdf' && r.decodedBytes);
    if (!pdfResult || !pdfResult.decodedBytes || !pdfPassword) return;

    setIsDecrypting(true);
    setPdfDecryptResult(null);

    try {
      const result = await decryptPDF(pdfResult.decodedBytes, pdfPassword);
      setPdfDecryptResult(result);
      
      // Si le déchiffrement a réussi, ajouter le résultat déchiffré
      if (result.success && result.decryptedBytes) {
        const decryptedResult: DecodeResult = {
          success: true,
          decoded: '[PDF Déchiffré - Protection retirée]',
          decodedBytes: result.decryptedBytes,
          encoding: 'PDF Déchiffré',
          isBinary: true,
          mimeType: 'application/pdf',
        };
        setResults(prev => [...prev, decryptedResult]);
      }
    } catch (err) {
      setPdfDecryptResult({
        success: false,
        error: 'Erreur inattendue lors du déchiffrement',
      });
    } finally {
      setIsDecrypting(false);
    }
  }, [results, pdfPassword]);

  const handleFileUpload = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCopy = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleDownload = useCallback((result: DecodeResult, index: number) => {
    if (result.decodedBytes && result.isBinary) {
      // Téléchargement binaire avec le bon type MIME
      const mimeType = result.mimeType || 'application/octet-stream';
      const ext = getExtensionFromMime(mimeType);
      const blob = new Blob([result.decodedBytes as BlobPart], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decoded_${index + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Téléchargement texte
      const blob = new Blob([result.decoded], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decoded_${index + 1}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const inputLength = input.length;
  const isManualOnly = MANUAL_ONLY.includes(selectedEncoding);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-purple-500/30 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl shadow-lg shadow-purple-500/25">
              🔓
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Décodeur Universel
              </h1>
              <p className="text-xs text-gray-400">Texte & Fichiers binaires • UTF-8 • 13+ formats • Déchiffrement PDF</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
          >
            {showInfo ? '✕ Fermer' : 'ℹ️ Aide'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Panneau d'aide */}
        {showInfo && (
          <div className="mb-6 rounded-xl bg-black/40 border border-purple-500/30 p-4 animate-in">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">📖 Formats supportés</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <FormatInfo icon="🔢" name="Base64" example="SGVsbG8=" result="Hello" binary="✅ Fichiers" />
              <FormatInfo icon="🌐" name="URL Encoding" example="%48%65%6C" result="Hel" />
              <FormatInfo icon="🔣" name="Hexadécimal" example="48656C6C6F" result="Hello" binary="✅ Fichiers" />
              <FormatInfo icon="💻" name="Binaire" example="01001000 01100101" result="He" binary="✅ Fichiers" />
              <FormatInfo icon="🔢" name="Octal" example="110 145 154" result="Hel" binary="✅ Fichiers" />
              <FormatInfo icon="🔄" name="ROT13" example="Uryyb" result="Hello" />
              <FormatInfo icon="🔀" name="César" example="Khoor" result="Hello (shift 3)" />
              <FormatInfo icon="📡" name="Morse" example=".... . .-.. .-.. ---" result="HELLO" />
              <FormatInfo icon="🏷️" name="HTML Entities" example="&#72;&#101;" result="He" />
              <FormatInfo icon="🅰️" name="Unicode" example="\\u0048\\u0065" result="He" />
              <FormatInfo icon="🔢" name="ASCII Décimal" example="72 101 108" result="Hel" />
              <FormatInfo icon="🔁" name="Atbash" example="Svool" result="Hello" />
              <FormatInfo icon="🧠" name="Brainfuck" example="++++++++[>...]" result="(sortie)" />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-sm font-semibold text-blue-200 mb-1">🗂️ Support des fichiers binaires</h4>
              <p className="text-xs text-blue-300/80">
                Les formats <strong>Base64, Hex, Binaire et Octal</strong> peuvent décoder des fichiers complets :
                images (PNG, JPEG, GIF, WebP), documents (PDF), archives (ZIP, GZIP, 7Z), audio (MP3, WAV, OGG),
                et tout autre format binaire. Le type MIME est détecté automatiquement via les magic bytes.
              </p>
            </div>
          </div>
        )}

        {/* Zone principale */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne Entrée */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center text-xs">1</span>
                Entrée Encodée
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm bg-purple-600/50 hover:bg-purple-600 rounded-lg transition-colors border border-purple-500/30"
                >
                  📁 Fichier
                </button>
                <button
                  onClick={() => {
                    setInput('');
                    setResults([]);
                    setFileName('');
                    setDetectedEncodings([]);
                    blobUrls.forEach((url) => URL.revokeObjectURL(url));
                    setBlobUrls(new Map());
                  }}
                  className="px-3 py-1.5 text-sm bg-red-600/30 hover:bg-red-600/50 rounded-lg transition-colors border border-red-500/30"
                >
                  🗑️
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative rounded-xl border-2 transition-all ${
                isDragging
                  ? 'border-purple-400 bg-purple-500/10 scale-[1.01]'
                  : 'border-gray-600/50 bg-black/30 hover:border-gray-500/50'
              }`}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Collez votre texte/fichier encodé ici ou glissez-déposez un fichier...

Exemples texte :
  Base64    → SGVsbG8gV29ybGQh
  URL       → %48%65%6C%6C%6F
  Hex       → 48656C6C6F
  Morse     → .... . .-.. .-.. ---

Exemples fichiers (en Base64) :
  PNG       → iVBORw0KGgoAAAANSUhEUg...
  PDF       → JVBERi0xLjQKMSAwIG9i...
  ZIP       → UEsDBBQAAAAIAA...`}
                className="w-full h-56 p-4 bg-transparent text-green-300 font-mono text-sm resize-none focus:outline-none placeholder-gray-500"
                spellCheck={false}
              />
              <div className="absolute bottom-2 left-4 right-4 flex justify-between items-center">
                {fileName && (
                  <span className="text-xs text-purple-300 bg-purple-900/50 px-2 py-1 rounded">
                    📄 {fileName}
                  </span>
                )}
                {inputLength > 0 && (
                  <span className="text-xs text-gray-500 ml-auto">
                    {inputLength.toLocaleString()} caractères
                  </span>
                )}
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-3 bg-black/20 rounded-xl p-4 border border-gray-700/30">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300 font-medium min-w-[60px]">Format :</label>
                <select
                  value={selectedEncoding}
                  onChange={(e) => setSelectedEncoding(e.target.value)}
                  className="flex-1 bg-black/40 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {ENCODINGS.map((enc) => (
                    <option key={enc.value} value={enc.value} className="bg-gray-900">
                      {enc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-gray-400 pl-[72px]">
                {ENCODINGS.find((e) => e.value === selectedEncoding)?.desc}
              </div>

              {isManualOnly && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                  ⚠️ Ce format n'est pas détecté automatiquement (risque de faux positifs).
                </div>
              )}

              {selectedEncoding === 'César' && (
                <div className="flex items-center gap-3 pl-[72px]">
                  <label className="text-sm text-gray-300 font-medium">Décalage :</label>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={caesarShift}
                    onChange={(e) => setCaesarShift(Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-purple-300 font-mono w-8 text-center bg-purple-500/20 rounded px-1">
                    {caesarShift}
                  </span>
                </div>
              )}

              {detectedEncodings.length > 0 && selectedEncoding === 'auto' && (
                <div className="flex flex-wrap items-center gap-2 pl-[72px]">
                  <span className="text-xs text-gray-400">Détecté :</span>
                  {detectedEncodings.map((enc) => (
                    <span
                      key={enc}
                      className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    >
                      {enc}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={handleDecode}
                disabled={!input.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-purple-500/25"
              >
                🔓 Décoder
              </button>

              {/* Panneau de déchiffrement PDF */}
              {isPdfEncrypted && (
                <div className="mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3 animate-in">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔐</span>
                    <div>
                      <h3 className="text-sm font-semibold text-red-200">PDF Protégé Détecté</h3>
                      <p className="text-xs text-red-300/70">Ce fichier PDF est chiffré. Entrez le mot de passe pour le déchiffrer.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      placeholder="Mot de passe du PDF..."
                      className="flex-1 bg-black/40 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-400 transition-colors"
                      onKeyDown={(e) => e.key === 'Enter' && handleDecryptPDF()}
                    />
                    <button
                      onClick={handleDecryptPDF}
                      disabled={!pdfPassword || isDecrypting}
                      className="px-4 py-2 rounded-lg bg-red-600/50 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors border border-red-500/30 whitespace-nowrap"
                    >
                      {isDecrypting ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          ...
                        </span>
                      ) : (
                        '🔓 Déchiffrer'
                      )}
                    </button>
                  </div>
                  
                  {/* Résultat du déchiffrement */}
                  {pdfDecryptResult && (
                    <div className={`rounded-lg p-3 text-sm ${
                      pdfDecryptResult.success
                        ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}>
                      {pdfDecryptResult.success ? (
                        <div className="flex items-center gap-2">
                          <span>✅</span>
                          <span>PDF déchiffré avec succès ! {pdfDecryptResult.pageCount} page(s) • Protection retirée.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>❌</span>
                          <span>{pdfDecryptResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Colonne Résultat */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-green-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center text-xs">2</span>
                Résultat Décodé
                {results.length > 0 && (
                  <span className="text-xs text-gray-400 font-normal">
                    ({results.length} résultat{results.length > 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              {results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(results[0].decoded, 0)}
                    className="px-3 py-1.5 text-sm bg-green-600/30 hover:bg-green-600/50 rounded-lg transition-colors border border-green-500/30"
                  >
                    {copied === 0 ? '✅ Copié!' : '📋 Copier'}
                  </button>
                  <button
                    onClick={() => handleDownload(results[0], 0)}
                    className="px-3 py-1.5 text-sm bg-blue-600/30 hover:bg-blue-600/50 rounded-lg transition-colors border border-blue-500/30"
                  >
                    💾 Sauver
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-gray-600/50 bg-black/30 min-h-[14rem]">
              {results.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-gray-500">
                  <div className="text-center">
                    <div className="text-5xl mb-3 opacity-50">🔐</div>
                    <p className="text-sm">Le résultat décodé apparaîtra ici</p>
                    <p className="text-xs mt-1 text-gray-600">
                      Texte ou fichier binaire (image, PDF, ZIP...)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4 max-h-[40rem] overflow-y-auto custom-scrollbar">
                  {results.map((result, index) => (
                    <ResultCard
                      key={index}
                      result={result}
                      index={index}
                      copied={copied}
                      onCopy={handleCopy}
                      onDownload={handleDownload}
                      getBlobUrl={getBlobUrl}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Statistiques */}
            {results.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span className="bg-black/30 rounded-lg px-3 py-1.5 border border-gray-700/30">
                  ✅ {results.filter((r) => r.success).length} succès
                </span>
                <span className="bg-black/30 rounded-lg px-3 py-1.5 border border-gray-700/30">
                  ❌ {results.filter((r) => !r.success).length} échecs
                </span>
                {results[0]?.isBinary && (
                  <span className="bg-orange-500/10 rounded-lg px-3 py-1.5 border border-orange-500/30 text-orange-300">
                    📦 Binaire • {results[0].decodedBytes?.length.toLocaleString()} octets
                  </span>
                )}
                {results[0]?.mimeType && (
                  <span className="bg-blue-500/10 rounded-lg px-3 py-1.5 border border-blue-500/30 text-blue-300">
                    🏷️ {results[0].mimeType}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm border-t border-gray-700/50 pt-6 pb-8">
          <p className="font-medium text-gray-400">Décodeur Universel v4.0</p>
          <p className="mt-1 text-xs text-gray-600">
            Support UTF-8 • Fichiers binaires (PNG, PDF, ZIP, MP3...) • 13+ formats • Déchiffrement PDF par mot de passe
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {['Base64', 'URL', 'Hex', 'Binaire', 'Octal', 'ROT13', 'César', 'Morse', 'HTML', 'Unicode', 'ASCII', 'Atbash', 'Brainfuck'].map(
              (f) => (
                <span
                  key={f}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-500 border border-gray-700/30"
                >
                  {f}
                </span>
              )
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

// Composant pour afficher un résultat (texte ou binaire)
function ResultCard({
  result,
  index,
  copied,
  onCopy,
  onDownload,
  getBlobUrl,
}: {
  result: DecodeResult;
  index: number;
  copied: number | null;
  onCopy: (text: string, index: number) => void;
  onDownload: (result: DecodeResult, index: number) => void;
  getBlobUrl: (result: DecodeResult, index: number) => string | null;
}) {
  const isImage = result.isBinary && result.mimeType?.startsWith('image/');
  const isAudio = result.isBinary && result.mimeType?.startsWith('audio/');
  const isPdf = result.isBinary && result.mimeType === 'application/pdf';
  const isDecryptedPdf = result.encoding === 'PDF Déchiffré';
  const blobUrl = result.isBinary ? getBlobUrl(result, index) : null;

  return (
    <div
      className={`space-y-2 rounded-lg p-3 border transition-colors ${
        isDecryptedPdf
          ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
          : result.success
            ? result.isBinary
              ? 'bg-orange-500/5 border-orange-500/20'
              : 'bg-green-500/5 border-green-500/20'
            : 'bg-red-500/5 border-red-500/20'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              result.success
                ? result.isBinary
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                  : 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-red-500/20 text-red-300 border-red-500/30'
            }`}
          >
            {result.success ? '✓' : '✗'} {result.encoding}
          </span>
          {isDecryptedPdf && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              🔓 Déchiffré
            </span>
          )}
          {result.isBinary && result.mimeType && !isDecryptedPdf && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              📦 {result.mimeType}
            </span>
          )}
          {result.isBinary && result.decodedBytes && (
            <span className="text-xs text-gray-400">
              {result.decodedBytes.length.toLocaleString()} octets
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result.success && !result.isBinary && (
            <button
              onClick={() => onCopy(result.decoded, index)}
              className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              {copied === index ? '✅' : '📋 Copier'}
            </button>
          )}
          {result.success && (
            <button
              onClick={() => onDownload(result, index)}
              className={`text-xs transition-colors px-3 py-1.5 rounded-lg font-medium ${
                isDecryptedPdf
                  ? 'bg-emerald-600/50 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {isDecryptedPdf ? '💾 Télécharger PDF déchiffré' : `💾 Télécharger${result.isBinary ? ` .${getExtensionFromMime(result.mimeType || '')}` : ''}`}
            </button>
          )}
        </div>
      </div>

      {result.success ? (
        <>
          {/* Prévisualisation image */}
          {isImage && blobUrl && (
            <div className="rounded-lg overflow-hidden bg-black/40 border border-orange-500/10 p-2">
              <img
                src={blobUrl}
                alt="Image décodée"
                className="max-w-full max-h-64 mx-auto rounded"
              />
              <p className="text-xs text-center text-gray-400 mt-2">
                🖼️ Image {result.mimeType} •{' '}
                {result.decodedBytes?.length.toLocaleString()} octets
              </p>
            </div>
          )}

          {/* Prévisualisation audio */}
          {isAudio && blobUrl && (
            <div className="rounded-lg bg-black/40 border border-orange-500/10 p-3">
              <audio controls src={blobUrl} className="w-full" />
              <p className="text-xs text-center text-gray-400 mt-2">
                🎵 Audio {result.mimeType} •{' '}
                {result.decodedBytes?.length.toLocaleString()} octets
              </p>
            </div>
          )}

          {/* Prévisualisation PDF */}
          {isPdf && blobUrl && (
            <div className={`rounded-lg p-3 ${isDecryptedPdf ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-black/40 border border-orange-500/10'}`}>
              {isDecryptedPdf && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-sm">🔓</span>
                  <span className="text-xs font-medium text-emerald-300">PDF déchiffré — protection retirée</span>
                </div>
              )}
              <iframe
                src={blobUrl}
                className="w-full h-64 rounded bg-white"
                title={isDecryptedPdf ? "PDF déchiffré" : "PDF décodé"}
              />
              <p className="text-xs text-center text-gray-400 mt-2">
                📄 {isDecryptedPdf ? 'PDF déchiffré' : 'PDF'} • {result.decodedBytes?.length.toLocaleString()} octets
              </p>
            </div>
          )}

          {/* Contenu binaire non-image (ZIP, EXE, etc.) */}
          {result.isBinary && !isImage && !isAudio && !isPdf && (
            <div className="rounded-lg bg-black/40 border border-orange-500/10 p-3">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">📦</span>
                <div>
                  <p className="text-sm font-medium text-orange-200">Fichier binaire détecté</p>
                  <p className="text-xs text-gray-400">
                    Type : {result.mimeType} • Taille :{' '}
                    {result.decodedBytes?.length.toLocaleString()} octets
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Cliquez sur 💾 Télécharger pour récupérer le fichier avec la bonne extension.
              </p>
            </div>
          )}

          {/* Contenu texte */}
          {!result.isBinary && (
            <pre className="text-green-300 font-mono text-sm whitespace-pre-wrap break-all bg-black/40 rounded-lg p-3 border border-green-500/10 max-h-48 overflow-y-auto">
              {result.decoded}
            </pre>
          )}
        </>
      ) : (
        <p className="text-red-300 text-sm">⚠️ {result.error}</p>
      )}
    </div>
  );
}

function FormatInfo({
  icon,
  name,
  example,
  result,
  binary,
}: {
  icon: string;
  name: string;
  example: string;
  result: string;
  binary?: string;
}) {
  return (
    <div className="bg-black/30 rounded-lg p-2 border border-gray-700/30">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="font-medium text-purple-200 text-xs">{name}</span>
        {binary && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 ml-auto">
            {binary}
          </span>
        )}
      </div>
      <div className="text-[11px] space-y-0.5">
        <div className="text-gray-400">
          <code className="text-yellow-300/80">{example}</code>
        </div>
        <div className="text-gray-500">
          → <code className="text-green-300/80">{result}</code>
        </div>
      </div>
    </div>
  );
}

export default App;
