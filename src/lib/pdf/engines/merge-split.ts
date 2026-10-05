import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { loadPdfDocument, savePdfDocument } from '../core';
import { ToolExecutionResult } from '@/types';

/**
 * 1. Merge Multiple PDFs
 */
export async function mergePdf(files: File[]): Promise<ToolExecutionResult> {
  if (files.length < 2) {
    throw new Error('Please provide at least 2 PDF files to merge.');
  }

  const mergedDoc = await PDFDocument.create();

  for (const file of files) {
    const srcDoc = await loadPdfDocument(file);
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach(page => mergedDoc.addPage(page));
  }

  const blob = await savePdfDocument(mergedDoc);
  return {
    success: true,
    title: 'Merged Document',
    filename: `aura_merged_${Date.now()}.pdf`,
    blob,
    metadata: {
      totalPages: mergedDoc.getPageCount(),
      sourceFiles: files.map(f => f.name),
    },
  };
}

/**
 * 2. Split PDF by Ranges (e.g., "1-3, 5, 8-10") or Burst
 */
export async function splitPdf(file: File, rangeStr: string, mode: 'range' | 'burst' = 'range'): Promise<ToolExecutionResult> {
  const srcDoc = await loadPdfDocument(file);
  const totalPages = srcDoc.getPageCount();

  if (mode === 'burst') {
    // Return page count and first page as primary preview, note burst behavior
    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(srcDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const blob = await savePdfDocument(firstPageDoc);

    return {
      success: true,
      title: 'Split Burst Sequence',
      filename: `${file.name.replace(/\.pdf$/i, '')}_page_1.pdf`,
      blob,
      metadata: {
        totalBurstPages: totalPages,
        mode: 'burst',
      },
    };
  }

  // Parse ranges: "1-3, 5, 7-9" (1-based from user)
  const targetIndices = new Set<number>();
  const parts = rangeStr.split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          targetIndices.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        targetIndices.add(pageNum - 1);
      }
    }
  }

  const sortedIndices = Array.from(targetIndices).sort((a, b) => a - b);
  if (sortedIndices.length === 0) {
    throw new Error(`Invalid page range. Document has ${totalPages} pages.`);
  }

  const splitDoc = await PDFDocument.create();
  const copiedPages = await splitDoc.copyPages(srcDoc, sortedIndices);
  copiedPages.forEach(p => splitDoc.addPage(p));

  const blob = await savePdfDocument(splitDoc);
  return {
    success: true,
    title: 'Extracted Pages',
    filename: `${file.name.replace(/\.pdf$/i, '')}_extracted.pdf`,
    blob,
    metadata: {
      extractedPagesCount: sortedIndices.length,
      pageIndices: sortedIndices.map(i => i + 1),
    },
  };
}

/**
 * 3. Organize PDF (Reorder, Rotate, Delete)
 */
export async function organizePdf(
  file: File,
  pageOrder: number[], // 0-based
  rotations: Record<number, number> = {} // pageIndex -> degrees (0, 90, 180, 270)
): Promise<ToolExecutionResult> {
  const srcDoc = await loadPdfDocument(file);
  const organizedDoc = await PDFDocument.create();

  const validIndices = pageOrder.filter(idx => idx >= 0 && idx < srcDoc.getPageCount());
  const copiedPages = await organizedDoc.copyPages(srcDoc, validIndices);

  copiedPages.forEach((page, i) => {
    const originalIndex = validIndices[i];
    if (rotations[originalIndex]) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotations[originalIndex]) % 360));
    }
    organizedDoc.addPage(page);
  });

  const blob = await savePdfDocument(organizedDoc);
  return {
    success: true,
    title: 'Organized Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_organized.pdf`,
    blob,
    metadata: {
      pageCount: validIndices.length,
    },
  };
}

/**
 * 4. Batch Rotate PDF
 */
