/**
 * === SNAPSHOT-CONSULTAS.GS ===
 * External Management Automation System
 * Read pending QUERY (CONSULTAS) requests for contract end dates and snapshot to queue
 * 
 * Flow:
 * 1. Read "Ordered Responses" sheet
 * 2. Filter rows where Type = "CONSULTA" AND Status = "" (pending)
 * 3. Deduplicate by timestamp
 * 4. Assign sequential IDs
 * 5. Write to "Gestion CONSULTAS - WORKDAY" queue sheet
 */

/**
 * Snapshot pending CONSULTA (query/info request) from ordered responses
 * Deduplicates by timestamp; skips if already processed
 * Assigns sequential request IDs
 * 
 * Preconditions:
 * - "Respuestas Ordenadas - WORKDAY" sheet must exist
 * - "Gestion CONSULTAS - WORKDAY" queue sheet must exist
 * - volcadoRespuestasOrdenadas() must run first
 * 
 * Returns: { success: bool, rowsProcessed: int, message: string }
 */
function snapshotConsultasFechaFinalToQueue() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetQueue = ss.getSheetByName(NOMBRE_HOJA_CONSULTA);
    
    if (!sheetRO || !sheetQueue) {
      throw new Error('Missing required sheets: Ordered Responses or CONSULTAS queue');
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
      Logger.log('snapshotConsultasFechaFinalToQueue: No data rows');
      return { success: true, rowsProcessed: 0, message: 'No pending requests' };
    }
    
    // Read all data
    const range = sheetRO.getRange(HEADER_ROW_RO + 1, 1, lastRow - HEADER_ROW_RO, sheetRO.getLastColumn());
    const allRows = range.getValues();
    
    // Filter: Type = "CONSULTA" AND Status = "" (pending)
    const pendingConsultas = allRows.filter(row => {
      const tipoGestion = toTrimmedString_(row[colsRO.TIPO_GESTION - 1]);
      const status = toTrimmedString_(row[colsRO.STATUS - 1]);
      return tipoGestion === 'CONSULTA' && status === '';
    });
    
    if (pendingConsultas.length === 0) {
      Logger.log('snapshotConsultasFechaFinalToQueue: No pending CONSULTA requests');
      return { success: true, rowsProcessed: 0, message: 'No pending CONSULTA requests' };
    }
    
    // Deduplicate by timestamp
    const seen = new Set();
    const deduplicated = [];
    pendingConsultas.forEach(row => {
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
    
    Logger.log('snapshotConsultasFechaFinalToQueue: Processed ' + deduplicated.length + ' CONSULTA requests');
    return {
      success: true,
      rowsProcessed: deduplicated.length,
      message: 'Snapshot completed: ' + deduplicated.length + ' CONSULTA requests copied to queue'
    };
    
  } catch (e) {
    Logger.error('snapshotConsultasFechaFinalToQueue ERROR: ' + e.message);
    return { success: false, rowsProcessed: 0, message: 'Error: ' + e.message };
  }
}
