import { useState, useCallback, useRef } from 'react';
import { decode, autoDecode, detectEncoding, type DecodeResult } from './utils/decoders';

const ENCODINGS = [
  { value: 'auto', label: '🔍 Détection automatique', desc: 'Détecte le format automatiquement' },
  { value: 'Base64', label: '🔢 Base64', desc: 'SGVsbG8gV29ybGQ=' },
  { value: 'URL Encoding', label: '🌐 URL Encoding', desc: '%48%65%6C%6C%6F' },
  { value: 'Hexadecimal', label: '🔣 Hexadécimal', desc: '48656C6C6F' },
  { value: 'Binaire', label: '💻 Binaire', desc: '01001000 01100101' },
  { value: 'Octal', label: '🔢 Octal', desc: '110 145 154' },
  { value: 'ROT13', label: '🔄 ROT13', desc: 'Uryyb Jbeyq' },
  { value: 'César', label: '🔀 César', desc: 'Décalage configurable' },
  { value: 'Morse', label: '📡 Morse', desc: '.... . .-.. .-.. ---' },
  { value: 'HTML Entities', label: '🏷️ HTML Entities', desc: '&#72;&#101;&#108;' },
  { value: 'Unicode', label: '🅰️ Unicode Escape', desc: '\\u0048\\u0065' },
  { value: 'ASCII Décimal', label: '🔢 ASCII Décimal', desc: '72 101 108' },
  { value: 'Atbash', label: '🔁 Atbash', desc: 'Svool Wliow' },
  { value: 'Brainfuck', label: '🧠 Brainfuck', desc: '++++++++[>...]' },
];

