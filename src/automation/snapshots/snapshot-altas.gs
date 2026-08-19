/**
 * === SNAPSHOT-ALTAS.GS ===
 * External Management Automation System
 * Read pending HIRING (ALTAS) requests and snapshot to queue
 * 
 * Flow:
 * 1. Read "Ordered Responses" sheet
 * 2. Filter rows where Type = "ALTA" AND Status = "" (pending)
 * 3. Deduplicate by timestamp
 * 4. Assign sequential IDs
 * 5. Write to "Gestion ALTAS - WORKDAY" queue sheet
 */

/**
 * Snapshot pending ALTA (hire) requests from ordered responses
 * Deduplicates by timestamp; skips if already processed
 * Assigns sequential request IDs
 * 
 * Preconditions:
 * - "Respuestas Ordenadas - WORKDAY" sheet must exist
 * - "Gestion ALTAS - WORKDAY" queue sheet must exist
 * - volcadoRespuestasOrdenadas() must run first
 * 
 * Returns: { success: bool, rowsProcessed: int, message: string }
 */
function snapshotAltasPendientesToQueue() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetQueue = ss.getSheetByName(NOMBRE_HOJA_BAJAS); // ALTAS queue
    
    if (!sheetRO || !sheetQueue) {
      throw new Error('Missing required sheets: Ordered Responses or ALTAS queue');
    }
    
    // Resolve column indices dynamically
    const colsRO = resolveCols_(sheetRO, HEADER_ROW_RO, {
      ID_PETICION: { name: 'ID Peticion' },
      TIPO_GESTION: { name: 'Tipo Gestion' },
      STATUS: { name: 'Status' },
      TIMESTAMP: { name: 'Timestamp' },
      // Add other required columns
    }, 'Respuestas Ordenadas');
    
    const lastRow = sheetRO.getLastRow();
    if (lastRow <= HEADER_ROW_RO) {
      Logger.log('snapshotAltasPendientesToQueue: No data rows');
      return { success: true, rowsProcessed: 0, message: 'No pending requests' };
    }
    
    // Read all data
    const range = sheetRO.getRange(HEADER_ROW_RO + 1, 1, lastRow - HEADER_ROW_RO, sheetRO.getLastColumn());
    const allRows = range.getValues();
    
    // Filter: Type = "ALTA" AND Status = "" (pending)
    const pendingAltas = allRows.filter(row => {
      const tipoGestion = toTrimmedString_(row[colsRO.TIPO_GESTION - 1]);
      const status = toTrimmedString_(row[colsRO.STATUS - 1]);
      return tipoGestion === 'ALTA' && status === '';
    });
    
    if (pendingAltas.length === 0) {
      Logger.log('snapshotAltasPendientesToQueue: No pending ALTA requests');
      return { success: true, rowsProcessed: 0, message: 'No pending ALTA requests' };
    }
    
    // Deduplicate by timestamp
    const seen = new Set();
    const deduplicated = [];
    pendingAltas.forEach(row => {
      const ts = toTrimmedString_(row[colsRO.TIMESTAMP - 1]);
      if (!seen.has(ts)) {
        seen.add(ts);
        deduplicated.push(row);
      }
    });
    
    // Get last request ID from queue to assign sequential IDs
    const lastQueueRow = sheetQueue.getLastRow();
    let nextRequestId = 1;
    if (lastQueueRow > 1) {
      const lastIdCell = sheetQueue.getRange(lastQueueRow, 1).getValue();
      nextRequestId = safeInt_(lastIdCell, 0) + 1;
    }
    
    // Prepare output rows: prepend sequential ID
    const outputRows = deduplicated.map((row, idx) => {
      return [nextRequestId + idx, ...row];
    });
    
    // Write to queue sheet
    if (outputRows.length > 0) {
      const startRow = lastQueueRow + 1;
      const startCol = 1;
      sheetQueue.getRange(startRow, startCol, outputRows.length, outputRows[0].length)
        .setValues(outputRows);
    }
    
    Logger.log('snapshotAltasPendientesToQueue: Processed ' + deduplicated.length + ' ALTA requests');
    return {
      success: true,
      rowsProcessed: deduplicated.length,
      message: 'Snapshot completed: ' + deduplicated.length + ' ALTA requests copied to queue'
    };
    
  } catch (e) {
    Logger.error('snapshotAltasPendientesToQueue ERROR: ' + e.message);
    return { success: false, rowsProcessed: 0, message: 'Error: ' + e.message };
  }
}
