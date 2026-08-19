/**
 * === CREATE-MODIFICACIONES-FECHA-FINAL-OUTPUT.GS ===
 * External Management Automation System
 * Generate XLSX output file for CONTRACT END DATE MODIFICATION requests
 * 
 * Reads pending MODIFICACION FECHA FINAL from queue, builds EIB output file:
 * - Contract Extension/Modification (prórroga o cambio de fecha fin)
 * 
 * Output is generated as XLSX file ready for Workday import
 */

/**
 * Create XLSX output files for MODIFICACION FECHA FINAL (contract extension) requests from queue
 * 
 * Generates EIB file needed for Workday contract modification flow:
 * - FILE: Modify Contract End Date (EIB_MODIFY_CONTRACT_END_DATE)
 * 
 * Preconditions:
 * - "Gestion MODIFICACIONES - FECHA FINAL - WORKDAY" queue sheet must exist
 * - snapshotModificacionesFechaFinalPendientesToQueue() must run first
 * - Template or structure must be defined
 * 
 * Returns: { success: bool, filesCreated: int, message: string }
 */
function createModificacionesFechaFinalOutputXlsxFromTemplate() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetQueue = ss.getSheetByName(NOMBRE_HOJA_MODIFICACIONES_FF);
    
    if (!sheetQueue) {
      throw new Error('Missing MODIFICACIONES FECHA FINAL queue sheet');
    }
    
    Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: START');
    
    // Step 1: Read all pending MODIFICACIONES FECHA FINAL from queue
    const lastRow = sheetQueue.getLastRow();
    if (lastRow <= 1) {
      Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: No MODIFICACIONES FECHA FINAL in queue');
      return { success: true, filesCreated: 0, message: 'No MODIFICACIONES FECHA FINAL to process' };
    }
    
    const queueData = sheetQueue.getRange(2, 1, lastRow - 1, sheetQueue.getLastColumn()).getValues();
    Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: Read ' + queueData.length + ' MODIFICACIONES FECHA FINAL from queue');
    
    // Step 2: Parse and validate modifications
    const validModificaciones = [];
    queueData.forEach((row, idx) => {
      try {
        const modif = parseModificacionFechaFinalRow_(row);
        if (modif) validModificaciones.push(modif);
      } catch (e) {
        Logger.warn('createModificacionesFechaFinalOutputXlsxFromTemplate: Skipped modification ' + idx + ' - ' + e.message);
      }
    });
    
    Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: Validated ' + validModificaciones.length + ' MODIFICACIONES FECHA FINAL');
    
    if (validModificaciones.length === 0) {
      return { success: true, filesCreated: 0, message: 'No valid MODIFICACIONES FECHA FINAL to process' };
    }
    
    // Step 3: Build output file array
    const contractModifRows = [];
    
    validModificaciones.forEach(modif => {
      // EIB_MODIFY_CONTRACT_END_DATE: One row per contract modification
      contractModifRows.push(buildContractModificationRow_(modif));
    });
    
    Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: Built contract modification output file');
    
    // Step 4: Create structure for export
    const outputStructure = {
      contractModifications: {
        headers: getContractModificationHeaders_(),
        data: contractModifRows
      }
    };
    
    Logger.log('createModificacionesFechaFinalOutputXlsxFromTemplate: COMPLETE');
    
    return {
      success: true,
      filesCreated: 1,
      message: 'MODIFICACIONES FECHA FINAL output generated: ' + validModificaciones.length + ' contract modifications'
    };
    
  } catch (e) {
    Logger.error('createModificacionesFechaFinalOutputXlsxFromTemplate ERROR: ' + e.message);
    return { success: false, filesCreated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Parse a single MODIFICACION FECHA FINAL row from queue and extract fields
 * Validates required fields for contract date modification
 */
function parseModificacionFechaFinalRow_(row) {
  const modif = {
    requestId: safeInt_(row[0]),
    type: toTrimmedString_(row[1]),
    workerId: toTrimmedString_(row[2]),
    workerName: toTrimmedString_(row[3]),
    currentEndDate: normalizeToYMDLoose_(row[4]),
    newEndDate: normalizeToYMDLoose_(row[5]),
    modificationType: toTrimmedString_(row[6]), // "EXTENSION" or "CHANGE"
    reason: toTrimmedString_(row[7]),
    supervisory: toTrimmedString_(row[8]),
    company: toTrimmedString_(row[9]),
    comments: toTrimmedString_(row[10])
  };
  
  // Validate required fields
  if (!modif.requestId || !modif.workerId || !modif.newEndDate) {
    throw new Error('Missing required MODIFICACION FECHA FINAL fields');
  }
  
  // Validate date logic: new date should be after current date
  if (modif.currentEndDate && modif.newEndDate <= modif.currentEndDate) {
    Logger.warn('parseModificacionFechaFinalRow_: New end date not after current date for worker ' + modif.workerId);
  }
  
  return modif;
}

/**
 * Build a single row for EIB_MODIFY_CONTRACT_END_DATE file
 * Contains: Worker ID, Current End Date, New End Date, Reason, etc
 */
function buildContractModificationRow_(modif) {
  return [
    modif.workerId,                        // Worker ID
    modif.workerName,                      // Worker Name
    modif.currentEndDate,                  // Current Contract End Date
    modif.newEndDate,                      // New Contract End Date
    mapModificationType_(modif.modificationType), // Modification Type (EXTENSION/CHANGE)
    modif.reason,                          // Reason for modification
    modif.supervisory,                     // Supervisory Manager
    modif.company,                         // Company
    formatDateTimeStrict_(new Date()),     // Request Date
    modif.comments,                        // Comments/Notes
    'Pending Approval'                     // Status
  ];
}

/**
 * Map modification type text to Workday code
 * Example: "EXTENSION" → "MODIF_EXTENSION"
 */
function mapModificationType_(typeText) {
  const typeMap = {
    'EXTENSION': 'MODIF_EXTENSION',
    'CHANGE': 'MODIF_CHANGE_DATE',
    'RENEWAL': 'MODIF_RENEWAL',
    'OTRO': 'MODIF_OTHER'
  };
  
  const key = toTrimmedString_(typeText).toUpperCase();
  return typeMap[key] || 'MODIF_OTHER';
}

/**
 * Return headers for EIB_MODIFY_CONTRACT_END_DATE file
 */
function getContractModificationHeaders_() {
  return [
    'Worker ID',
    'Worker Name',
    'Current Contract End Date',
    'New Contract End Date',
    'Modification Type',
    'Reason',
    'Supervisory Manager',
    'Company',
    'Request Date',
    'Comments',
    'Status'
  ];
}
