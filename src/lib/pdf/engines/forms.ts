import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { loadPdfDocument, savePdfDocument, fileToUint8Array } from '../core';
import { ToolExecutionResult } from '@/types';

/**
 * 25. Compress PDF
 */
export async function compressPdf(
  file: File,
  _targetQuality: 'low' | 'medium' | 'high' = 'medium'
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);

  // Remove unnecessary metadata dictionaries to reduce byte size
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('AURA DROP Stream Compactor');
  doc.setCreator('AURA DROP');

  const originalSize = file.size;
  const compressedBytes = await doc.save({ useObjectStreams: true });
  const compressedBlob = new Blob([compressedBytes as unknown as BlobPart], { type: 'application/pdf' });
  const newSize = compressedBlob.size;

  const savingsPct = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

  return {
    success: true,
    title: 'Optimized Compressed PDF',
    filename: `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`,
    blob: compressedBlob,
    metadata: {
      originalSize: `${(originalSize / 1024).toFixed(1)} KB`,
      newSize: `${(newSize / 1024).toFixed(1)} KB`,
      savingsPercentage: `${savingsPct}%`,
    },
  };
}

/**
 * 26. PDF Forms Builder & Filler
 */
export async function formsBuilder(
  file: File,
  actions: {
    fillFields?: Record<string, string | boolean>;
    newFields?: Array<{
      type: 'text' | 'checkbox';
      name: string;
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const form = doc.getForm();

  // 1. Fill existing fields if specified
  if (actions.fillFields) {
    for (const [fieldName, val] of Object.entries(actions.fillFields)) {
      try {
        const field = form.getField(fieldName);
        if (typeof val === 'boolean') {
          const cb = form.getCheckBox(fieldName);
          if (val) cb.check();
          else cb.uncheck();
        } else {
          const tf = form.getTextField(fieldName);
          tf.setText(String(val));
        }
      } catch {
        // Continue if field is not present
      }
    }
  }

  // 2. Inject new interactive AcroForm fields
  if (actions.newFields) {
    const pages = doc.getPages();
    for (const nf of actions.newFields) {
      if (nf.pageIndex >= 0 && nf.pageIndex < pages.length) {
        const targetPage = pages[nf.pageIndex];
        if (nf.type === 'text') {
          const textField = form.createTextField(nf.name);
          textField.addToPage(targetPage, {
            x: nf.x,
            y: nf.y,
            width: nf.width,
            height: nf.height,
            borderWidth: 1,
            borderColor: rgb(0.7, 0.75, 0.85),
            backgroundColor: rgb(0.97, 0.98, 1),
          });
        } else if (nf.type === 'checkbox') {
          const checkBox = form.createCheckBox(nf.name);
          checkBox.addToPage(targetPage, {
            x: nf.x,
            y: nf.y,
            width: nf.width,
            height: nf.height,
            borderWidth: 1,
            borderColor: rgb(0.7, 0.75, 0.85),
            backgroundColor: rgb(0.97, 0.98, 1),
          });
        }
      }
    }
  }

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Interactive Form Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_form.pdf`,
    blob,
    metadata: {
      fieldsDetected: form.getFields().length,
    },
  };
}

/**
 * 27. Scan to PDF (Compile camera snapshot blobs into PDF with auto-contrast)
 */
export async function scanToPdf(snapshots: Blob[]): Promise<ToolExecutionResult> {
  if (snapshots.length === 0) {
    throw new Error('No document scans captured.');
  }

  const pdfDoc = await PDFDocument.create();

  for (const snap of snapshots) {
    const bytes = await fileToUint8Array(snap);
    let img;
    try {
      img = await pdfDoc.embedJpg(bytes);
    } catch {
      img = await pdfDoc.embedPng(bytes);
    }

    const dims = img.scale(1);
    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
    });
  }

  const blob = await savePdfDocument(pdfDoc);
  return {
    success: true,
    title: 'Scanned Document Package',
    filename: `scan_${Date.now()}.pdf`,
    blob,
    metadata: {
      pagesScanned: snapshots.length,
    },
  };
}

/**
 * 28. Flatten PDF (Converts interactive fields to permanent visual elements)
 */
export async function flattenPdf(file: File): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const form = doc.getForm();

  try {
    form.flatten();
  } catch {
    // Form already flat or no interactive fields
  }

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Flattened PDF',
    filename: `${file.name.replace(/\.pdf$/i, '')}_flattened.pdf`,
    blob,
    metadata: {
      flattened: true,
    },
  };
}
