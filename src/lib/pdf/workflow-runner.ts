import { ToolId, WorkflowStep, WorkflowPreset, ToolExecutionResult } from '@/types';
import { mergePdf, splitPdf, organizePdf, rotatePdf, cropPdf, addPageNumbers, watermarkPdf } from './engines/merge-split';
import { imagesToPdf, pdfToImages, pdfToMarkdown, htmlToPdf } from './engines/convert';
import { pdfToWord, wordToPdf, pdfToExcel, excelToPdf, pdfToPptx, pptxToPdf } from './engines/office';
import { protectPdf, unlockPdf, redactPdf, signPdf, pdfToPdfA, repairPdf, comparePdf } from './engines/security';
import { compressPdf, formsBuilder, scanToPdf, flattenPdf } from './engines/forms';
import { ocrPdf, aiSummarizePdf, translatePdf, extractAssets } from './engines/ocr-ai';

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'scan-clean-vault',
    name: 'Scan, OCR & Confidential Vaulting',
    description: 'Process raw document scans, extract text layer, compress file size, stamp watermarks, and stage.',
    icon: 'Scan',
    tags: ['ocr', 'watermark', 'compress', 'security'],
    steps: [
      { toolId: 'ocr-pdf', label: 'Extract Optical Text Layer', params: {} },
      { toolId: 'compress-pdf', label: 'Compress Raster Streams', params: { targetQuality: 'medium' } },
      { toolId: 'watermark-pdf', label: 'Stamp "CONFIDENTIAL" Seal', params: { text: 'CONFIDENTIAL', opacity: 0.25, color: 'indigo' } },
      { toolId: 'protect-pdf', label: 'Encrypt Document', params: { userPassword: 'AuraVaultSecureKey' } },
    ],
  },
  {
    id: 'executive-briefing',
    name: 'Executive Briefing & Intelligence Pack',
    description: 'Merge multiple reports, paginate with footers, run AI summarization, and convert to Word DOCX.',
    icon: 'Sparkles',
    tags: ['merge', 'ai', 'word', 'pagination'],
    steps: [
      { toolId: 'merge-pdf', label: 'Merge Dossiers', params: {} },
      { toolId: 'page-numbers', label: 'Stamp Header/Footer Pagination', params: { format: 'Page {n} of {total}', position: 'bottom-center' } },
      { toolId: 'ai-summarizer', label: 'Synthesize Executive Takeaways', params: {} },
      { toolId: 'pdf-to-word', label: 'Export Editable Briefing (.docx)', params: {} },
    ],
  },
  {
    id: 'forensic-sanitization',
    name: 'Forensic Redaction & Archival Preservation',
    description: 'Perform permanent coordinate redaction, convert to ISO PDF/A archival standard, and verify diff.',
    icon: 'ShieldCheck',
    tags: ['redact', 'pdfa', 'archival', 'forensic'],
    steps: [
      { toolId: 'redact-pdf', label: 'Cryptographic Redaction (Coordinate Strip)', params: { redactions: [{ pageIndex: 0, x: 50, y: 700, width: 250, height: 25 }] } },
      { toolId: 'flatten-pdf', label: 'Flatten Forms & Annotations', params: {} },
      { toolId: 'pdf-to-pdfa', label: 'Convert to ISO PDF/A-1b Compliance', params: {} },
    ],
  },
];

/**
 * Single Tool Execution Dispatcher
 */
