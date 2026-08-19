/**
 * === VALIDAR-FTES.GS ===
 * External Management Automation System
 * FTE (Full Time Equivalent) validation and consistency checking
 * 
 * Validates:
 * - Sum of FTE by supervisory equals declared total
 * - No negative or invalid FTE values
 * - FTE changes don't exceed thresholds
 * 
 * Actions:
 * - Mark invalid rows as ERROR
 * - Log rejection reason
 * - Delete invalid responses from ordered sheet
 * - Send notification emails to submitters
 */

/**
 * Validate FTE (Full Time Equivalent) consistency across ALTAS requests
 * 
 * Checks:
 * 1. Sum of individual FTE values matches declared total
 * 2. All FTE values are valid (numeric, >= 0)
 * 3. No single FTE exceeds 1.0 (unless specifically allowed)
 * 
 * Preconditions:
 * - "Respuestas Ordenadas - WORKDAY" sheet must exist
 * - "Rechazadas - WORKDAY" sheet must exist
 * - FTE columns must be mapped in constants
 * 
 * Returns: { success: bool, rowsValidated: int, rowsRejected: int, message: string }
 */
function validarFTEs() {
  try {
    Logger.log('validarFTEs: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetRejected = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_RECHAZADAS);
    
    if (!sheetRO || !sheetRejected) {
      throw new Error('Missing required sheets for FTE validation');
    }
    
    // Resolve column indices
    const colsRO = resolveCols_(sheetRO, HEADER_ROW_RO, {
      ID_PETICION: { name: 'ID Peticion' },
      TIPO_GESTION: { name: 'Tipo Gestion' },
      STATUS: { name: 'Status' },
      FTE_TOTAL: { name: 'FTE Total Declarado' },
      FTE_1: { name: 'FTE Item 1' },
      FTE_2: { name: 'FTE Item 2' },
      FTE_3: { name: 'FTE Item 3' },
      SUPERVISORY: { name: 'Supervisory' }
    }, 'Respuestas Ordenadas');
    
    const lastRow = sheetRO.getLastRow();
    const validationResults = [];
    const rejectRows = [];
    let rowsValidated = 0;
    let rowsRejected = 0;
    
    // Step 1: Read all ALTA rows
    for (let i = HEADER_ROW_RO + 1; i <= lastRow; i++) {
      const row = sheetRO.getRange(i, 1, 1, sheetRO.getLastColumn()).getValues()[0];
      
      const tipoGestion = toTrimmedString_(row[colsRO.TIPO_GESTION - 1]);
      if (tipoGestion !== 'ALTA') continue; // Only validate ALTAS
      
      const status = toTrimmedString_(row[colsRO.STATUS - 1]);
      if (status !== '') continue; // Only validate pending (empty status)
      
      try {
        // Step 2: Extract FTE values
        const fteDeclared = parseFloat(String(row[colsRO.FTE_TOTAL - 1])) || 0;
        const fteItems = [
          parseFloat(String(row[colsRO.FTE_1 - 1])) || 0,
          parseFloat(String(row[colsRO.FTE_2 - 1])) || 0,
          parseFloat(String(row[colsRO.FTE_3 - 1])) || 0
        ];
        
        // Step 3: Validate FTE logic
        const validation = validateFTERow_(fteDeclared, fteItems, row[colsRO.SUPERVISORY - 1]);
        
        if (!validation.valid) {
          // Mark row as ERROR
          const requestId = safeInt_(row[colsRO.ID_PETICION - 1]);
          sheetRO.getRange(i, colsRO.STATUS, 1, 1).setValue('ERROR');
          Logger.warn('validarFTEs: Row ' + i + ' rejected - ' + validation.reason);
          
          // Add to rejection sheet
          rejectRows.push({
            requestId: requestId,
            reason: validation.reason,
            row: row,
            rowIndex: i
          });
          
          rowsRejected++;
        } else {
          rowsValidated++;
        }
        
      } catch (e) {
        Logger.error('validarFTEs: Row ' + i + ' validation error - ' + e.message);
        rowsRejected++;
      }
    }
    
    // Step 4: Write rejections to rejection sheet
    if (rejectRows.length > 0) {
      const lastRejectedRow = sheetRejected.getLastRow();
      rejectRows.forEach((rejection, idx) => {
        const startRow = lastRejectedRow + 1 + idx;
        sheetRejected.getRange(startRow, 1).setValue(rejection.requestId);
        sheetRejected.getRange(startRow, 2).setValue('ALTA');
        sheetRejected.getRange(startRow, 7).setValue(rejection.reason); // Error message column
      });
    }
    
    // Step 5: Send rejection notifications (optional)
    if (rejectRows.length > 0) {
      try {
        const requestIds = rejectRows.map(r => r.requestId);
        const errorMessages = rejectRows.map(r => r.reason);
        enviarCorreosRechazadasWorkday('ALTA', requestIds, errorMessages);
      } catch (e) {
        Logger.warn('validarFTEs: Could not send rejection emails - ' + e.message);
      }
    }
    
    Logger.log('validarFTEs: COMPLETE - Validated: ' + rowsValidated + ', Rejected: ' + rowsRejected);
    
    return {
      success: true,
      rowsValidated: rowsValidated,
      rowsRejected: rowsRejected,
      message: 'FTE validation completed: ' + rowsValidated + ' valid, ' + rowsRejected + ' rejected'
    };
    
  } catch (e) {
    Logger.error('validarFTEs ERROR: ' + e.message);
    return { success: false, rowsValidated: 0, rowsRejected: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Validate FTE values for a single row
 * 
 * Rules:
 * 1. Sum of FTE items must equal declared total (within tolerance)
 * 2. No negative FTE values
 * 3. No FTE item > 1.0 (full time equivalent)
 * 4. Declared total must be > 0
 * 
 * Returns: { valid: bool, reason: string }
 */
function validateFTERow_(fteDeclared, fteItems, supervisory) {
  const TOLERANCE = 0.01; // Allow small rounding differences
  const MAX_SINGLE_FTE = 1.0;
  const MIN_FTE = 0;
  
  // Check 1: No negative values
  for (let i = 0; i < fteItems.length; i++) {
    if (fteItems[i] < MIN_FTE) {
      return {
        valid: false,
        reason: 'FTE Item ' + (i + 1) + ' is negative: ' + fteItems[i]
      };
    }
  }
  
  // Check 2: No single FTE > 1.0
  for (let i = 0; i < fteItems.length; i++) {
    if (fteItems[i] > MAX_SINGLE_FTE) {
      return {
        valid: false,
        reason: 'FTE Item ' + (i + 1) + ' exceeds maximum (1.0): ' + fteItems[i]
      };
    }
  }
  
  // Check 3: Sum of items matches declared total
  const fteSum = fteItems.reduce((a, b) => a + b, 0);
  const difference = Math.abs(fteSum - fteDeclared);
  
  if (difference > TOLERANCE) {
    return {
      valid: false,
      reason: 'FTE sum mismatch: Items sum to ' + fteSum.toFixed(2) + ' but declared total is ' + fteDeclared.toFixed(2) + ' (difference: ' + difference.toFixed(2) + ')'
    };
  }
  
  // Check 4: Declared total > 0
  if (fteDeclared <= 0) {
    return {
      valid: false,
      reason: 'FTE Total declared must be greater than 0, got: ' + fteDeclared
    };
  }
  
  // All checks passed
  return { valid: true, reason: '' };
}

/**
 * Validate FTE threshold for a supervisory
 * (Optional: Check if supervisory's total FTE doesn't exceed limits)
 * 
 * Returns: { valid: bool, message: string }
 */
function validateSupervisoryFTELimit_(supervisory, sheet, maxFTEPerSupervisory) {
  const maxFTE = maxFTEPerSupervisory || 10; // Default limit
  
  const colsRO = resolveCols_(sheet, HEADER_ROW_RO, {
    SUPERVISORY: { name: 'Supervisory' },
    FTE_TOTAL: { name: 'FTE Total Declarado' },
    TIPO_GESTION: { name: 'Tipo Gestion' },
    STATUS: { name: 'Status' }
  }, 'Respuestas Ordenadas');
  
  const data = sheet.getRange(HEADER_ROW_RO + 1, 1, sheet.getLastRow() - HEADER_ROW_RO, sheet.getLastColumn()).getValues();
  
  let totalFTE = 0;
  data.forEach(row => {
    const rowSupervisory = toTrimmedString_(row[colsRO.SUPERVISORY - 1]);
    const tipoGestion = toTrimmedString_(row[colsRO.TIPO_GESTION - 1]);
    const status = toTrimmedString_(row[colsRO.STATUS - 1]);
    
    if (rowSupervisory === supervisory && tipoGestion === 'ALTA' && status === '') {
      totalFTE += parseFloat(String(row[colsRO.FTE_TOTAL - 1])) || 0;
    }
  });
  
  if (totalFTE > maxFTE) {
    return {
      valid: false,
      message: 'FTE limit exceeded for supervisory ' + supervisory + ': ' + totalFTE.toFixed(2) + ' > ' + maxFTE
    };
  }
  
  return { valid: true, message: '' };
}
