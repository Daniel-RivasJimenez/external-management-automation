/**
 * === UTILITIES-GLOBAL.GS ===
 * External Management Automation System
 * Consolidated utility and helper functions
 * 
 * Organized by category:
 * - String/Text formatting
 * - Date/Time handling
 * - Number formatting & validation
 * - Data type conversions
 * - HTML/Security utilities
 * - Google Drive utilities
 * - Batch operations
 * - Geography/Country mappings
 */

/***********************************************************
 * STRING & TEXT UTILITIES
 ***********************************************************/

/**
 * Force to string; null/undefined → ''
 */
function forceText_(value) {
  if (value === '' || value == null) return '';
  return String(value);
}

/**
 * Force to string with apostrophe prefix
 * Preserves leading zeros in Google Sheets
 * Example: 00123 stays as 00123 (not converted to 123)
 */
function forceTextApostrofo_(value) {
  if (!value) return '';
  return "'" + String(value);
}

/**
 * Convert to trimmed string; handles null/undefined
 */
function toTrimmedString_(v) {
  return String(v ?? '').trim();
}

/**
 * Basic HTML escape to prevent XSS in email templates
 * Escapes: &, <, >, ", '
 */
function escapeHtml(input) {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/***********************************************************
 * NUMBER FORMATTING
 ***********************************************************/

/**
 * Pad number to exactly 8 digits with leading zeros
 * Non-numeric values returned as-is
 * Example: 123 → "00000123"
 */
function format8Digits_(value) {
  if (value === '' || value == null) return '';
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(8, '0');
}

/**
 * Pad number to exactly 11 digits with leading zeros
 * Non-numeric values returned as-is
 * Example: 12345 → "00000012345"
 */
function format11Digits_(value) {
  if (value === '' || value == null) return '';
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(11, '0');
}

/**
 * Pad number to arbitrary digit count
 * Returns non-numeric strings unchanged
 */
function padLeftDigits_(value, totalDigits) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(totalDigits, '0');
}

/**
 * Parse to integer safely; invalid → defaultValue
 */
function safeInt_(value, defaultValue) {
  const n = parseInt(String(value ?? ''), 10);
  return isNaN(n) ? (defaultValue ?? 0) : n;
}

/***********************************************************
 * DATE & TIME UTILITIES
 ***********************************************************/

/**
 * Normalize date to yyyy-MM-dd format (flexible input)
 * Accepts: Date objects, ISO strings, dd/MM/yyyy, Excel numbers
 * Invalid input → ''
 */
function normalizeToYMDLoose_(value, tz) {
  const timezone = tz || Session.getScriptTimeZone() || 'Europe/Madrid';
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  
  const s = String(value).trim();
  if (!s) return '';
  
  // Already in yyyy-MM-dd format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Try dd/MM/yyyy format
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  
  // Try parsing as Date
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return Utilities.formatDate(d2, timezone, 'yyyy-MM-dd');
  
  return '';
}

/**
 * Format timestamp to dd/MM/yyyy HH:mm:ss
 * Handles: Date objects, numbers (Excel serial, milliseconds), strings
 * Invalid input → '-'
 */
function formatDateTimeStrict_(value, tz) {
  const timezone = tz || Session.getScriptTimeZone() || 'Europe/Madrid';
  const FORMAT = 'dd/MM/yyyy HH:mm:ss';
  
  if (value === null || value === undefined) return '-';
  
  // Date object
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, FORMAT);
  }
  
  // Number (Excel serial or milliseconds)
  if (typeof value === 'number' && isFinite(value)) {
    if (value === 0) return '-';
    let d;
    if (value > 1e11) d = new Date(value); // milliseconds
    else d = new Date(Math.round((value - 25569) * 86400 * 1000)); // Excel serial
    return !isNaN(d.getTime()) ? Utilities.formatDate(d, timezone, FORMAT) : '-';
  }
  
  // String
  const s = String(value).trim();
  if (!s || s === '0') return '-';
  
  // Try parsing dd/MM/yyyy HH:mm:ss
  const m = s.match(/^(\d{1,2})[\\/\-](\d{1,2})[\\/\-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const dd = Number(m[1]), MM = Number(m[2]), yyyy = Number(m[3]);
    const hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6]);
    const d = new Date(yyyy, MM - 1, dd, hh, mm, ss);
    return !isNaN(d.getTime()) ? Utilities.formatDate(d, timezone, FORMAT) : s;
  }
  
  // Try generic parsing
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return Utilities.formatDate(d2, timezone, FORMAT);
  
  return s;
}

/***********************************************************
 * SHEET OPERATIONS
 ***********************************************************/

/**
 * Find last non-empty row in a column
 * Returns row index (1-based); startRow-1 if all empty
 */
