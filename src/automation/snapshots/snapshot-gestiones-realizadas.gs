/**
 * === SNAPSHOT-GESTIONES-REALIZADAS.GS ===
 * External Management Automation System
 * Snapshot successfully processed requests to audit sheet
 * 
 * Flow:
 * 1. Read "Ordered Responses" sheet
 * 2. Filter rows where Status = "OK" (successfully processed)
 * 3. Copy to "Gestiones Realizadas - WORKDAY" audit sheet
 * 4. Provides audit trail for compliance and tracking
 */

/**
 * Snapshot successfully processed requests (Status = "OK") to audit sheet
 * Creates permanent record of completed operations
 * Useful for compliance, auditing, and tracking
 * 
 * Preconditions:
 * - "Respuestas Ordenadas - WORKDAY" sheet must exist
 * - "Gestiones Realizadas - WORKDAY" audit sheet must exist
 * - Request must have Status = "OK"
 * 
 * Returns: { success: bool, rowsProcessed: int, message: string }
 */
function snapshotGestionesOK() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetAudit = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_REALIZADAS);
    
    if (!sheetRO || !sheetAudit) {
      throw new Error('Missing required sheets: Ordered Responses or Gestiones Realizadas');
    }
    
    // Resolve column indices dynamically
    const colsRO = resolveCols_(sheetRO, HEADER_ROW_RO, {
      ID_PETICION: { name: 'ID Peticion' },
      STATUS: { name: 'Status' },
      TIMESTAMP: { name: 'Timestamp' }
    }, 'Respuestas Ordenadas');
    
    const lastRow = sheetRO.getLastRow();
    if (lastRow <= HEADER_ROW_RO) {
      Logger.log('snapshotGestionesOK: No data rows');
      return { success: true, rowsProcessed: 0, message: 'No completed requests' };
    }
    
    // Read all data
    const range = sheetRO.getRange(HEADER_ROW_RO + 1, 1, lastRow - HEADER_ROW_RO, sheetRO.getLastColumn());
    const allRows = range.getValues();
    
    // Filter: Status = "OK" (successfully processed)
    const completedRows = allRows.filter(row => {
      const status = toTrimmedString_(row[colsRO.STATUS - 1]);
      return status === 'OK';
    });
    
    if (completedRows.length === 0) {
      Logger.log('snapshotGestionesOK: No completed requests with OK status');
      return { success: true, rowsProcessed: 0, message: 'No completed requests' };
    }
    
    // Get last row in audit sheet
    const lastAuditRow = sheetAudit.getLastRow();
    
    // Write to audit sheet
    if (completedRows.length > 0) {
      const startRow = lastAuditRow + 1;
      const startCol = 1;
      sheetAudit.getRange(startRow, startCol, completedRows.length, completedRows[0].length)
        .setValues(completedRows);
    }
    
    Logger.log('snapshotGestionesOK: Archived ' + completedRows.length + ' completed requests');
    return {
      success: true,
      rowsProcessed: completedRows.length,
      message: 'Snapshot completed: ' + completedRows.length + ' OK requests archived'
    };
    
  } catch (e) {
    Logger.error('snapshotGestionesOK ERROR: ' + e.message);
    return { success: false, rowsProcessed: 0, message: 'Error: ' + e.message };
  }
}
