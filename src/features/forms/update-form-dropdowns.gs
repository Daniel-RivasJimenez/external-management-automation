/**
 * === UPDATE-FORM-DROPDOWNS.GS ===
 * External Management Automation System
 * Dynamic form dropdown updates from master data
 * 
 * Updates Google Form multiple-choice questions with:
 * - Geographic locations (GEOS)
 * - CIB codes (Cost centers)
 * - Departments/Teams
 * - Supervisories
 * - Locations (physical locations)
 * - Termination reasons
 * - Modification reasons
 * 
 * Keeps form dropdowns in sync with master data automatically
 */

/**
 * Generic engine: Update form dropdown by question title or prefix
 * Replaces all choices with new values from master data
 * 
 * Parameters:
 * - form: Google Form object
 * - questionTitleOrPrefix: Question title or prefix to match
 * - newChoices: Array of new choice texts
 * - exactMatch: If true, match exact title; if false, match prefix
 * 
 * Returns: { success: bool, updated: int, message: string }
 */
function updateFormDropdowns_(form, questionTitleOrPrefix, newChoices, exactMatch) {
  if (!form || !questionTitleOrPrefix || !newChoices || newChoices.length === 0) {
    Logger.warn('updateFormDropdowns_: Invalid parameters');
    return { success: false, updated: 0, message: 'Invalid parameters' };
  }
  
  try {
    let updateCount = 0;
    const items = form.getItems();
    
    for (const item of items) {
      if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) continue;
      
      const title = item.getTitle();
      const matches = exactMatch ? (title === questionTitleOrPrefix) : title.includes(questionTitleOrPrefix);
      
      if (!matches) continue;
      
      // Found matching question - update choices
      const choice = item.asMultipleChoiceItem();
      
      // Clear existing choices
      const currentChoices = choice.getChoices();
      for (let i = currentChoices.length - 1; i >= 0; i--) {
        choice.deleteChoice(i);
      }
      
      // Add new choices
      const newChoiceObjects = newChoices.map(text => choice.createChoice(text));
      choice.setChoices(newChoiceObjects);
      
      Logger.log('updateFormDropdowns_: Updated "' + title + '" with ' + newChoices.length + ' choices');
      updateCount++;
    }
    
    return {
      success: true,
      updated: updateCount,
      message: 'Updated ' + updateCount + ' dropdown(s) with ' + newChoices.length + ' new choices'
    };
    
  } catch (e) {
    Logger.error('updateFormDropdowns_ ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update GEOS (geographic locations) dropdown
 * Reads from master data sheet
 */
function updateDropDownGEOS() {
  try {
    Logger.log('updateDropDownGEOS: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    const sheetSupport = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!form || !sheetSupport) {
      throw new Error('Missing form or support data sheet');
    }
    
    // Extract GEOS from master data
    const geos = extractUniqueValues_(sheetSupport, 1); // Column A: GEOS
    
    if (geos.length === 0) {
      Logger.warn('updateDropDownGEOS: No GEOS found in master data');
      return { success: false, updated: 0, message: 'No GEOS data' };
    }
    
    // Update form
    const result = updateFormDropdowns_(form, 'GEOS', geos, false);
    Logger.log('updateDropDownGEOS: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownGEOS ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update CIB (Cost center) codes dropdown
 */
function updateDropDownCIB() {
  try {
    Logger.log('updateDropDownCIB: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    const sheetSupport = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!form || !sheetSupport) {
      throw new Error('Missing form or support data sheet');
    }
    
    // Extract CIB codes from master data
    const cibs = extractUniqueValues_(sheetSupport, 2); // Column B: CIB codes
    
    if (cibs.length === 0) {
      Logger.warn('updateDropDownCIB: No CIB codes found');
      return { success: false, updated: 0, message: 'No CIB data' };
    }
    
    // Update form
    const result = updateFormDropdowns_(form, 'CIB', cibs, false);
    Logger.log('updateDropDownCIB: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownCIB ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update SUPERVISORY dropdown
 */
function updateDropDownSupervisory() {
  try {
    Logger.log('updateDropDownSupervisory: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    const sheetSupport = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!form || !sheetSupport) {
      throw new Error('Missing form or support data sheet');
    }
    
    // Extract supervisories from master data
    const supervisories = extractUniqueValues_(sheetSupport, 3); // Column C: Supervisories
    
    if (supervisories.length === 0) {
      Logger.warn('updateDropDownSupervisory: No supervisories found');
      return { success: false, updated: 0, message: 'No supervisory data' };
    }
    
    // Update form (may appear multiple times in form for different questions)
    const result = updateFormDropdowns_(form, 'Supervisory', supervisories, false);
    Logger.log('updateDropDownSupervisory: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownSupervisory ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update UBICACION (physical location) dropdown
 */
function updateDropDownUbicacion() {
  try {
    Logger.log('updateDropDownUbicacion: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    const sheetSupport = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!form || !sheetSupport) {
      throw new Error('Missing form or support data sheet');
    }
    
    // Extract locations from master data
    const locations = extractUniqueValues_(sheetSupport, 4); // Column D: Locations
    
    if (locations.length === 0) {
      Logger.warn('updateDropDownUbicacion: No locations found');
      return { success: false, updated: 0, message: 'No location data' };
    }
    
    // Update form
    const result = updateFormDropdowns_(form, 'Ubicación', locations, false);
    Logger.log('updateDropDownUbicacion: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownUbicacion ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update termination reasons dropdown
 */
function updateDropDownMotivoBaja() {
  try {
    Logger.log('updateDropDownMotivoBaja: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    const sheetSupport = ss.getSheetByName(NOMBRE_HOJA_DATOS_APOYO);
    
    if (!form || !sheetSupport) {
      throw new Error('Missing form or support data sheet');
    }
    
    // Termination reasons (hardcoded or from master data)
    const reasons = [
      'Despido disciplinario',
      'Despido improcedente',
      'Renuncia voluntaria',
      'Jubilación',
      'Fin de contrato',
      'Mutuo acuerdo',
      'Otro'
    ];
    
    // Update form
    const result = updateFormDropdowns_(form, 'Motivo de Baja', reasons, false);
    Logger.log('updateDropDownMotivoBaja: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownMotivoBaja ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Update modification reasons dropdown
 */
function updateDropDownMotivoModificacion() {
  try {
    Logger.log('updateDropDownMotivoModificacion: START');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const form = FormApp.openById(FORM_ID);
    
    if (!form) {
      throw new Error('Missing form');
    }
    
    // Modification reasons (hardcoded)
    const reasons = [
      'Prórroga de contrato',
      'Cambio de equipo',
      'Cambio de ubicación',
      'Cambio de supervisory',
      'Cambio de función',
      'Otro'
    ];
    
    // Update form
    const result = updateFormDropdowns_(form, 'Motivo de Modificación', reasons, false);
    Logger.log('updateDropDownMotivoModificacion: ' + result.message);
    
    return result;
    
  } catch (e) {
    Logger.error('updateDropDownMotivoModificacion ERROR: ' + e.message);
    return { success: false, updated: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Extract unique values from a column in a sheet
 * Returns array of non-empty, unique values
 */
function extractUniqueValues_(sheet, columnNumber) {
  try {
    const data = sheet.getRange(2, columnNumber, sheet.getLastRow() - 1, 1).getValues();
    const unique = new Set();
    
    data.forEach(row => {
      const value = toTrimmedString_(row[0]);
      if (value) unique.add(value);
    });
    
    return Array.from(unique).sort();
    
  } catch (e) {
    Logger.error('extractUniqueValues_ ERROR: ' + e.message);
    return [];
  }
}

/**
 * Master function: Update ALL form dropdowns at once
 * Call this periodically to keep form in sync with master data
 */
function updateAllFormDropdowns() {
  try {
    Logger.log('\n========================================');
    Logger.log('updateAllFormDropdowns: START');
    Logger.log('========================================\n');
    
    const results = {
      geos: updateDropDownGEOS(),
      cib: updateDropDownCIB(),
      supervisory: updateDropDownSupervisory(),
      ubicacion: updateDropDownUbicacion(),
      motivoBaja: updateDropDownMotivoBaja(),
      motivoModificacion: updateDropDownMotivoModificacion()
    };
    
    Logger.log('\n========================================');
    Logger.log('updateAllFormDropdowns: COMPLETE');
    Logger.log('Summary:');
    Logger.log('  GEOS: ' + (results.geos.success ? 'OK' : 'FAILED'));
    Logger.log('  CIB: ' + (results.cib.success ? 'OK' : 'FAILED'));
    Logger.log('  Supervisory: ' + (results.supervisory.success ? 'OK' : 'FAILED'));
    Logger.log('  Ubicación: ' + (results.ubicacion.success ? 'OK' : 'FAILED'));
    Logger.log('  Motivo Baja: ' + (results.motivoBaja.success ? 'OK' : 'FAILED'));
    Logger.log('  Motivo Modificación: ' + (results.motivoModificacion.success ? 'OK' : 'FAILED'));
    Logger.log('========================================\n');
    
    return {
      success: Object.values(results).every(r => r.success),
      message: 'Form dropdown update completed',
      results: results
    };
    
  } catch (e) {
    Logger.error('updateAllFormDropdowns ERROR: ' + e.message);
    return { success: false, message: 'Error: ' + e.message, results: {} };
  }
}
