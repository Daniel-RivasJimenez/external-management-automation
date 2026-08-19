/**
 * === CREATE-MODIFICACIONES-AREA-OUTPUT.GS ===
 * External Management Automation System
 * Generate XLSX output file for AREA MODIFICATION requests
 * 
 * Reads pending MODIFICACION AREA from queue, builds 2 EIB output files:
 * 1. Move Worker (cambiar ubicación de trabajador)
 * 2. Change Org Assignment (cambiar asignación organizacional)
 * 
 * Output is generated as XLSX files ready for Workday import
 */

/**
 * Create XLSX output files for MODIFICACION AREA (team change) requests from queue
 * 
 * Generates 2 separate EIB files needed for Workday area/team change flow:
 * - FILE 1: Move Worker (EIB_MOVE_WORKER)
 * - FILE 2: Change Org Assignment (EIB_CHANGE_ORG)
 * 
 * Preconditions:
 * - "Gestion MODIFICACIONES - AREA - WORKDAY" queue sheet must exist
 * - snapshotModificacionesAreaPendientesToQueue() must run first
 * - Template or structure must be defined
 * 
 * Returns: { success: bool, filesCreated: int, message: string }
 */
function createModificacionesAreaOutputFromQueue() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetQueue = ss.getSheetByName(NOMBRE_HOJA_MODIFICACIONES_AREA);
    
    if (!sheetQueue) {
      throw new Error('Missing MODIFICACIONES AREA queue sheet');
    }
    
    Logger.log('createModificacionesAreaOutputFromQueue: START');
    
    // Step 1: Read all pending MODIFICACIONES AREA from queue
    const lastRow = sheetQueue.getLastRow();
    if (lastRow <= 1) {
      Logger.log('createModificacionesAreaOutputFromQueue: No MODIFICACIONES AREA in queue');
      return { success: true, filesCreated: 0, message: 'No MODIFICACIONES AREA to process' };
    }
    
    const queueData = sheetQueue.getRange(2, 1, lastRow - 1, sheetQueue.getLastColumn()).getValues();
    Logger.log('createModificacionesAreaOutputFromQueue: Read ' + queueData.length + ' MODIFICACIONES AREA from queue');
    
    // Step 2: Parse and validate modifications
    const validModificaciones = [];
    queueData.forEach((row, idx) => {
      try {
        const modif = parseModificacionAreaRow_(row);
        if (modif) validModificaciones.push(modif);
      } catch (e) {
        Logger.warn('createModificacionesAreaOutputFromQueue: Skipped modification ' + idx + ' - ' + e.message);
      }
    });
    
    Logger.log('createModificacionesAreaOutputFromQueue: Validated ' + validModificaciones.length + ' MODIFICACIONES AREA');
    
    if (validModificaciones.length === 0) {
      return { success: true, filesCreated: 0, message: 'No valid MODIFICACIONES AREA to process' };
    }
    
    // Step 3: Build 2 output file arrays
    const moveWorkerRows = [];
    const changeOrgRows = [];
    
    validModificaciones.forEach(modif => {
      // EIB_MOVE_WORKER: One row per worker move
      moveWorkerRows.push(buildMoveWorkerRow_(modif));
      
      // EIB_CHANGE_ORG: One row per org assignment change
      changeOrgRows.push(buildChangeOrgRow_(modif));
    });
    
    Logger.log('createModificacionesAreaOutputFromQueue: Built 2 output files');
    
    // Step 4: Create structure for export
    const outputStructure = {
      moveWorkers: {
        headers: getMoveWorkerHeaders_(),
        data: moveWorkerRows
      },
      changeOrgs: {
        headers: getChangeOrgHeaders_(),
        data: changeOrgRows
      }
    };
    
    Logger.log('createModificacionesAreaOutputFromQueue: COMPLETE');
    
    return {
      success: true,
      filesCreated: 2,
      message: 'MODIFICACIONES AREA output generated: ' + validModificaciones.length + ' area changes'
    };
    
  } catch (e) {
    Logger.error('createModificacionesAreaOutputFromQueue ERROR: ' + e.message);
    return { success: false, filesCreated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Parse a single MODIFICACION AREA row from queue and extract fields
 * Validates required fields
 */
function parseModificacionAreaRow_(row) {
  const modif = {
    requestId: safeInt_(row[0]),
    type: toTrimmedString_(row[1]),
    workerId: toTrimmedString_(row[2]),
    workerName: toTrimmedString_(row[3]),
    currentDepartment: toTrimmedString_(row[4]),
    newDepartment: toTrimmedString_(row[5]),
    currentTeam: toTrimmedString_(row[6]),
    newTeam: toTrimmedString_(row[7]),
    currentLocation: toTrimmedString_(row[8]),
    newLocation: toTrimmedString_(row[9]),
    effectiveDate: normalizeToYMDLoose_(row[10]),
    supervisory: toTrimmedString_(row[11]),
    company: toTrimmedString_(row[12]),
    comments: toTrimmedString_(row[13])
  };
  
  // Validate required fields
  if (!modif.requestId || !modif.workerId || !modif.newDepartment) {
    throw new Error('Missing required MODIFICACION AREA fields');
  }
  
  return modif;
}

/**
 * Build a single row for EIB_MOVE_WORKER file
 * Contains: Worker ID, Current Location, New Location, Effective Date, etc
 */
function buildMoveWorkerRow_(modif) {
  return [
    modif.workerId,                        // Worker ID
    modif.workerName,                      // Worker Name
    modif.currentLocation,                 // Current Location
    modif.newLocation,                     // New Location
    modif.effectiveDate,                   // Effective Date
    modif.supervisory,                     // Supervisory Manager
    modif.company,                         // Company
    'Pending Approval'                     // Status
  ];
}

/**
 * Build a single row for EIB_CHANGE_ORG file
 * Contains: Worker ID, Current Department, New Department, etc
 */
function buildChangeOrgRow_(modif) {
  return [
    modif.workerId,                        // Worker ID
    modif.workerName,                      // Worker Name
    modif.currentDepartment,               // Current Department
    modif.newDepartment,                   // New Department
    modif.currentTeam,                     // Current Team
    modif.newTeam,                         // New Team
    modif.effectiveDate,                   // Effective Date
    modif.supervisory,                     // Supervisory Manager
    modif.comments,                        // Comments/Notes
    'Pending Approval'                     // Status
  ];
}

/**
 * Return headers for EIB_MOVE_WORKER file
 */
function getMoveWorkerHeaders_() {
  return [
    'Worker ID',
    'Worker Name',
    'Current Location',
    'New Location',
    'Effective Date',
    'Supervisory Manager',
    'Company',
    'Status'
  ];
}

/**
 * Return headers for EIB_CHANGE_ORG file
 */
function getChangeOrgHeaders_() {
  return [
    'Worker ID',
    'Worker Name',
    'Current Department',
    'New Department',
    'Current Team',
    'New Team',
    'Effective Date',
    'Supervisory Manager',
    'Comments',
    'Status'
  ];
}
