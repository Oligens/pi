import { useState, useCallback, useRef } from 'react';
import { decode, autoDecode, detectEncoding, type DecodeResult } from './utils/decoders';

const ENCODINGS = [
  'auto',
  'Base64',
  'URL Encoding',
  'Hexadecimal',
  'Binaire',
  'Octal',
  'ROT13',
  'César',
  'Morse',
  'HTML Entities',
  'Unicode',
  'ASCII Décimal',
  'Atbash',
  'Brainfuck',
];

function App() {
  const [input, setInput] = useState('');
  const [selectedEncoding, setSelectedEncoding] = useState('auto');
  const [results, setResults] = useState<DecodeResult[]>([]);
  const [detectedEncodings, setDetectedEncodings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [caesarShift, setCaesarShift] = useState(3);
  const [copied, setCopied] = useState(false);
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
      setResults(result.success ? [result] : [{ ...result, error: result.error || 'Échec du décodage' }]);
    }
  }, [input, selectedEncoding]);

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

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownload = useCallback((text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_${fileName || 'output'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fileName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-purple-500/30 backdrop-blur-sm bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
            🔓
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Décodeur Universel
            </h1>
            <p className="text-xs text-gray-400">Décodez n'importe quel fichier encodé</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Zone d'entrée */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-200">📥 Entrée Encodée</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm bg-purple-600/50 hover:bg-purple-600 rounded-lg transition-colors border border-purple-500/30"
                >
                  📁 Charger fichier
                </button>
                <button
                  onClick={() => { setInput(''); setResults([]); setFileName(''); }}
                  className="px-3 py-1.5 text-sm bg-red-600/30 hover:bg-red-600/50 rounded-lg transition-colors border border-red-500/30"
                >
                  🗑️ Effacer
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
                  ? 'border-purple-400 bg-purple-500/10'
                  : 'border-gray-600/50 bg-black/30'
              }`}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Collez votre texte encodé ici ou glissez-déposez un fichier...&#10;&#10;Formats supportés :&#10;• Base64 (SGVsbG8gV29ybGQ=)&#10;• URL Encoding (%48%65%6C%6C%6F)&#10;• Hexadécimal (48656C6C6F)&#10;• Binaire (01001000 01100101)&#10;• Code Morse (.... . .-.. .-.. ---)&#10;• HTML Entities (&#60;p&#62;)&#10;• Unicode (\u0048\u0065)&#10;• ASCII Décimal (72 101 108)&#10;• ROT13, César, Atbash&#10;• Brainfuck&#10;• Et plus encore..."
                className="w-full h-64 p-4 bg-transparent text-green-300 font-mono text-sm resize-none focus:outline-none placeholder-gray-500"
              />
              {fileName && (
                <div className="absolute bottom-2 left-4 text-xs text-purple-300 bg-purple-900/50 px-2 py-1 rounded">
                  📄 {fileName}
                </div>
              )}
            </div>

            {/* Sélection de l'encodage */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300 font-medium">Format :</label>
                <select
                  value={selectedEncoding}
                  onChange={(e) => setSelectedEncoding(e.target.value)}
                  className="flex-1 bg-black/40 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {ENCODINGS.map((enc) => (
                    <option key={enc} value={enc} className="bg-gray-900">
                      {enc === 'auto' ? '🔍 Détection automatique' : enc}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEncoding === 'César' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-300 font-medium">Décalage :</label>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={caesarShift}
                    onChange={(e) => setCaesarShift(Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-purple-300 font-mono w-8">{caesarShift}</span>
                </div>
              )}

              {/* Encodages détectés */}
              {detectedEncodings.length > 0 && selectedEncoding === 'auto' && (
                <div className="flex flex-wrap gap-2">
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
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/25"
              >
                🔓 Décoder
              </button>
            </div>
          </div>

          {/* Zone de résultat */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-green-200">📤 Résultat Décodé</h2>
              {results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(results[0].decoded)}
                    className="px-3 py-1.5 text-sm bg-green-600/30 hover:bg-green-600/50 rounded-lg transition-colors border border-green-500/30"
                  >
                    {copied ? '✅ Copié!' : '📋 Copier'}
                  </button>
                  <button
                    onClick={() => handleDownload(results[0].decoded)}
                    className="px-3 py-1.5 text-sm bg-blue-600/30 hover:bg-blue-600/50 rounded-lg transition-colors border border-blue-500/30"
                  >
                    💾 Télécharger
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-gray-600/50 bg-black/30 min-h-[16rem]">
              {results.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🔐</div>
                    <p className="text-sm">Le résultat apparaîtra ici</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4 max-h-[32rem] overflow-y-auto">
                  {results.map((result, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                          {result.encoding}
                        </span>
                        <button
                          onClick={() => handleCopy(result.decoded)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          📋
                        </button>
                      </div>
                      <pre className="text-green-300 font-mono text-sm whitespace-pre-wrap break-all bg-black/40 rounded-lg p-3 border border-green-500/10">
                        {result.decoded}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Erreurs */}
            {results.some(r => r.error) && (
              <div className="space-y-2">
                {results.filter(r => r.error).map((result, index) => (
                  <div key={index} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    ⚠️ {result.encoding}: {result.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section d'aide */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard
            icon="🔢"
            title="Base64"
            example="SGVsbG8gV29ybGQ="
            decoded="Hello World"
          />
          <InfoCard
            icon="🌐"
            title="URL Encoding"
            example="%48%65%6C%6C%6F"
            decoded="Hello"
          />
          <InfoCard
            icon="🔣"
            title="Hexadécimal"
            example="48656C6C6F"
            decoded="Hello"
          />
          <InfoCard
            icon="📡"
            title="Morse"
            example=".... . .-.. .-.. ---"
            decoded="HELLO"
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm border-t border-gray-700/50 pt-6">
          <p>Décodeur Universel — Supporte 13+ formats d'encodage</p>
          <p className="mt-1 text-xs text-gray-600">
            Base64 • URL • Hex • Binaire • Octal • ROT13 • César • Morse • HTML • Unicode • ASCII • Atbash • Brainfuck
          </p>
        </footer>
      </main>
    </div>
  );
}

function InfoCard({ icon, title, example, decoded }: { icon: string; title: string; example: string; decoded: string }) {
  return (
    <div className="rounded-xl bg-black/30 border border-gray-700/50 p-4 hover:border-purple-500/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-purple-200">{title}</h3>
      </div>
      <div className="text-xs space-y-1">
        <div className="text-gray-400">
          <span className="text-gray-500">Encodé:</span>{' '}
          <code className="text-yellow-300">{example}</code>
        </div>
        <div className="text-gray-400">
          <span className="text-gray-500">Décode:</span>{' '}
          <code className="text-green-300">{decoded}</code>
        </div>
      </div>
    </div>
  );
}

export default App;