export async function executeTool(
  toolId: ToolId,
  files: File[],
  params: Record<string, any> = {}
): Promise<ToolExecutionResult> {
  const primaryFile = files[0];

  switch (toolId) {
    // Core Manipulation
    case 'merge-pdf':
      return await mergePdf(files);
    case 'split-pdf':
      return await splitPdf(primaryFile, params.rangeStr || '1', params.mode || 'range');
    case 'organize-pdf':
      return await organizePdf(primaryFile, params.pageOrder || [0], params.rotations || {});
    case 'rotate-pdf':
      return await rotatePdf(primaryFile, params.angle || 90, params.pageIndices);
    case 'crop-pdf':
      return await cropPdf(primaryFile, params.crop || { top: 5, right: 5, bottom: 5, left: 5 });
    case 'page-numbers':
      return await addPageNumbers(primaryFile, params);
    case 'watermark-pdf':
      return await watermarkPdf(primaryFile, params as any);

    // Image & Document Conversions
    case 'jpg-to-pdf':
      return await imagesToPdf(files, params);
    case 'pdf-to-jpg':
      return await pdfToImages(primaryFile, params.format || 'png', params.scale || 2);
    case 'pdf-to-markdown':
      return await pdfToMarkdown(primaryFile);
    case 'html-to-pdf':
      return await htmlToPdf(params.htmlContent || '<h1>AURA DROP</h1><p>Client render sandbox</p>', params.title);
    case 'pdf-to-word':
      return await pdfToWord(primaryFile);
    case 'word-to-pdf':
      return await wordToPdf(primaryFile);
    case 'pdf-to-excel':
      return await pdfToExcel(primaryFile);
    case 'excel-to-pdf':
      return await excelToPdf(primaryFile);
    case 'pdf-to-pptx':
      return await pdfToPptx(primaryFile);
    case 'pptx-to-pdf':
      return await pptxToPdf(primaryFile);

    // Security & Forensic
    case 'protect-pdf':
      return await protectPdf(primaryFile, params.userPassword || 'AuraDrop2026!');
    case 'unlock-pdf':
      return await unlockPdf(primaryFile, params.passwordAttempt);
    case 'redact-pdf':
      return await redactPdf(primaryFile, params.redactions || [{ pageIndex: 0, x: 50, y: 700, width: 200, height: 30 }]);
    case 'sign-pdf':
      return await signPdf(primaryFile, params.signatureDataUrl, params as any);
    case 'pdf-to-pdfa':
      return await pdfToPdfA(primaryFile);
    case 'repair-pdf':
      return await repairPdf(primaryFile);
    case 'compare-pdf':
      return await comparePdf(files[0], files[1] || files[0]);

    // Advanced & Forms
    case 'compress-pdf':
      return await compressPdf(primaryFile, params.targetQuality || 'medium');
    case 'forms-builder':
      return await formsBuilder(primaryFile, params);
    case 'scan-to-pdf':
      return await scanToPdf(params.snapshots || []);
    case 'flatten-pdf':
      return await flattenPdf(primaryFile);

    // AI & Intelligence
    case 'ocr-pdf':
      return await ocrPdf(primaryFile);
    case 'ai-summarizer':
      return await aiSummarizePdf(primaryFile);
    case 'translate-pdf':
      return await translatePdf(primaryFile, params.targetLanguage || 'Spanish');
    case 'extract-assets':
      return await extractAssets(primaryFile);

    default:
      throw new Error(`Unrecognized tool ID: ${toolId}`);
  }
}

/**
 * Sequential Workflow Pipeline Runner
 */
export async function runWorkflowPipeline(
  steps: WorkflowStep[],
  initialFiles: File[],
  onStepUpdate: (stepIndex: number, updated: Partial<WorkflowStep>) => void
): Promise<ToolExecutionResult> {
  let currentFiles = [...initialFiles];
  let lastResult: ToolExecutionResult | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onStepUpdate(i, { status: 'running', progress: 25 });

    try {
      const result = await executeTool(step.toolId, currentFiles, step.params);
      lastResult = result;
      onStepUpdate(i, { status: 'completed', progress: 100, output: result });

      // If the tool produced a blob and is not the last step, convert it to a File for the next step
      if (result.blob && i < steps.length - 1) {
        const nextFile = new File([result.blob], result.filename, { type: result.blob.type });
        currentFiles = [nextFile];
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'An error occurred during pipeline execution';
      onStepUpdate(i, { status: 'error', error: errorMsg });
      throw new Error(`Step ${i + 1} (${step.label}) failed: ${errorMsg}`);
    }
  }

  if (!lastResult) {
    throw new Error('Pipeline produced no results');
  }

  return lastResult;
}
