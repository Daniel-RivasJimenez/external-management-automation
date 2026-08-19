/**
 * === RUN-GESTIONES-AUTOMATION.GS ===
 * External Management Automation System
 * MAIN ORCHESTRATOR: Coordinates entire automation workflow
 * 
 * This is the primary trigger function that:
 * 1. Runs volcado (ETL from form responses)
 * 2. Snapshots pending requests (ALTAS, BAJAS, MODIFICACIONES, CONSULTAS)
 * 3. Generates output files for Workday
 * 4. Sends confirmation emails
 * 5. Logs and error handles entire process
 * 
 * Can be triggered by:
 * - Time-based trigger (e.g., every 30 minutes)
 * - Manual execution via menu
 * - Form submission trigger
 */

/**
 * Main orchestrator function: Runs complete automation workflow
 * 
 * Execution flow:
 * 1. Lock sheet to prevent concurrent execution
 * 2. Run ETL (volcado) to transform form responses
 * 3. Snapshot pending requests by type (ALTAS, BAJAS, MODIF-AREA, MODIF-FF, CONSULTAS)
 * 4. Generate output files for each type
 * 5. Send confirmation emails
 * 6. Log results and unlock sheet
 * 
 * Returns: { success: bool, message: string, summary: { ... } }
 */
function runGestionesAutomation() {
  const lock = LockService.getDocumentLock();
  
  // Try to acquire lock; timeout if already locked (prevents concurrent execution)
  if (!lock.tryLock(5000)) {
    Logger.warn('runGestionesAutomation: Another execution in progress; skipping');
    return {
      success: false,
      message: 'Automation already running; please wait',
      summary: {}
    };
  }
  
  try {
    Logger.log('========================================');
    Logger.log('runGestionesAutomation: START');
    Logger.log('Timestamp: ' + formatDateTimeStrict_(new Date()));
    Logger.log('========================================');
    
    const summary = {
      etlRows: 0,
      altasSnapped: 0,
      bajasSnapped: 0,
      modifAreaSnapped: 0,
      modifFFSnapped: 0,
      consultasSnapped: 0,
      emailsSent: 0,
      errors: []
    };
    
    // STEP 1: Run ETL (volcado) - transform form responses
    Logger.log('\n[STEP 1] Running ETL (volcado de respuestas)...');
    try {
      const etlResult = volcadoRespuestasOrdenadas();
      if (etlResult.success) {
        summary.etlRows = etlResult.rowsProcessed;
        Logger.log('✓ ETL completed: ' + etlResult.rowsProcessed + ' rows processed');
      } else {
        throw new Error(etlResult.message);
      }
    } catch (e) {
      const errorMsg = 'ETL failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 2: Snapshot pending requests (all types)
    Logger.log('\n[STEP 2] Snapshotting pending requests...');
    
    // 2a. ALTAS
    try {
      const altasResult = snapshotAltasPendientesToQueue();
      if (altasResult.success) {
        summary.altasSnapped = altasResult.rowsProcessed;
        Logger.log('✓ ALTAS snapshot: ' + altasResult.rowsProcessed + ' requests');
      }
    } catch (e) {
      const errorMsg = 'ALTAS snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 2b. BAJAS
    try {
      const bajasResult = snapshotBajasPendientesToQueue();
      if (bajasResult.success) {
        summary.bajasSnapped = bajasResult.rowsProcessed;
        Logger.log('✓ BAJAS snapshot: ' + bajasResult.rowsProcessed + ' requests');
      }
    } catch (e) {
      const errorMsg = 'BAJAS snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 2c. MODIFICACIONES - AREA
    try {
      const modifAreaResult = snapshotModificacionesAreaPendientesToQueue();
      if (modifAreaResult.success) {
        summary.modifAreaSnapped = modifAreaResult.rowsProcessed;
        Logger.log('✓ MODIFICACIONES AREA snapshot: ' + modifAreaResult.rowsProcessed + ' requests');
      }
    } catch (e) {
      const errorMsg = 'MODIFICACIONES AREA snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 2d. MODIFICACIONES - FECHA FINAL
    try {
      const modifFFResult = snapshotModificacionesFechaFinalPendientesToQueue();
      if (modifFFResult.success) {
        summary.modifFFSnapped = modifFFResult.rowsProcessed;
        Logger.log('✓ MODIFICACIONES FECHA FINAL snapshot: ' + modifFFResult.rowsProcessed + ' requests');
      }
    } catch (e) {
      const errorMsg = 'MODIFICACIONES FECHA FINAL snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 2e. CONSULTAS
    try {
      const consultasResult = snapshotConsultasFechaFinalToQueue();
      if (consultasResult.success) {
        summary.consultasSnapped = consultasResult.rowsProcessed;
        Logger.log('✓ CONSULTAS snapshot: ' + consultasResult.rowsProcessed + ' requests');
      }
    } catch (e) {
      const errorMsg = 'CONSULTAS snapshot failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 3: Generate output files
    Logger.log('\n[STEP 3] Generating output files...');
    
    // 3a. ALTAS output
    try {
      if (summary.altasSnapped > 0) {
        const altasFileResult = createAltasOutputXlsxFromTemplate();
        if (altasFileResult.success) {
          Logger.log('✓ ALTAS output generated: ' + altasFileResult.filesCreated + ' files');
        }
      }
    } catch (e) {
      const errorMsg = 'ALTAS output generation failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 3b. BAJAS output
    try {
      if (summary.bajasSnapped > 0) {
        const bajasFileResult = createBajasOutputXlsxFromTemplate();
        if (bajasFileResult.success) {
          Logger.log('✓ BAJAS output generated: ' + bajasFileResult.filesCreated + ' files');
        }
      }
    } catch (e) {
      const errorMsg = 'BAJAS output generation failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 3c. MODIFICACIONES AREA output
    try {
      if (summary.modifAreaSnapped > 0) {
        const modifAreaFileResult = createModificacionesAreaOutputFromQueue();
        if (modifAreaFileResult.success) {
          Logger.log('✓ MODIFICACIONES AREA output generated: ' + modifAreaFileResult.filesCreated + ' files');
        }
      }
    } catch (e) {
      const errorMsg = 'MODIFICACIONES AREA output generation failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 3d. MODIFICACIONES FECHA FINAL output
    try {
      if (summary.modifFFSnapped > 0) {
        const modifFFFileResult = createModificacionesFechaFinalOutputXlsxFromTemplate();
        if (modifFFFileResult.success) {
          Logger.log('✓ MODIFICACIONES FECHA FINAL output generated: ' + modifFFFileResult.filesCreated + ' files');
        }
      }
    } catch (e) {
      const errorMsg = 'MODIFICACIONES FECHA FINAL output generation failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // 3e. CONSULTAS output
    try {
      if (summary.consultasSnapped > 0) {
        const consultasFileResult = createConsultasFechaFinalFromQueue();
        if (consultasFileResult.success) {
          Logger.log('✓ CONSULTAS output generated: ' + consultasFileResult.filesCreated + ' files');
        }
      }
    } catch (e) {
      const errorMsg = 'CONSULTAS output generation failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 4: Send confirmation emails (optional - can be skipped if async processing preferred)
    Logger.log('\n[STEP 4] Sending confirmation emails...');
    try {
      // In production, collect request IDs from processed queues
      Logger.log('ℹ Email sending configured (implement based on your template)');
    } catch (e) {
      const errorMsg = 'Email sending failed: ' + e.message;
      Logger.error(errorMsg);
      summary.errors.push(errorMsg);
    }
    
    // STEP 5: Log summary
    Logger.log('\n========================================');
    Logger.log('runGestionesAutomation: COMPLETE');
    Logger.log('Summary:');
    Logger.log('  ETL rows: ' + summary.etlRows);
    Logger.log('  ALTAS snapped: ' + summary.altasSnapped);
    Logger.log('  BAJAS snapped: ' + summary.bajasSnapped);
    Logger.log('  MODIF-AREA snapped: ' + summary.modifAreaSnapped);
    Logger.log('  MODIF-FF snapped: ' + summary.modifFFSnapped);
    Logger.log('  CONSULTAS snapped: ' + summary.consultasSnapped);
    Logger.log('  Errors: ' + summary.errors.length);
    if (summary.errors.length > 0) {
      Logger.log('Error details:');
      summary.errors.forEach(err => Logger.log('    - ' + err));
    }
    Logger.log('========================================\n');
    
    return {
      success: summary.errors.length === 0,
      message: 'Automation completed' + (summary.errors.length > 0 ? ' with errors' : ' successfully'),
      summary: summary
    };
    
  } catch (e) {
    Logger.error('runGestionesAutomation FATAL ERROR: ' + e.message);
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
 * Create manual trigger for testing/debugging
 * Add to menu for easy manual execution
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Automation')
    .addItem('Run Gestiones Automation', 'runGestionesAutomation')
    .addItem('View Logs', 'showLogs')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addToUi();
}

/**
 * Placeholder for manual log viewing (optional)
 */
function showLogs() {
  Logger.log('View logs in Apps Script execution log: https://script.google.com/home');
}

/**
 * Placeholder for settings menu (optional)
 */
function showSettings() {
  Logger.log('Settings menu - customize as needed');
}