// Formats qui ne sont PAS détectés automatiquement (risque de faux positifs)
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDecode = useCallback(() => {
    if (!input.trim()) {
      setResults([]);
      setDetectedEncodings([]);
      return;
    }

    const detected = detectEncoding(input);
    setDetectedEncodings(detected);

    if (selectedEncoding === 'auto') {
      const autoResults = autoDecode(input);
      setResults(autoResults);
    } else {
      const result = decode(input, selectedEncoding);
      if (selectedEncoding === 'César') {
        // Pour César, essayer tous les décalages
        const allCaesar: DecodeResult[] = [];
        for (let shift = 1; shift <= 25; shift++) {
          const r = decode(input, 'César');
          if (r.success && shift === caesarShift) {
            allCaesar.push({ ...r, encoding: `César (décalage ${shift})` });
          }
        }
        setResults(allCaesar.length > 0 ? allCaesar : [{ ...result, error: result.error || 'Échec du décodage' }]);
      } else {
        setResults(result.success ? [result] : [{ ...result, error: result.error || 'Échec du décodage' }]);
      }
    }
  }, [input, selectedEncoding, caesarShift]);

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

  const handleDownload = useCallback((text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_${fileName || 'output'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fileName]);

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
              <p className="text-xs text-gray-400">13+ formats • UTF-8 • Détection auto</p>
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
              <FormatInfo icon="🔢" name="Base64" example="SGVsbG8=" result="Hello" />
              <FormatInfo icon="🌐" name="URL Encoding" example="%48%65%6C" result="Hel" />
              <FormatInfo icon="🔣" name="Hexadécimal" example="48656C6C6F" result="Hello" />
              <FormatInfo icon="💻" name="Binaire" example="01001000 01100101" result="He" />
              <FormatInfo icon="🔢" name="Octal" example="110 145 154" result="Hel" />
              <FormatInfo icon="🔄" name="ROT13" example="Uryyb" result="Hello" />
              <FormatInfo icon="🔀" name="César" example="Khoor" result="Hello (shift 3)" />
              <FormatInfo icon="📡" name="Morse" example=".... . .-.. .-.. ---" result="HELLO" />
              <FormatInfo icon="🏷️" name="HTML Entities" example="&#72;&#101;" result="He" />
              <FormatInfo icon="🅰️" name="Unicode" example="\\u0048\\u0065" result="He" />
              <FormatInfo icon="🔢" name="ASCII Décimal" example="72 101 108" result="Hel" />
              <FormatInfo icon="🔁" name="Atbash" example="Svool" result="Hello" />
              <FormatInfo icon="🧠" name="Brainfuck" example="++++++++[>...]" result="(sortie)" />
            </div>
            <div className="mt-3 text-xs text-gray-400">
              💡 <strong>UTF-8</strong> : Tous les décodeurs supportent les caractères Unicode (émojis, accents, CJK...)
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
                  onClick={() => { setInput(''); setResults([]); setFileName(''); setDetectedEncodings([]); }}
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
                placeholder={`Collez votre texte encodé ici ou glissez-déposez un fichier...

Exemples :
  Base64    → SGVsbG8gV29ybGQh
  URL       → %48%65%6C%6C%6F
  Hex       → 48656C6C6F
  Binaire   → 01001000 01100101
  Morse     → .... . .-.. .-.. ---
  HTML      → &#72;&#101;&#108;&#108;&#111;
  Unicode   → \\u0048\\u0065\\u006C\\u006C\\u006F`}
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

              {/* Description du format sélectionné */}
              <div className="text-xs text-gray-400 pl-[72px]">
                {ENCODINGS.find(e => e.value === selectedEncoding)?.desc}
              </div>

              {/* Avertissement pour les formats manuels */}
              {isManualOnly && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                  ⚠️ Ce format n'est pas détecté automatiquement (risque de faux positifs). Sélection manuelle requise.
                </div>
              )}

              {/* Slider César */}
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

              {/* Encodages détectés */}
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
                    onClick={() => handleDownload(results[0].decoded)}
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
                    <p className="text-xs mt-1 text-gray-600">Entrez du texte encodé et cliquez sur Décoder</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4 max-h-[32rem] overflow-y-auto custom-scrollbar">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`space-y-2 rounded-lg p-3 border transition-colors ${
                        result.success
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            result.success
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {result.success ? '✓' : '✗'} {result.encoding}
                          </span>
                        </div>
                        {result.success && (
                          <button
                            onClick={() => handleCopy(result.decoded, index)}
                            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
                          >
                            {copied === index ? '✅' : '📋 Copier'}
                          </button>
                        )}
                      </div>
                      {result.success ? (
                        <pre className="text-green-300 font-mono text-sm whitespace-pre-wrap break-all bg-black/40 rounded-lg p-3 border border-green-500/10 max-h-48 overflow-y-auto">
                          {result.decoded}
                        </pre>
                      ) : (
                        <p className="text-red-300 text-sm">
                          ⚠️ {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statistiques */}
            {results.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span className="bg-black/30 rounded-lg px-3 py-1.5 border border-gray-700/30">
                  ✅ {results.filter(r => r.success).length} succès
                </span>
                <span className="bg-black/30 rounded-lg px-3 py-1.5 border border-gray-700/30">
                  ❌ {results.filter(r => !r.success).length} échecs
                </span>
                <span className="bg-black/30 rounded-lg px-3 py-1.5 border border-gray-700/30">
                  📏 {results[0]?.decoded.length.toLocaleString() ?? 0} caractères
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm border-t border-gray-700/50 pt-6 pb-8">
          <p className="font-medium text-gray-400">Décodeur Universel v2.0</p>
          <p className="mt-1 text-xs text-gray-600">
            Support UTF-8 complet • 13+ formats • Détection automatique • Compatible fichiers
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {['Base64', 'URL', 'Hex', 'Binaire', 'Octal', 'ROT13', 'César', 'Morse', 'HTML', 'Unicode', 'ASCII', 'Atbash', 'Brainfuck'].map(f => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-500 border border-gray-700/30">
                {f}
              </span>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}

function FormatInfo({ icon, name, example, result }: { icon: string; name: string; example: string; result: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-2 border border-gray-700/30">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="font-medium text-purple-200 text-xs">{name}</span>
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
