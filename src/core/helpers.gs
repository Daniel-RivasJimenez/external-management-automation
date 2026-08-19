/**
 * === HELPERS.GS ===
 * External Management Automation System
 * Common utility functions and helpers
 */

/********************************************************
 * HELPERS COMUNES
 ********************************************************/

/** Busca la última fila no vacía en una columna. */
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

/** Fuerza texto (conversión simple a String). */
function forceText_(value) {
  if (value === '' || value == null) return '';
  return String(value);
}

/** Fuerza texto REAL anteponiendo apóstrofo (conserva ceros a la izquierda en Sheets). */
function forceTextApostrofo_(value) {
  if (!value) return '';
  return "'" + String(value);
}

/** Formatea a 8 dígitos con ceros a la izquierda (si es numérico puro). */
function format8Digits_(value) {
  if (value === '' || value == null) return '';
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(8, '0');
}

/** Formatea a 11 dígitos con ceros a la izquierda (si es numérico puro). */
function format11Digits_(value) {
  if (value === '' || value == null) return '';
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(11, '0');
}

/** Cuenta filas pendientes (celda de estado vacía). */
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

/** Normaliza fechas a yyyy-MM-dd (versión flexible). */
function normalizeToYMDLoose_(value, tz) {
  const timezone = tz || Session.getScriptTimeZone() || 'Europe/Madrid';
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return Utilities.formatDate(d2, timezone, 'yyyy-MM-dd');
  return '';
}

/** Convierte a string trim; null/undefined -> '' */
function toTrimmedString_(v) {
  return String(v ?? '').trim();
}

/** Escape básico para HTML (prevenir inyecciones XSS en emails). */
function escapeHtml(input) {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Formatea timestamp a dd/MM/yyyy HH:mm:ss */
function formatDateTimeStrict_(value, tz) {
  const timezone = tz || Session.getScriptTimeZone() || 'Europe/Madrid';
  const FORMAT = 'dd/MM/yyyy HH:mm:ss';
  if (value === null || value === undefined) return '-';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, FORMAT);
  }
  if (typeof value === 'number' && isFinite(value)) {
    if (value === 0) return '-';
    let d;
    if (value > 1e11) d = new Date(value);
    else d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return !isNaN(d.getTime()) ? Utilities.formatDate(d, timezone, FORMAT) : '-';
  }
  const s = String(value).trim();
  if (!s || s === '0') return '-';
  const m = s.match(/^(\d{1,2})[\\/\\-](\d{1,2})[\\/\\-](\d{4})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})$/);
  if (m) {
    const dd = Number(m[1]), MM = Number(m[2]), yyyy = Number(m[3]);
    const hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6]);
    const d = new Date(yyyy, MM - 1, dd, hh, mm, ss);
    return !isNaN(d.getTime()) ? Utilities.formatDate(d, timezone, FORMAT) : s;
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return Utilities.formatDate(d2, timezone, FORMAT);
  return s;
}

/** Encuentra la última fila no vacía en una columna. */
function getLastDataRowInColumn_(sheet, col, startRow) {
  const maxRows = sheet.getMaxRows();
  const numRows = maxRows - startRow + 1;
  const values = sheet.getRange(startRow, col, numRows, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '' && values[i][0] != null) {
      return startRow + i;
    }
  }
  return startRow - 1;
}

/** Extrae un ID válido de carpeta de Drive desde una URL o ID directo. */
function extractDriveFolderId_(s) {
  if (!s) return '';
  const trimmed = String(s).trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  const m = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  return '';
}

/** Padding solo si es numérico; si no, deja el texto tal cual. */
function padLeftDigits_(value, totalDigits) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;
  return s.padStart(totalDigits, '0');
}

/** Convierte país a ISO3 (sin acentos, mayúsculas). */
function countryToISO3_(value) {
  if (!value) return '';
  const normalize = (s) =>
    String(s).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const s = normalize(value);
  const MAP = {
    'ESPANA': 'ESP', 'SPAIN': 'ESP', 'ECUADOR': 'ECU', 'PORTUGAL': 'PRT',
    'BRASIL': 'BRA', 'BRAZIL': 'BRA', 'MEXICO': 'MEX', 'COLOMBIA': 'COL',
    'PERU': 'PER', 'ARGENTINA': 'ARG', 'CHILE': 'CHL', 'URUGUAY': 'URY',
    'PARAGUAY': 'PRY', 'BOLIVIA': 'BOL', 'VENEZUELA': 'VEN',
    'REPUBLICA DOMINICANA': 'DOM', 'ITALIA': 'ITA', 'FRANCIA': 'FRA',
    'ALEMANIA': 'DEU', 'IRLANDA': 'IRL', 'REINO UNIDO': 'GBR', 'UK': 'GBR',
    'INDIA': 'IND', 'POLONIA': 'POL', 'RUMANIA': 'ROU', 'MARRUECOS': 'MAR',
    'CHINA': 'CHN'
  };
  return MAP[s] || '';
}

/** Convierte letra columna Excel a número 1-based. */
function letterToNumber_(letters) {
  let n = 0;
  const s = String(letters).toUpperCase().trim();
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}
