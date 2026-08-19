/**
 * === COLUMNAS-RESOLVER.GS ===
 * External Management Automation System
 * Dynamic column resolution by header name
 * 
 * Handles dynamic column lookup in "Ordered Responses - WORKDAY" sheet
 * Tolerates column insertion/reordering and resolves DUPLICATE headers
 * by block (nth occurrence)
 */

const HEADER_ROW_RO = 4; // Header row in "Respuestas Ordenadas - WORKDAY"

/**
 * Normalize header text: collapse spaces, trim, normalize unicode
 * Example: "  Tipo  Gestión  " → "tipo gestion"
 */
function normHeader_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/**
 * Read header row from sheet → { headerName: [1-based column indices...] }
 * Tolerates duplicate headers by storing all column positions
 */
function getHeaderMap_(sheet, headerRow) {
  if (!sheet) throw new Error('getHeaderMap_: invalid sheet');
  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((raw, i) => {
    const name = normHeader_(raw);
    if (name) (map[name] = map[name] || []).push(i + 1);
  });
  return map;
}

/**
 * Get column index (1-based) by normalized header name
 * nth = occurrence number (default 1 for first match)
 * Throws if not found or ambiguous without nth parameter
 */
function colByName_(map, name, nth) {
  const key = normHeader_(name);
  const arr = map[key];
  if (!arr || !arr.length) throw new Error('Column not found: "' + key + '"');
  if (arr.length > 1 && !nth) throw new Error('Duplicate column (' + arr.length + ' occurrences); specify occurrence: "' + key + '"');
  const pos = nth || 1;
  if (pos > arr.length) throw new Error('Column "' + key + '" does not have ' + pos + ' occurrences (has ' + arr.length + ')');
  return arr[pos - 1];
}

/**
 * Dictionary of DUPLICATE headers in "Ordered Responses - WORKDAY"
 * Value = nth occurrence from left to right (1 = first)
 * 
 * Example:
 *   "Estructura": { CONSULTA: 1, MODIF: 2, ALTA: 3 }
 *   means "Estructura" appears 3 times - use RO_DUP to distinguish
 */
const RO_DUP = {
  'Estructura':            { CONSULTA: 1, MODIF: 2, ALTA: 3 },
  'Supervisory':           { CONSULTA: 1, ALTA: 2, GESTION: 3 },
  'Código Supervisory':    { CONSULTA: 1, ALTA: 2 },
  'Disciplina':            { CONSULTA: 1, ALTA: 2 },
  'Equipo':                { CONSULTA: 1, ALTA: 2 },
  'Teléfono Movil':        { ALTA: 1, GESTION: 2 },
  'Email Personal':        { ALTA: 1, GESTION: 2 },
  'Tipo ID Gubernamental': { ALTA: 1, GESTION: 2 },
  'Nº ID Gubernamental':   { ALTA: 1, GESTION: 2 },
  'Código Staffing Pool':  { ALTA: 1, CORRECCION: 2 }
};

/**
 * Get column index resolving duplicates using RO_DUP dictionary
 * 
 * Example:
 *   getRO_(map, "Supervisory", "ALTA") → uses RO_DUP["Supervisory"]["ALTA"] = 2
 *   Returns 2nd occurrence of "Supervisory"
 */
function getRO_(map, name, bloque) {
  const key = normHeader_(name);
  if (RO_DUP[key]) {
    if (!bloque || RO_DUP[key][bloque] == null)
      throw new Error('Column "' + key + '" is duplicate; valid blocks: ' + Object.keys(RO_DUP[key]).join(', '));
    return colByName_(map, key, RO_DUP[key][bloque]);
  }
  return colByName_(map, key);
}

/**
 * Main column resolver function
 * Takes spec: { ALIAS: {name:'Column Name'} | {name:'X', bloque:'ALTA'} | {name:'Y', nth:2} }
 * Returns: { ALIAS: columnIndex }
 * 
 * Validates all columns exist before returning (fail-fast)
 * 
 * Example:
 *   resolveCols_(sheet, 4, {
 *     ID_PETICION: { name: 'ID Peticion' },
 *     SUPERVISORY: { name: 'Supervisory', bloque: 'ALTA' }
 *   })
 *   → { ID_PETICION: 2, SUPERVISORY: 8 }
 */
function resolveCols_(sheet, headerRow, spec, sheetLabel) {
  const map = getHeaderMap_(sheet, headerRow);
  const out = {}, errores = [];
  
  Object.keys(spec).forEach(alias => {
    const s = spec[alias];
    try {
      out[alias] = s.bloque ? getRO_(map, s.name, s.bloque) : colByName_(map, s.name, s.nth);
    } catch (e) { 
      errores.push('· ' + alias + ' → ' + e.message); 
    }
  });
  
  if (errores.length) throw new Error('Unresolved columns in "' + (sheetLabel || sheet.getName()) + '":\n' + errores.join('\n'));
  Logger.log('resolveCols_ OK (' + (sheetLabel || sheet.getName()) + '): ' + Object.keys(out).map(a => a + '=' + out[a]).join(', '));
  return out;
}