function findLastNonEmptyRowInCol_(sheet, col, startRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return startRow - 1;
  const values = sheet.getRange(startRow, col, lastRow - startRow + 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i][0];
    if (v !== '' && v != null) return startRow + i;
  }
  return startRow - 1;
}

/**
 * Alias: find last data row in column
 */
function getLastDataRowInColumn_(sheet, col, startRow) {
  return findLastNonEmptyRowInCol_(sheet, col, startRow);
}

/**
 * Count pending rows (status column is empty)
 * Used to check if automation should trigger
 */
function countPendingRows_(sheet, startRow, statusCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return 0;
  const values = sheet.getRange(startRow, statusCol, lastRow - startRow + 1, 1).getValues();
  let count = 0;
  for (const [v] of values) {
    if (v === '' || v == null) count++;
  }
  return count;
}

/***********************************************************
 * GOOGLE DRIVE UTILITIES
 ***********************************************************/

/**
 * Extract valid Drive folder ID from URL or direct ID
 * Validates format: alphanumeric, 10+ chars, no slashes
 * Example: "https://drive.google.com/drive/folders/1AbCdEfG123" → "1AbCdEfG123"
 */
function extractDriveFolderId_(s) {
  if (!s) return '';
  const trimmed = String(s).trim();
  
  // Direct ID format
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  
  // URL format
  const m = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  
  return '';
}

/**
 * Get column letter from column number (1-based)
 * Example: 1 → "A", 27 → "AA"
 */
function numberToColumnLetter_(n) {
  let letter = '';
  while (n > 0) {
    n--;
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26);
  }
  return letter;
}

/**
 * Get column number from column letter (1-based)
 * Example: "A" → 1, "AA" → 27
 */
function letterToNumber_(letters) {
  let n = 0;
  const s = String(letters).toUpperCase().trim();
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}

/***********************************************************
 * BATCH WRITE OPERATIONS
 ***********************************************************/

/**
 * Batch write values to sheet in chunks
 * Handles large datasets that could timeout
 * options: { chunkSize: 500, delayMs: 100 }
 */
function batchWrite_(sheet, startRow, startCol, values, options) {
  const opts = options || {};
  const chunkSize = opts.chunkSize || 500;
  const delayMs = opts.delayMs || 50;
  
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      sheet.getRange(startRow + i, startCol, chunk.length, chunk[0].length).setValues(chunk);
      if (i + chunkSize < values.length) Utilities.sleep(delayMs);
    }
  }
}

/***********************************************************
 * GEOGRAPHY & COUNTRY MAPPING
 ***********************************************************/

/**
 * Convert country name to ISO3 code
 * Normalizes input: removes accents, uppercase
 * Returns '' if not found
 * 
 * Example: "España" → "ESP", "Brazil" → "BRA"
 */
function countryToISO3_(value) {
  if (!value) return '';
  
  const normalize = (s) =>
    String(s).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const s = normalize(value);
  
  const MAP = {
    'ESPANA': 'ESP', 'SPAIN': 'ESP',
    'ECUADOR': 'ECU', 'PORTUGAL': 'PRT',
    'BRASIL': 'BRA', 'BRAZIL': 'BRA',
    'MEXICO': 'MEX', 'COLOMBIA': 'COL',
    'PERU': 'PER', 'ARGENTINA': 'ARG',
    'CHILE': 'CHL', 'URUGUAY': 'URY',
    'PARAGUAY': 'PRY', 'BOLIVIA': 'BOL',
    'VENEZUELA': 'VEN', 'REPUBLICA DOMINICANA': 'DOM',
    'ITALIA': 'ITA', 'FRANCIA': 'FRA',
    'ALEMANIA': 'DEU', 'IRLANDA': 'IRL',
    'REINO UNIDO': 'GBR', 'UK': 'GBR',
    'INDIA': 'IND', 'POLONIA': 'POL',
    'RUMANIA': 'ROU', 'MARRUECOS': 'MAR',
    'CHINA': 'CHN'
  };
  
  return MAP[s] || '';
}

/***********************************************************
 * VALIDATION & CONVERSION
 ***********************************************************/

/**
 * Check if value is truthy (for checkboxes, status flags)
 * Recognizes: true, 1, "yes", "sí", "true", "1", "ok"
 */
function isTruthy_(value) {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').toLowerCase().trim();
  return ['yes', 'sí', 'si', 'true', '1', 'ok', 'checked'].includes(s);
}

/**
 * Validate email format (basic regex)
 */
function isValidEmail_(email) {
  const s = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Validate date format (yyyy-MM-dd)
 */
function isValidDateFormat_(dateStr) {
  const s = String(dateStr ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

/**
 * Deep clone object (for complex nested structures)
 */
function deepClone_(obj) {
  return JSON.parse(JSON.stringify(obj));
}