export async function rotatePdf(
  file: File,
  angle: 90 | 180 | 270,
  pageIndices?: number[]
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const pages = doc.getPages();

  pages.forEach((page, idx) => {
    if (!pageIndices || pageIndices.includes(idx)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
  });

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Rotated Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_rotated_${angle}deg.pdf`,
    blob,
    metadata: {
      rotatedAngle: angle,
      pageCount: pages.length,
    },
  };
}

/**
 * 5. Crop PDF Margins
 */
export async function cropPdf(
  file: File,
  cropPercentages: { top: number; right: number; bottom: number; left: number }
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const pages = doc.getPages();

  pages.forEach(page => {
    const { width, height } = page.getSize();
    const trimLeft = (cropPercentages.left / 100) * width;
    const trimRight = (cropPercentages.right / 100) * width;
    const trimBottom = (cropPercentages.bottom / 100) * height;
    const trimTop = (cropPercentages.top / 100) * height;

    const newX = trimLeft;
    const newY = trimBottom;
    const newWidth = Math.max(10, width - trimLeft - trimRight);
    const newHeight = Math.max(10, height - trimBottom - trimTop);

    page.setCropBox(newX, newY, newWidth, newHeight);
  });

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Cropped Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_cropped.pdf`,
    blob,
    metadata: {
      cropApplied: cropPercentages,
    },
  };
}

/**
 * 6. Add Page Numbers
 */
export async function addPageNumbers(
  file: File,
  options: {
    format?: string; // 'Page {n} of {total}' or '{n}'
    position?: 'bottom-center' | 'bottom-right' | 'top-center' | 'top-right';
    startNumber?: number;
  } = {}
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const startNum = options.startNumber || 1;
  const format = options.format || 'Page {n} of {total}';
  const position = options.position || 'bottom-center';

  pages.forEach((page, idx) => {
    const currentNum = startNum + idx;
    const text = format.replace('{n}', currentNum.toString()).replace('{total}', total.toString());
    const textSize = 9;
    const textWidth = font.widthOfTextAtSize(text, textSize);
    const { width, height } = page.getSize();

    let x = (width - textWidth) / 2;
    let y = 24;

    if (position === 'bottom-right') {
      x = width - textWidth - 36;
      y = 24;
    } else if (position === 'top-center') {
      x = (width - textWidth) / 2;
      y = height - 32;
    } else if (position === 'top-right') {
      x = width - textWidth - 36;
      y = height - 32;
    }

    page.drawText(text, {
      x,
      y,
      size: textSize,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
  });

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Numbered Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf`,
    blob,
    metadata: {
      pagesNumbered: total,
      format,
    },
  };
}

/**
 * 7. Stamp Watermark
 */
export async function watermarkPdf(
  file: File,
  options: {
    text: string;
    opacity?: number;
    size?: number;
    angle?: number;
    color?: 'gray' | 'red' | 'indigo' | 'cyan';
  }
): Promise<ToolExecutionResult> {
  const doc = await loadPdfDocument(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const watermarkText = options.text.trim() || 'CONFIDENTIAL';
  const opacity = options.opacity !== undefined ? options.opacity : 0.22;
  const fontSize = options.size || 48;
  const angle = options.angle !== undefined ? options.angle : 45;

  let textColor = rgb(0.4, 0.45, 0.55);
  if (options.color === 'red') textColor = rgb(0.9, 0.2, 0.2);
  if (options.color === 'indigo') textColor = rgb(0.39, 0.4, 0.95);
  if (options.color === 'cyan') textColor = rgb(0.02, 0.71, 0.83);

  pages.forEach(page => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    page.drawText(watermarkText, {
      x: (width - textWidth) / 2 + 30,
      y: (height - textHeight) / 2 - 30,
      size: fontSize,
      font,
      color: textColor,
      opacity,
      rotate: degrees(angle),
    });
  });

  const blob = await savePdfDocument(doc);
  return {
    success: true,
    title: 'Watermarked Document',
    filename: `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`,
    blob,
    metadata: {
      watermarkText,
      pageCount: pages.length,
    },
  };
}
