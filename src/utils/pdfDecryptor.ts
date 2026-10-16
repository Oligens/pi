// Déchiffrement de PDF protégés par mot de passe
// Utilise pdfjs-dist (Mozilla) pour la lecture + pdf-lib pour la réécriture

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Configuration du worker PDF.js - utilise le CDN pour la compatibilité navigateur
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFDecryptResult {
  success: boolean;
  decryptedBytes?: Uint8Array;
  pageCount?: number;
  error?: string;
  passwordCorrect?: boolean;
}

/**
 * Tente de déchiffrer un PDF protégé par mot de passe.
 * 
 * Stratégie :
 * 1. Ouvre le PDF avec pdfjs-dist en fournissant le mot de passe
 * 2. Si le mot de passe est correct, rend chaque page en image via Canvas
 * 3. Réassemble les images dans un nouveau PDF non protégé via pdf-lib
 * 4. Retourne les bytes du PDF déchiffré
 */
export async function decryptPDF(
  pdfBytes: Uint8Array,
  password: string
): Promise<PDFDecryptResult> {
  try {
    // Étape 1 : Charger le document PDF avec le mot de passe
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes as unknown as ArrayBuffer,
      password: password,
    });

    let pdfDocument;
    try {
      pdfDocument = await loadingTask.promise;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'PasswordException') {
        return {
          success: false,
          error: 'Mot de passe incorrect',
          passwordCorrect: false,
        };
      }
      if (error.name === 'InvalidPDFException') {
        return {
          success: false,
          error: 'Fichier PDF invalide ou corrompu',
        };
      }
      return {
        success: false,
        error: `Erreur PDF : ${error.message || 'Inconnue'}`,
      };
    }

    const pageCount = pdfDocument.numPages;

    // Étape 2 : Rendre chaque page en image PNG via Canvas
    const pageImages: Uint8Array[] = [];
    const RENDER_SCALE = 2;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDocument.getPage(i);
      
      // Utiliser un scale de 2 pour une bonne qualité
      const scale = RENDER_SCALE;
      const viewport = page.getViewport({ scale });

      // Créer un canvas offscreen
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      
      if (!context) {
        return {
          success: false,
          error: 'Impossible de créer le contexte canvas',
        };
      }

      // Rendre la page dans le canvas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderContext: any = {
        canvasContext: context,
        viewport: viewport,
      };
      
      const renderTask = page.render(renderContext);
      await renderTask.promise;

      // Convertir le canvas en PNG
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
          'image/png'
        );
      });

      const pngBytes = new Uint8Array(await blob.arrayBuffer());
      pageImages.push(pngBytes);
      
      // Nettoyer la page
      page.cleanup();
    }

    // Étape 3 : Créer un nouveau PDF non protégé avec pdf-lib
    const newPdf = await PDFDocument.create();

    for (const pngBytes of pageImages) {
      const image = await newPdf.embedPng(pngBytes);
      // Dimensions réelles (RENDER_SCALE=2, donc on divise par 2)
      const pageWidth = image.width / RENDER_SCALE;
      const pageHeight = image.height / RENDER_SCALE;
      const page = newPdf.addPage([pageWidth, pageHeight]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    // Sérialiser le nouveau PDF sans protection
    const decryptedBytes = await newPdf.save();

    return {
      success: true,
      decryptedBytes,
      pageCount,
      passwordCorrect: true,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      success: false,
      error: `Erreur lors du déchiffrement : ${error.message || 'Inconnue'}`,
    };
  }
}

/**
 * Vérifie rapidement si un PDF est protégé par un mot de passe.
 */
export async function isPDFEncrypted(pdfBytes: Uint8Array): Promise<boolean> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes as unknown as ArrayBuffer,
      password: '',
    });
    
    await loadingTask.promise;
    return false;
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === 'PasswordException') {
      return true;
    }
    return false;
  }
}
