import { parse as csvParse } from 'csv-parse/sync';
import * as mammoth from 'mammoth';

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to handle pdf-parse's CommonJS export
  const pdfParse = require('pdf-parse');
  const parser = new pdfParse.PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

/**
 * Extract text from CSV buffer
 */
export async function extractTextFromCsv(buffer: Buffer): Promise<string> {
  const records = csvParse(buffer, {
    skip_empty_lines: true,
    relax_column_count: true,
  });
  
  // Join all rows and columns with spaces
  return records
    .map((row: string[]) => row.join(' '))
    .join('\n');
}

/**
 * Extract text from TXT buffer
 */
export async function extractTextFromTxt(buffer: Buffer): Promise<string> {
  return buffer.toString('utf8');
}

/**
 * Extract text from DOCX buffer
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Detect file type and extract text
 */
export async function detectAndExtract(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'pdf':
      return extractTextFromPdf(buffer);
    case 'csv':
      return extractTextFromCsv(buffer);
    case 'txt':
    case 'md':
      return extractTextFromTxt(buffer);
    case 'docx':
      return extractTextFromDocx(buffer);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

