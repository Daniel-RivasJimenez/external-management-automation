/**
 * === SNAPSHOT-GESTIONES-RECHAZADAS.GS ===
 * External Management Automation System
 * Snapshot rejected/failed requests to error tracking sheet
 * 
 * Flow:
 * 1. Read "Ordered Responses" sheet
 * 2. Filter rows where Status = "ERROR" (validation or processing failed)
 * 3. Copy to "Rechazadas - WORKDAY" error tracking sheet
 * 4. Provides visibility into failures for investigation
 */

/**
 * Snapshot rejected/failed requests (Status = "ERROR") to error tracking sheet
 * Creates permanent record of failed operations for analysis
 * Helps identify validation issues and data problems
 * 
 * Preconditions:
 * - "Respuestas Ordenadas - WORKDAY" sheet must exist
 * - "Rechazadas - WORKDAY" error tracking sheet must exist
 * - Request must have Status = "ERROR"
 * 
 * Returns: { success: bool, rowsProcessed: int, message: string }
 */
function snapshotGestionesRechazadas() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetRejected = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_RECHAZADAS);
    
    if (!sheetRO || !sheetRejected) {
      throw new Error('Missing required sheets: Ordered Responses or Rechazadas');
    }
    
    // Resolve column indices dynamically
    const colsRO = resolveCols_(sheetRO, HEADER_ROW_RO, {
      ID_PETICION: { name: 'ID Peticion' },
      STATUS: { name: 'Status' },
      TIMESTAMP: { name: 'Timestamp' },
      ERROR_MSG: { name: 'Error Message' }
    }, 'Respuestas Ordenadas');
    
    const lastRow = sheetRO.getLastRow();
    if (lastRow <= HEADER_ROW_RO) {
      Logger.log('snapshotGestionesRechazadas: No data rows');
      return { success: true, rowsProcessed: 0, message: 'No rejected requests' };
    }
    
    // Read all data
    const range = sheetRO.getRange(HEADER_ROW_RO + 1, 1, lastRow - HEADER_ROW_RO, sheetRO.getLastColumn());
    const allRows = range.getValues();
    
    // Filter: Status = "ERROR" (rejected/failed)
    const rejectedRows = allRows.filter(row => {
      const status = toTrimmedString_(row[colsRO.STATUS - 1]);
      return status === 'ERROR';
    });
    
    if (rejectedRows.length === 0) {
      Logger.log('snapshotGestionesRechazadas: No rejected requests with ERROR status');
      return { success: true, rowsProcessed: 0, message: 'No rejected requests' };
    }
    
    // Get last row in error tracking sheet
    const lastRejectedRow = sheetRejected.getLastRow();
    
    // Write to error tracking sheet
    if (rejectedRows.length > 0) {
      const startRow = lastRejectedRow + 1;
      const startCol = 1;
      sheetRejected.getRange(startRow, startCol, rejectedRows.length, rejectedRows[0].length)
        .setValues(rejectedRows);
    }
    
    Logger.log('snapshotGestionesRechazadas: Logged ' + rejectedRows.length + ' rejected requests');
    return {
      success: true,
      rowsProcessed: rejectedRows.length,
      message: 'Snapshot completed: ' + rejectedRows.length + ' ERROR requests logged'
    };
    
  } catch (e) {
    Logger.error('snapshotGestionesRechazadas ERROR: ' + e.message);
    return { success: false, rowsProcessed: 0, message: 'Error: ' + e.message };
  }
}
