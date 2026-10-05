import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { StudioToolDefinition, ToolCategory, ToolId } from '@/types';

export async function fileToUint8Array(file: File | Blob): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function loadPdfDocument(source: File | Blob | Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  let bytes: Uint8Array;
  if (source instanceof Uint8Array) {
    bytes = source;
  } else if (source instanceof ArrayBuffer) {
    bytes = new Uint8Array(source);
  } else {
    bytes = await fileToUint8Array(source);
  }
  return await PDFDocument.load(bytes, { ignoreEncryption: true });
}

export async function savePdfDocument(doc: PDFDocument): Promise<Blob> {
  const pdfBytes = await doc.save();
  // Copy to clean ArrayBuffer to prevent detached buffer issues
  const copy = new Uint8Array(pdfBytes.length);
  copy.set(pdfBytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 32 Comprehensive Client-Side PDF & Document Tools Registry
 */
export const STUDIO_TOOLS: StudioToolDefinition[] = [
  // --- A. Core Manipulation (7) ---
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into a single unified document with custom ordering.',
    category: 'core',
    inputType: 'multiple-pdf',
    outputFormat: 'PDF',
    badge: 'Popular',
    iconName: 'Combine',
    tags: ['combine', 'join', 'bundle', 'merge'],
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Extract specific page ranges (e.g. 1-3, 5, 8-10) or burst all pages into individual files.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF / ZIP',
    badge: 'Fast',
    iconName: 'Scissors',
    tags: ['extract', 'separate', 'burst', 'range'],
  },
  {
    id: 'organize-pdf',
    title: 'Organize PDF',
    description: 'Visual thumbnail reordering, page deletion, individual rotation, and duplication.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Layers',
    tags: ['reorder', 'sort', 'delete', 'arrange'],
  },
  {
    id: 'rotate-pdf',
    title: 'Rotate PDF',
    description: 'Batch rotate pages 90°, 180°, or 270° clockwise across the entire document or selected ranges.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'RotateCw',
    tags: ['orientation', 'turn', 'flip', 'angle'],
  },
  {
    id: 'crop-pdf',
    title: 'Crop PDF',
    description: 'Trim visual margins, change bleed zones, and redefine MediaBox dimensions.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Crop',
    tags: ['margins', 'trim', 'cut', 'mediabox'],
  },
  {
    id: 'page-numbers',
    title: 'Page Numbers',
    description: 'Stamp professional header/footer page numbers with custom placement, typography, and format.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Hash',
    tags: ['pagination', 'footer', 'header', 'numbering'],
  },
  {
    id: 'watermark-pdf',
    title: 'Watermark PDF',
    description: 'Stamp customized text or image watermarks with angle, opacity, scale, and layer depth.',
    category: 'core',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'Security',
    iconName: 'Stamp',
    tags: ['stamp', 'confidential', 'branding', 'draft'],
  },

  // --- B. Image & Document Conversions (10) ---
  {
    id: 'jpg-to-pdf',
    title: 'JPG / Image to PDF',
    description: 'Convert JPG, PNG, WebP images into a styled PDF with custom page orientation and margin fit.',
    category: 'convert',
    inputType: 'images',
    outputFormat: 'PDF',
    badge: 'High Res',
    iconName: 'Image',
    tags: ['png', 'jpg', 'photos', 'compile'],
  },
  {
    id: 'pdf-to-jpg',
    title: 'PDF to JPG / PNG',
    description: 'Render every PDF page into high-definition image formats for web sharing or printing.',
    category: 'convert',
    inputType: 'pdf',
    outputFormat: 'PNG / ZIP',
    iconName: 'FileImage',
    tags: ['extract', 'render', 'rasterize', 'export'],
  },
  {
    id: 'pdf-to-markdown',
    title: 'PDF to Markdown',
    description: 'Extract document structure, headings, lists, and tables into clean LLM-ready markdown.',
    category: 'convert',
    inputType: 'pdf',
    outputFormat: 'MD',
    badge: 'AI-Ready',
    iconName: 'FileCode',
    tags: ['markdown', 'llm', 'text', 'parse'],
  },
  {
    id: 'html-to-pdf',
    title: 'HTML to PDF',
    description: 'Ingest raw HTML strings or web stylesheets and render vector-formatted PDF documents.',
    category: 'convert',
    inputType: 'any',
    outputFormat: 'PDF',
    iconName: 'Globe',
    tags: ['web', 'markup', 'code', 'css'],
  },
  {
    id: 'pdf-to-word',
    title: 'PDF to Word (DOCX)',
    description: 'Convert PDF text blocks and paragraph layouts into an editable Microsoft Word .docx file.',
    category: 'convert',
    inputType: 'pdf',
    outputFormat: 'DOCX',
    badge: 'Editable',
    iconName: 'FileText',
    tags: ['word', 'docx', 'office', 'editable'],
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert Microsoft Word (.docx) or rich-text manuscripts into polished, ready-to-share PDF files.',
    category: 'convert',
    inputType: 'office',
    outputFormat: 'PDF',
    iconName: 'FileType',
    tags: ['docx', 'convert', 'office', 'publish'],
  },
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel (XLSX)',
    description: 'Detect tabular grids and spatial cell coordinates, generating structured .xlsx workbooks.',
    category: 'convert',
    inputType: 'pdf',
    outputFormat: 'XLSX',
    iconName: 'Table',
    tags: ['sheets', 'tables', 'data', 'spreadsheet'],
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    description: 'Render spreadsheet tables (.xlsx, .csv) into cleanly paginated and bordered PDF sheets.',
    category: 'convert',
    inputType: 'office',
    outputFormat: 'PDF',
    iconName: 'Sheet',
    tags: ['spreadsheet', 'csv', 'tables', 'print'],
  },
  {
    id: 'pdf-to-pptx',
    title: 'PDF to PowerPoint',
    description: 'Map PDF pages and graphics into editable Microsoft PowerPoint presentation slides (.pptx).',
    category: 'convert',
    inputType: 'pdf',
    outputFormat: 'PPTX',
    iconName: 'Presentation',
    tags: ['slides', 'pptx', 'keynote', 'deck'],
  },
  {
    id: 'pptx-to-pdf',
    title: 'PowerPoint to PDF',
    description: 'Transform presentation decks (.pptx) into pristine, vector-rendered slide documents.',
    category: 'convert',
    inputType: 'office',
    outputFormat: 'PDF',
    iconName: 'FileSliders',
    tags: ['presentation', 'export', 'slides', 'pdf'],
  },

  // --- C. Security & Forensic Tools (7) ---
  {
    id: 'protect-pdf',
    title: 'Protect PDF',
    description: 'Apply client-side standard encryption with AES-256 and custom user access passwords.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'AES-256',
    iconName: 'Lock',
    tags: ['encrypt', 'password', 'secure', 'restrict'],
  },
  {
    id: 'unlock-pdf',
    title: 'Unlock PDF',
    description: 'Remove password protection from encrypted PDFs completely in-browser without server transmission.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Unlock',
    tags: ['decrypt', 'remove-password', 'open'],
  },
  {
    id: 'redact-pdf',
    title: 'Redact PDF (Forensic)',
    description: 'True cryptographic sanitization—permanently purges coordinate text and raster data from bytes.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'Forensic',
    iconName: 'EyeOff',
    tags: ['sanitize', 'censor', 'blackout', 'privacy'],
  },
  {
    id: 'sign-pdf',
    title: 'Sign PDF',
    description: 'Interactive digital signature pad: draw vector signature, type cursive name, or place PNG seal.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'Signature',
    iconName: 'PenTool',
    tags: ['signature', 'stamp', 'sign', 'handwriting'],
  },
  {
    id: 'pdf-to-pdfa',
    title: 'PDF to PDF/A',
    description: 'Convert to ISO-compliant archival standard (PDF/A-1b) with color profiles and embedded fonts.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF/A',
    iconName: 'Archive',
    tags: ['archive', 'iso', 'standards', 'long-term'],
  },
  {
    id: 'repair-pdf',
    title: 'Repair PDF',
    description: 'Rebuild broken cross-reference tables (XREF), repair corrupted streams, and salvage pages.',
    category: 'security',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'Salvage',
    iconName: 'Wrench',
    tags: ['corrupted', 'fix', 'recover', 'xref'],
  },
  {
    id: 'compare-pdf',
    title: 'Compare PDF',
    description: 'Side-by-side visual diff engine highlighting deleted, added, or modified text coordinates.',
    category: 'security',
    inputType: 'multiple-pdf',
    outputFormat: 'Diff Report',
    iconName: 'GitCompare',
    tags: ['diff', 'revisions', 'compare', 'changes'],
  },

  // --- D. Advanced Optimization & Interactive Forms (4) ---
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Downsample embedded raster streams, strip redundant font metadata, and minimize byte size.',
    category: 'advanced',
    inputType: 'pdf',
    outputFormat: 'PDF',
    badge: 'Optimizer',
    iconName: 'Minimize2',
    tags: ['shrink', 'reduce', 'optimize', 'lightweight'],
  },
  {
    id: 'forms-builder',
    title: 'PDF Forms Builder & Filler',
    description: 'Auto-detect interactive form fields; fill, generate or inject text fields, checkboxes, and radio buttons.',
    category: 'advanced',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'CheckSquare',
    tags: ['acroform', 'fill', 'interactive', 'fields'],
  },
  {
    id: 'scan-to-pdf',
    title: 'Scan to PDF (Webcam)',
    description: 'Capture physical documents via your camera, apply adaptive contrast filters, and compile to PDF.',
    category: 'advanced',
    inputType: 'none',
    outputFormat: 'PDF',
    badge: 'Camera',
    iconName: 'Camera',
    tags: ['webcam', 'scan', 'physical', 'scanner'],
  },
  {
    id: 'flatten-pdf',
    title: 'Flatten PDF',
    description: 'Flatten interactive form fields and annotation layers into non-editable, static vector content.',
    category: 'advanced',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Stamp',
    tags: ['flatten', 'static', 'lock', 'print-ready'],
  },

  // --- E. AI & Language Intelligence (4) ---
  {
    id: 'ocr-pdf',
    title: 'OCR PDF (Text Extraction)',
    description: 'Client-side optical character recognition converting scans into selectable, searchable text layers.',
    category: 'ai',
    inputType: 'pdf',
    outputFormat: 'PDF / Text',
    badge: 'Neural',
    iconName: 'ScanText',
    tags: ['ocr', 'tesseract', 'extract', 'searchable'],
  },
  {
    id: 'ai-summarizer',
    title: 'AI Document Summarizer',
    description: 'Extract multi-page document tokens and generate executive summaries, key takeaways, and bullet lists.',
    category: 'ai',
    inputType: 'pdf',
    outputFormat: 'Report / MD',
    badge: 'Intelligence',
    iconName: 'Sparkles',
    tags: ['summary', 'llm', 'insights', 'abstract'],
  },
  {
    id: 'translate-pdf',
    title: 'Translate PDF',
    description: 'Parse layout text coordinates, translate contents, and re-inject translated strings in place.',
    category: 'ai',
    inputType: 'pdf',
    outputFormat: 'PDF',
    iconName: 'Languages',
    tags: ['multilingual', 'translate', 'international'],
  },
  {
    id: 'extract-assets',
    title: 'Extract Assets & Images',
    description: 'Extract all embedded raster images, vector assets, and file attachments into a clean ZIP archive.',
    category: 'ai',
    inputType: 'pdf',
    outputFormat: 'ZIP',
    iconName: 'FolderArchive',
    tags: ['images', 'media', 'rip', 'assets'],
  },
];
