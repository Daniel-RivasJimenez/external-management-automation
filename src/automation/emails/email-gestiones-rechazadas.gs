/**
 * === EMAIL-GESTIONES-RECHAZADAS.GS ===
 * External Management Automation System
 * Send HTML email notifications for rejected/failed requests
 * 
 * Triggers when:
 * - Validation fails (missing fields, invalid data)
 * - Processing error occurs
 * - Request marked as Status = "ERROR"
 * 
 * Sends HTML formatted error emails with:
 * - Error description
 * - Validation failures details
 * - Required corrections
 * - Resubmission instructions
 */

/**
 * Send rejection emails for failed/rejected requests
 * Called when request validation fails or processing error occurs
 * 
 * Preconditions:
 * - Request must have Status = "ERROR"
 * - Error message must be captured
 * - Email recipient must be defined or use default
 * 
 * Parameters:
 * - tipoGestion: "ALTA" | "BAJA" | "MODIFICACION"
 * - requestIds: Array of request IDs that failed
 * - errorMessages: Array of error descriptions (parallel to requestIds)
 * 
 * Returns: { success: bool, emailsSent: int, message: string }
 */
function enviarCorreosRechazadasWorkday(tipoGestion, requestIds, errorMessages) {
  try {
    if (!tipoGestion || !requestIds || requestIds.length === 0) {
      Logger.log('enviarCorreosRechazadasWorkday: Missing parameters');
      return { success: false, emailsSent: 0, message: 'Missing required parameters' };
    }
    
    Logger.log('enviarCorreosRechazadasWorkday: START - Type: ' + tipoGestion + ', Requests: ' + requestIds.length);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRejected = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_RECHAZADAS);
    
    if (!sheetRejected) {
      throw new Error('Missing rejected requests sheet');
    }
    
    let emailsSent = 0;
    
    // Step 1: For each rejected request, build and send error notification email
    requestIds.forEach((requestId, idx) => {
      try {
        // Lookup request details from rejected sheet
        const requestData = lookupRejectedRequestData_(requestId, sheetRejected);
        if (!requestData) {
          Logger.warn('enviarCorreosRechazadasWorkday: Request not found: ' + requestId);
          return;
        }
        
        // Step 2: Get error message (from array or from request data)
        const errorMsg = errorMessages && errorMessages[idx] ? errorMessages[idx] : requestData.errorMessage;
        
        // Step 3: Build HTML rejection email template
        const emailHtml = buildRejectionEmailHtml_(tipoGestion, requestData, errorMsg);
        
        // Step 4: Send email
        const recipient = requestData.email || EMAIL_GESTIONES;
        const subject = buildRejectionEmailSubject_(tipoGestion, requestData);
        
        MailApp.sendEmail(
          recipient,
          subject,
          '', // Plain text body (empty, using HTML instead)
          {
            htmlBody: emailHtml,
            noReply: false
          }
        );
        
        Logger.log('enviarCorreosRechazadasWorkday: Rejection email sent to ' + recipient + ' for request ' + requestId);
        emailsSent++;
        
        // Small delay to avoid rate limiting
        Utilities.sleep(100);
        
      } catch (e) {
        Logger.error('enviarCorreosRechazadasWorkday: Failed to send rejection email for request ' + requestId + ' - ' + e.message);
      }
    });
    
    Logger.log('enviarCorreosRechazadasWorkday: COMPLETE - Sent ' + emailsSent + ' rejection emails');
    
    return {
      success: true,
      emailsSent: emailsSent,
      message: 'Rejection emails sent: ' + emailsSent + ' notifications delivered'
    };
    
  } catch (e) {
    Logger.error('enviarCorreosRechazadasWorkday ERROR: ' + e.message);
    return { success: false, emailsSent: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Lookup rejected request details from rejected requests sheet by request ID
 */
function lookupRejectedRequestData_(requestId, sheet) {
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  
  for (const row of data) {
    const id = safeInt_(row[0]);
    if (id === requestId) {
      return {
        requestId: id,
        type: toTrimmedString_(row[1]),
        name: toTrimmedString_(row[2]),
        email: toTrimmedString_(row[3]),
        supervisory: toTrimmedString_(row[4]),
        company: toTrimmedString_(row[5]),
        status: toTrimmedString_(row[6]),
        errorMessage: toTrimmedString_(row[7]),
        rejectionDate: toTrimmedString_(row[8]),
        details: toTrimmedString_(row[9])
      };
    }
  }
  
  return null;
}

/**
 * Build rejection email subject line
 */
function buildRejectionEmailSubject_(tipoGestion, requestData) {
  const dateStr = formatDateTimeStrict_(new Date());
  
  switch(tipoGestion) {
    case 'ALTA':
      return '[RECHAZADA] ALTA no procesada - ' + requestData.name + ' - ' + dateStr;
    case 'BAJA':
      return '[RECHAZADA] BAJA no procesada - ' + requestData.name + ' - ' + dateStr;
    case 'MODIFICACION':
      return '[RECHAZADA] MODIFICACIÓN no procesada - ' + requestData.name + ' - ' + dateStr;
    default:
      return '[RECHAZADA] Gestión no procesada - Request #' + requestData.requestId;
  }
}

/**
 * Build HTML rejection email template with error details
 * Professional styling with warning colors and clear error information
 */
function buildRejectionEmailHtml_(tipoGestion, requestData, errorMsg) {
  const getTypeColor = (tipo) => {
    switch(tipo) {
      case 'ALTA': return '#DC143C'; // Red for rejected
      case 'BAJA': return '#DC143C';
      case 'MODIFICACION': return '#DC143C';
      default: return '#FF6B6B';
    }
  };
  
  const getTypeLabel = (tipo) => {
    switch(tipo) {
      case 'ALTA': return 'CONTRATACIÓN';
      case 'BAJA': return 'TERMINACIÓN';
      case 'MODIFICACION': return 'MODIFICACIÓN';
      default: return 'GESTIÓN';
    }
  };
  
  const color = getTypeColor(tipoGestion);
  const label = getTypeLabel(tipoGestion);
  
  // Parse error message to extract key issues
  const errorLines = errorMsg ? errorMsg.split('\n').filter(line => line.trim()) : ['Error desconocido'];
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0 0; font-size: 14px; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .warning-box {
          background-color: #fff3cd;
          border-left: 4px solid ${color};
          padding: 15px;
          margin: 15px 0;
        }
        .warning-box p { margin: 0; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: ${color}; font-size: 16px; margin-bottom: 10px; }
        .field { margin-bottom: 10px; }
        .field-label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
        .field-value { color: #333; font-size: 14px; margin-top: 3px; }
        .error-list {
          background-color: #ffe6e6;
          border-left: 4px solid #DC143C;
          padding: 10px 15px;
          margin: 10px 0;
        }
        .error-list ul { margin: 5px 0; padding-left: 20px; }
        .error-list li { margin: 5px 0; color: #333; }
        .action-box {
          background-color: #e8f4f8;
          border-left: 4px solid #4169E1;
          padding: 15px;
          margin: 15px 0;
        }
        .action-box h4 { margin-top: 0; color: #4169E1; }
        .action-box p { margin: 5px 0; font-size: 14px; }
        .button { 
          display: inline-block;
          background-color: #4169E1;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 10px;
        }
        .button:hover { opacity: 0.9; }
        .footer { 
          margin-top: 20px; 
          padding-top: 15px; 
          border-top: 1px solid #ddd; 
          font-size: 12px; 
          color: #999;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✗ Solicitud Rechazada</h1>
          <p>La gestión de ${label} no pudo ser procesada</p>
        </div>
        
        <div class="content">
          <div class="warning-box">
            <p><strong>⚠️ ACCIÓN REQUERIDA:</strong> Esta solicitud fue rechazada debido a errores en validación. 
            Por favor, corrija los problemas indicados y reenvíe la solicitud.</p>
          </div>
          
          <div class="section">
            <div class="section-title">Detalles de la Solicitud</div>
            <div class="field">
              <div class="field-label">Tipo de Gestión</div>
              <div class="field-value">${label}</div>
            </div>
            <div class="field">
              <div class="field-label">Número de Solicitud</div>
              <div class="field-value">#${requestData.requestId}</div>
            </div>
            <div class="field">
              <div class="field-label">Nombre de Trabajador</div>
              <div class="field-value">${escapeHtml(requestData.name)}</div>
            </div>
            <div class="field">
              <div class="field-label">Supervisory</div>
              <div class="field-value">${escapeHtml(requestData.supervisory)}</div>
            </div>
            <div class="field">
              <div class="field-label">Empresa</div>
              <div class="field-value">${escapeHtml(requestData.company)}</div>
            </div>
            <div class="field">
              <div class="field-label">Fecha de Rechazo</div>
              <div class="field-value">${requestData.rejectionDate}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Errores Encontrados</div>
            <div class="error-list">
              <ul>
                ${errorLines.map(line => '<li>' + escapeHtml(line.trim()) + '</li>').join('')}
              </ul>
            </div>
          </div>
          
          <div class="action-box">
            <h4>¿Qué hacer ahora?</h4>
            <p><strong>1.</strong> Revise los errores listados arriba</p>
            <p><strong>2.</strong> Corrija los datos en el formulario original</p>
            <p><strong>3.</strong> Reenvíe la solicitud a través del sistema</p>
            <p><strong>4.</strong> Si tiene preguntas, contacte con el equipo de RR.HH.</p>
          </div>
          
          <div class="footer">
            <p>Este es un correo automático generado por el Sistema de Automatización de Gestión de Externos.</p>
            <p>Por favor, no responda a este correo. Para consultas, contacte con RR.HH.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return html;
}
