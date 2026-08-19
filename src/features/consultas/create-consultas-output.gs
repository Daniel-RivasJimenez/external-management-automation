/**
 * === CREATE-CONSULTAS-OUTPUT.GS ===
 * External Management Automation System
 * Generate output file for QUERY (CONSULTAS) requests for contract end dates
 * 
 * Reads pending CONSULTAS from queue, builds output file with:
 * - Contract end date information by supervisory/team
 * - Worker name and ID
 * - Current status
 * 
 * Output is generated as structured data ready for email delivery to requesters
 */

/**
 * Create output file for CONSULTA (contract end date query) requests from queue
 * 
 * Generates query response file containing:
 * - FILE: Contract End Date Query Results (EIB_CONSULTA_FECHAS)
 * 
 * Preconditions:
 * - "Gestion CONSULTAS - WORKDAY" queue sheet must exist
 * - snapshotConsultasFechaFinalToQueue() must run first
 * - Contract master data sheet must be available for lookups
 * 
 * Returns: { success: bool, filesCreated: int, message: string }
 */
function createConsultasFechaFinalFromQueue() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetQueue = ss.getSheetByName(NOMBRE_HOJA_CONSULTA);
    const sheetMaster = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!sheetQueue || !sheetMaster) {
      throw new Error('Missing required sheets: CONSULTAS queue or Master data');
    }
    
    Logger.log('createConsultasFechaFinalFromQueue: START');
    
    // Step 1: Read all pending CONSULTAS from queue
    const lastRow = sheetQueue.getLastRow();
    if (lastRow <= 1) {
      Logger.log('createConsultasFechaFinalFromQueue: No CONSULTAS in queue');
      return { success: true, filesCreated: 0, message: 'No CONSULTAS to process' };
    }
    
    const queueData = sheetQueue.getRange(2, 1, lastRow - 1, sheetQueue.getLastColumn()).getValues();
    Logger.log('createConsultasFechaFinalFromQueue: Read ' + queueData.length + ' CONSULTAS from queue');
    
    // Step 2: Parse and validate queries
    const validConsultas = [];
    queueData.forEach((row, idx) => {
      try {
        const consulta = parseConsultaRow_(row);
        if (consulta) validConsultas.push(consulta);
      } catch (e) {
        Logger.warn('createConsultasFechaFinalFromQueue: Skipped CONSULTA ' + idx + ' - ' + e.message);
      }
    });
    
    Logger.log('createConsultasFechaFinalFromQueue: Validated ' + validConsultas.length + ' CONSULTAS');
    
    if (validConsultas.length === 0) {
      return { success: true, filesCreated: 0, message: 'No valid CONSULTAS to process' };
    }
    
    // Step 3: Build output file array with contract end date info
    const consultaResultRows = [];
    
    validConsultas.forEach(consulta => {
      // Lookup contract end date from master data
      const contractInfo = lookupContractEndDate_(consulta.workerId, sheetMaster);
      
      // EIB_CONSULTA_FECHAS: One row per query result
      consultaResultRows.push(buildConsultaResultRow_(consulta, contractInfo));
    });
    
    Logger.log('createConsultasFechaFinalFromQueue: Built query results file');
    
    // Step 4: Create structure for export
    const outputStructure = {
      consultaResults: {
        headers: getConsultaResultHeaders_(),
        data: consultaResultRows
      }
    };
    
    Logger.log('createConsultasFechaFinalFromQueue: COMPLETE');
    
    return {
      success: true,
      filesCreated: 1,
      message: 'CONSULTAS output generated: ' + validConsultas.length + ' contract end date queries resolved'
    };
    
  } catch (e) {
    Logger.error('createConsultasFechaFinalFromQueue ERROR: ' + e.message);
    return { success: false, filesCreated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Parse a single CONSULTA row from queue and extract fields
 * Validates required fields for query
 */
function parseConsultaRow_(row) {
  const consulta = {
    requestId: safeInt_(row[0]),
    type: toTrimmedString_(row[1]),
    workerId: toTrimmedString_(row[2]),
    workerName: toTrimmedString_(row[3]),
    requestingManager: toTrimmedString_(row[4]),
    requestDate: normalizeToYMDLoose_(row[5]),
    supervisory: toTrimmedString_(row[6]),
    company: toTrimmedString_(row[7]),
    queryType: toTrimmedString_(row[8]) // "BY_WORKER", "BY_SUPERVISORY", "BY_TEAM"
  };
  
  // Validate required fields
  if (!consulta.requestId || !consulta.requestDate) {
    throw new Error('Missing required CONSULTA fields');
  }
  
  return consulta;
}

/**
 * Lookup contract end date and relevant info from master data sheet
 * Returns: { workerId, name, currentEndDate, daysUntilEnd, status }
 */
function lookupContractEndDate_(workerId, sheetMaster) {
  const masterData = sheetMaster.getRange(2, 1, sheetMaster.getLastRow() - 1, sheetMaster.getLastColumn()).getValues();
  
  for (const row of masterData) {
    const id = toTrimmedString_(row[0]);
    if (id === workerId) {
      const endDate = normalizeToYMDLoose_(row[2]);
      const endDateObj = new Date(endDate + 'T00:00:00Z');
      const today = new Date();
      const daysUntilEnd = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));
      
      return {
        workerId: id,
        name: toTrimmedString_(row[1]),
        currentEndDate: endDate,
        daysUntilEnd: daysUntilEnd,
        status: daysUntilEnd <= 0 ? 'EXPIRED' : (daysUntilEnd <= 30 ? 'EXPIRING_SOON' : 'ACTIVE')
      };
    }
  }
  
  // If not found, return placeholder
  return {
    workerId: workerId,
    name: '',
    currentEndDate: '',
    daysUntilEnd: 0,
    status: 'NOT_FOUND'
  };
}

/**
 * Build a single row for EIB_CONSULTA_FECHAS file
 * Contains: Worker ID, Name, Current End Date, Days Until End, Status, etc
 */
function buildConsultaResultRow_(consulta, contractInfo) {
  return [
    consulta.requestId,                    // Request ID
    contractInfo.workerId,                 // Worker ID
    contractInfo.name,                     // Worker Name
    contractInfo.currentEndDate,           // Current Contract End Date
    contractInfo.daysUntilEnd,             // Days Until End (calculated)
    contractInfo.status,                   // Status (ACTIVE, EXPIRING_SOON, EXPIRED)
    consulta.requestingManager,            // Requesting Manager
    consulta.supervisory,                  // Supervisory
    consulta.company,                      // Company
    consulta.requestDate,                  // Request Date
    formatDateTimeStrict_(new Date())      // Response Date
  ];
}

/**
 * Return headers for EIB_CONSULTA_FECHAS file
 */
function getConsultaResultHeaders_() {
  return [
    'Request ID',
    'Worker ID',
    'Worker Name',
    'Current Contract End Date',
    'Days Until End',
    'Contract Status',
    'Requesting Manager',
    'Supervisory',
    'Company',
    'Request Date',
    'Response Date'
  ];
}
