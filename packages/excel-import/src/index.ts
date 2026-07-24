// ── @model-monitor/excel-import public API ────────────────────────

// Types
export type {
  IntakeResult,
  IntakeOptions,
  SheetSummary,
  CellProvenance,
  RawCell,
  ParsedRow,
  ParsedSheet,
  ParseError,
  ParseResult,
  NormalizedModelRow,
  MatchResult,
  MatchLevel,
  MatchRegistry,
  CanonicalIdentity,
} from "./types";

// Intake
export { intakeWorkbook, IntakeError, readFileBuffer, storeFileUnder } from "./intake";

// Parser
export {
  parseWorkbook,
  loadWorkbook,
  excelSerialDateToIso,
} from "./parser";

// Normalization
export {
  normalizeTrim,
  normalizeCase,
  resolveProviderAlias,
  createSlugFromId,
  isDeveloper,
  resolveDeveloper,
  resolveAccessProvider,
  parseTriState,
  normalizeMasterRow,
} from "./normalize";

// Matcher
export { buildMatchRegistry, matchRow } from "./match";
