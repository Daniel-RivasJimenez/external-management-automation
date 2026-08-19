/**
 * === RUN-CONFIRMACIONES-AUTOMATION.GS ===
 * External Management Automation System
 * CONFIRMATIONS ORCHESTRATOR: Handles post-processing confirmations
 * 
 * This secondary trigger function:
 * 1. Snapshots successfully processed requests (Status = OK)
 * 2. Snapshots failed/rejected requests (Status = ERROR)
 * 3. Sends confirmation emails for OK requests
 * 4. Sends rejection emails for ERROR requests
 * 5. Archives processed records
 * 
 * Runs AFTER main automation (runGestionesAutomation)
 * Can be triggered by:
 * - Time-based trigger (e.g., every hour)
 * - Manual execution via menu
 * - Chained from main automation
 */

/**
 * Confirmations orchestrator: Process and send notifications for completed/failed requests
 * 
 * Execution flow:
 * 1. Lock sheet to prevent concurrent execution
 * 2. Snapshot OK requests to "Gestiones Realizadas" audit sheet
 * 3. Snapshot ERROR requests to "Rechazadas" error sheet
 * 4. Send confirmation emails for OK requests
 * 5. Send rejection emails for ERROR requests
 * 6. Log results and unlock sheet
 * 
 * Returns: { success: bool, message: string, summary: { ... } }
 */
