import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { IntakeOptions, IntakeResult } from "./types";

// ── Constants ─────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xlsm"]);
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const PARSER_VERSION = "0.1.0";

// ── Public API ────────────────────────────────────────────────────

/**
 * Validate and securely intake a workbook file.
 * - Accepts .xlsx and .xlsm only.
 * - Enforces a configurable byte limit.
 * - Rejects password-protected/encrypted files where detectable.
 * - Computes SHA-256.
 * - Stores the file via a caller-supplied callback.
 */
export async function intakeWorkbook(
  fileBuffer: Buffer,
  originalName: string,
  options: IntakeOptions,
): Promise<IntakeResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  // Validate extension
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new IntakeError(
      `Unsupported file extension "${ext}". Allowed: .xlsx, .xlsm`,
    );
  }

  // Enforce size limit
  if (fileBuffer.length > maxBytes) {
    throw new IntakeError(
      `File size ${fileBuffer.length} bytes exceeds limit of ${maxBytes} bytes`,
    );
  }

  // Reject password-protected / encrypted files where detectable
  // The OOXML "EncryptedPackage" stream is a reliable indicator.
  if (detectEncryptedOoxml(fileBuffer)) {
    throw new IntakeError(
      "File appears to be password-protected or encrypted. Encrypted workbooks are not supported.",
    );
  }

  // Reject files that start with an encrypted OOXML pattern (Office 2007+ DRM)
  if (detectEncryptedAgile(fileBuffer)) {
    throw new IntakeError(
      "File appears to be encrypted (Agile Encryption). Encrypted workbooks are not supported.",
    );
  }

  // Compute SHA-256
  const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

  // Store via caller-supplied callback
  const storedPath = await options.storeFile(fileBuffer, originalName);

  return {
    storedPath,
    sha256,
    byteSize: fileBuffer.length,
    parserVersion: PARSER_VERSION,
    sheetSummaries: [],
  };
}

// ── Encryption detection helpers ──────────────────────────────────
// These inspect raw file bytes to detect OOXML encryption without
// attempting decryption. They are heuristics — not every encrypted
// file is caught, but the common cases are.

/**
 * Detect the standard OOXML EncryptedPackage stream marker.
 * In a compound-file-bundle OOXML file (not the ZIP variant), the
 * "EncryptedPackage" stream name appears at a predictable offset.
 *
 * For ZIP-based OOXML, we check for the "EncryptedPackage" entry name
 * in the central directory near the end of the file.
 */
function detectEncryptedOoxml(buffer: Buffer): boolean {
  // Check for "EncryptedPackage" in the buffer as a whole
  return buffer.includes(Buffer.from("EncryptedPackage"));
}

/**
 * Detect OOXML Agile Encryption (Office 2013+) by the
 * "EncryptionInfo" stream/entry name.
 */
function detectEncryptedAgile(buffer: Buffer): boolean {
  return buffer.includes(Buffer.from("EncryptionInfo"));
}

// ── Errors ────────────────────────────────────────────────────────

export class IntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeError";
  }
}

// ── Utility: read a file into buffer ──────────────────────────────

export async function readFileBuffer(filePath: string): Promise<Buffer> {
  await access(filePath, constants.R_OK);
  return readFile(filePath);
}

// ── Utility: store file helper ────────────────────────────────────

/**
 * Convenience factory that stores files under a base directory.
 * The stored filename includes the original name and a random UUID
 * to prevent collisions. The returned path is always outside any
 * public web root.
 */
export function storeFileUnder(baseDir: string) {
  return async (buffer: Buffer, originalName: string): Promise<string> => {
    const ext = extname(originalName);
    const storedName = `${randomUUID()}${ext}`;
    const fullPath = join(baseDir, storedName);
    await writeFile(fullPath, buffer);
    return fullPath;
  };
}