function runConfirmacionesAutomation() {
  const lock = LockService.getDocumentLock();
  
  // Try to acquire lock; timeout if already locked
  if (!lock.tryLock(5000)) {
    Logger.warn('runConfirmacionesAutomation: Another execution in progress; skipping');
    return {
      success: false,
      message: 'Confirmations automation already running; please wait',
      summary: {}
    };
  }
  
  try {
    Logger.log('========================================');
    Logger.log('runConfirmacionesAutomation: START');
    Logger.log('Timestamp: ' + formatDateTimeStrict_(new Date()));
    Logger.log('========================================');
    
    const summary = {
      okSnapped: 0,
      errorSnapped: 0,
      confirmationsSent: 0,
      rejectionsSent: 0,
      errors: []
    };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRO = ss.getSheetByName(NOMBRE_HOJA_RESPUESTAS_ORDENADAS);
    const sheetGestionsOK = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_REALIZADAS);
    const sheetGestionsRejected = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_RECHAZADAS);
    
    if (!sheetRO || !sheetGestionsOK || !sheetGestionsRejected) {
      throw new Error('Missing required sheets for confirmations');
    }
    
    // STEP 1: Snapshot OK requests (Status = "OK")
    Logger.log('\n[STEP 1] Snapshotting OK requests...');
    try {
      const okResult = snapshotGestionesOK();
      if (okResult.success) {
        summary.okSnapped = okResult.rowsProcessed;
        Logger.log('✓ OK snapshot: ' + okResult.rowsProcessed + ' requests archived');
      }
    } catch (e) {
      const errorMsg = 'OK snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 2: Snapshot ERROR requests (Status = "ERROR")
    Logger.log('\n[STEP 2] Snapshotting ERROR requests...');
    try {
      const errorResult = snapshotGestionesRechazadas();
      if (errorResult.success) {
        summary.errorSnapped = errorResult.rowsProcessed;
        Logger.log('✓ ERROR snapshot: ' + errorResult.rowsProcessed + ' requests logged');
      }
    } catch (e) {
      const errorMsg = 'ERROR snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 3: Send confirmation emails for OK requests
    Logger.log('\n[STEP 3] Sending confirmation emails...');
    try {
      if (summary.okSnapped > 0) {
        // Collect OK request IDs from "Gestiones Realizadas"
        const okRequestIds = collectRequestIds_(sheetGestionsOK, 'OK');
        
        if (okRequestIds.length > 0) {
          // Send emails by type (ALTA, BAJA, MODIFICACION)
          const altasIds = filterByType_(okRequestIds, sheetGestionsOK, 'ALTA');
          const bajasIds = filterByType_(okRequestIds, sheetGestionsOK, 'BAJA');
          const modifIds = filterByType_(okRequestIds, sheetGestionsOK, 'MODIFICACION');
          
          if (altasIds.length > 0) {
            const emailResult = enviarCorreosGestionRealizadaWorkday('ALTA', altasIds, []);
            if (emailResult.success) {
              summary.confirmationsSent += emailResult.emailsSent;
              Logger.log('✓ ALTAS confirmations sent: ' + emailResult.emailsSent);
            }
          }
          
          if (bajasIds.length > 0) {
            const emailResult = enviarCorreosGestionRealizadaWorkday('BAJA', bajasIds, []);
            if (emailResult.success) {
              summary.confirmationsSent += emailResult.emailsSent;
              Logger.log('✓ BAJAS confirmations sent: ' + emailResult.emailsSent);
            }
          }
          
          if (modifIds.length > 0) {
            const emailResult = enviarCorreosGestionRealizadaWorkday('MODIFICACION', modifIds, []);
            if (emailResult.success) {
              summary.confirmationsSent += emailResult.emailsSent;
              Logger.log('✓ MODIFICACIONES confirmations sent: ' + emailResult.emailsSent);
            }
          }
        }
      }
    } catch (e) {
      const errorMsg = 'Confirmation emails failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 4: Send rejection emails for ERROR requests
    Logger.log('\n[STEP 4] Sending rejection emails...');
    try {
      if (summary.errorSnapped > 0) {
        // Collect ERROR request IDs from "Rechazadas"
        const errorRequestIds = collectRequestIds_(sheetGestionsRejected, 'ERROR');
        
        if (errorRequestIds.length > 0) {
          // Collect error messages in parallel array
          const errorMessages = collectErrorMessages_(errorRequestIds, sheetGestionsRejected);
          
          // Send rejection emails by type
          const altasIds = filterByType_(errorRequestIds, sheetGestionsRejected, 'ALTA');
          const bajasIds = filterByType_(errorRequestIds, sheetGestionsRejected, 'BAJA');
          const modifIds = filterByType_(errorRequestIds, sheetGestionsRejected, 'MODIFICACION');
          
          if (altasIds.length > 0) {
            const emailResult = enviarCorreosRechazadasWorkday('ALTA', altasIds, 
              filterErrorMessages_(altasIds, errorRequestIds, errorMessages));
            if (emailResult.success) {
              summary.rejectionsSent += emailResult.emailsSent;
              Logger.log('✓ ALTAS rejections sent: ' + emailResult.emailsSent);
            }
          }
          
          if (bajasIds.length > 0) {
            const emailResult = enviarCorreosRechazadasWorkday('BAJA', bajasIds,
              filterErrorMessages_(bajasIds, errorRequestIds, errorMessages));
            if (emailResult.success) {
              summary.rejectionsSent += emailResult.emailsSent;
              Logger.log('✓ BAJAS rejections sent: ' + emailResult.emailsSent);
            }
          }
          
          if (modifIds.length > 0) {
            const emailResult = enviarCorreosRechazadasWorkday('MODIFICACION', modifIds,
              filterErrorMessages_(modifIds, errorRequestIds, errorMessages));
            if (emailResult.success) {
              summary.rejectionsSent += emailResult.emailsSent;
              Logger.log('✓ MODIFICACIONES rejections sent: ' + emailResult.emailsSent);
            }
          }
        }
      }
    } catch (e) {
      const errorMsg = 'Rejection emails failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 5: Log summary
    Logger.log('\n========================================');
    Logger.log('runConfirmacionesAutomation: COMPLETE');
    Logger.log('Summary:');
    Logger.log('  OK requests snapped: ' + summary.okSnapped);
    Logger.log('  ERROR requests snapped: ' + summary.errorSnapped);
    Logger.log('  Confirmations sent: ' + summary.confirmationsSent);
    Logger.log('  Rejections sent: ' + summary.rejectionsSent);
    Logger.log('  Errors: ' + summary.errors.length);
    if (summary.errors.length > 0) {
      Logger.log('Error details:');
      summary.errors.forEach(err => Logger.log('    - ' + err));
    }
    Logger.log('========================================\n');
    
    return {
      success: summary.errors.length === 0,
      message: 'Confirmations automation completed' + (summary.errors.length > 0 ? ' with errors' : ' successfully'),
      summary: summary
    };
    
  } catch (e) {
    Logger.error('runConfirmacionesAutomation FATAL ERROR: ' + e.message);
    return {
      success: false,
      message: 'Fatal error: ' + e.message,
      summary: { errors: [e.message] }
    };
  } finally {
    // Always release lock
    try {
      lock.releaseLock();
      Logger.log('Lock released');
    } catch (e) {
      Logger.error('Error releasing lock: ' + e.message);
    }
  }
}

/**
 * Collect request IDs from a sheet by status
 */
function collectRequestIds_(sheet, status) {
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const ids = [];
  
  data.forEach(row => {
    const id = safeInt_(row[0]);
    const rowStatus = toTrimmedString_(row[5]); // Assuming column 6 is status
    if (rowStatus === status && id > 0) {
      ids.push(id);
    }
  });
  
  return ids;
}

/**
 * Filter request IDs by type (ALTA, BAJA, MODIFICACION)
 */
function filterByType_(requestIds, sheet, type) {
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const filtered = [];
  
  requestIds.forEach(id => {
    for (const row of data) {
      if (safeInt_(row[0]) === id) {
        if (toTrimmedString_(row[1]) === type) { // Assuming column 2 is type
          filtered.push(id);
        }
        break;
      }
    }
  });
  
  return filtered;
}

/**
 * Collect error messages in parallel with request IDs
 */
function collectErrorMessages_(requestIds, sheet) {
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const messages = [];
  
  requestIds.forEach(id => {
    for (const row of data) {
      if (safeInt_(row[0]) === id) {
        messages.push(toTrimmedString_(row[6])); // Assuming column 7 is error message
        break;
      }
    }
  });
  
  return messages;
}

/**
 * Filter error messages corresponding to filtered request IDs
 */
function filterErrorMessages_(filteredIds, allIds, allMessages) {
  return filteredIds.map(id => {
    const idx = allIds.indexOf(id);
    return idx >= 0 ? allMessages[idx] : '';
  });
}
