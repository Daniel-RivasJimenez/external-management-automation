/**
 * === EMAIL-GESTIONES-REALIZADAS.GS ===
 * External Management Automation System
 * Send HTML email notifications for successfully processed requests
 * 
 * Triggers after:
 * - ALTAS output generated ✓
 * - BAJAS output generated ✓
 * - MODIFICACIONES processed ✓
 * 
 * Sends HTML formatted emails with:
 * - Request summary
 * - Status confirmation
 * - File attachments/download links
 * - Audit trail info
 */

/**
 * Send confirmation emails for successfully processed requests
 * Called after each operation type (ALTA, BAJA, MODIFICACION) completes
 * 
 * Preconditions:
 * - Request must have Status = "OK"
 * - Email recipient must be defined in request or defaults to {CORPORATE_EMAIL_GESTIONES}
 * - Output files must be generated
 * 
 * Parameters:
 * - tipoGestion: "ALTA" | "BAJA" | "MODIFICACION"
 * - requestIds: Array of request IDs to email
 * - attachmentLinks: Array of file download links
 * 
 * Returns: { success: bool, emailsSent: int, message: string }
 */
function enviarCorreosGestionRealizadaWorkday(tipoGestion, requestIds, attachmentLinks) {
  try {
    if (!tipoGestion || !requestIds || requestIds.length === 0) {
      Logger.log('enviarCorreosGestionRealizadaWorkday: Missing parameters');
      return { success: false, emailsSent: 0, message: 'Missing required parameters' };
    }
    
    Logger.log('enviarCorreosGestionRealizadaWorkday: START - Type: ' + tipoGestion + ', Requests: ' + requestIds.length);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetGestiones = ss.getSheetByName(NOMBRE_HOJA_GESTIONES_REALIZADAS);
    
    if (!sheetGestiones) {
      throw new Error('Missing gestiones sheet');
    }
    
    let emailsSent = 0;
    
    // Step 1: For each request, build and send confirmation email
    requestIds.forEach((requestId, idx) => {
      try {
        // Lookup request details
        const requestData = lookupRequestData_(requestId, sheetGestiones);
        if (!requestData) {
          Logger.warn('enviarCorreosGestionRealizadaWorkday: Request not found: ' + requestId);
          return;
        }
        
        // Step 2: Build HTML email template
        const emailHtml = buildConfirmationEmailHtml_(tipoGestion, requestData, attachmentLinks[idx]);
        
        // Step 3: Send email
        const recipient = requestData.email || EMAIL_GESTIONES;
        const subject = buildEmailSubject_(tipoGestion, requestData);
        
        MailApp.sendEmail(
          recipient,
          subject,
          '', // Plain text body (empty, using HTML instead)
          {
            htmlBody: emailHtml,
            noReply: false
          }
        );
        
        Logger.log('enviarCorreosGestionRealizadaWorkday: Email sent to ' + recipient + ' for request ' + requestId);
        emailsSent++;
        
        // Small delay to avoid rate limiting
        Utilities.sleep(100);
        
      } catch (e) {
        Logger.error('enviarCorreosGestionRealizadaWorkday: Failed to send email for request ' + requestId + ' - ' + e.message);
      }
    });
    
    Logger.log('enviarCorreosGestionRealizadaWorkday: COMPLETE - Sent ' + emailsSent + ' emails');
    
    return {
      success: true,
      emailsSent: emailsSent,
      message: 'Confirmation emails sent: ' + emailsSent + ' notifications delivered'
    };
    
  } catch (e) {
    Logger.error('enviarCorreosGestionRealizadaWorkday ERROR: ' + e.message);
    return { success: false, emailsSent: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Lookup request details from gestiones sheet by request ID
 */
function lookupRequestData_(requestId, sheet) {
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
        processDate: toTrimmedString_(row[7]),
        details: toTrimmedString_(row[8])
      };
    }
  }
  
  return null;
}

/**
 * Build email subject line based on request type and data
 */
function buildEmailSubject_(tipoGestion, requestData) {
  const dateStr = formatDateTimeStrict_(new Date());
  
  switch(tipoGestion) {
    case 'ALTA':
      return '[CONFIRMACIÓN] ALTA Procesada - ' + requestData.name + ' - ' + dateStr;
    case 'BAJA':
      return '[CONFIRMACIÓN] BAJA Procesada - ' + requestData.name + ' - ' + dateStr;
    case 'MODIFICACION':
      return '[CONFIRMACIÓN] MODIFICACIÓN Procesada - ' + requestData.name + ' - ' + dateStr;
    default:
      return '[CONFIRMACIÓN] Gestión Procesada - Request #' + requestData.requestId;
  }
}

/**
 * Build HTML email template with dynamic content
 * Professional styling and clear information hierarchy
 */
function buildConfirmationEmailHtml_(tipoGestion, requestData, attachmentLink) {
  const getTypeColor = (tipo) => {
    switch(tipo) {
      case 'ALTA': return '#00A86B'; // Green
      case 'BAJA': return '#DC143C'; // Red
      case 'MODIFICACION': return '#4169E1'; // Blue
      default: return '#808080';
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
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: ${color}; font-size: 16px; margin-bottom: 10px; }
        .field { margin-bottom: 10px; }
        .field-label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
        .field-value { color: #333; font-size: 14px; margin-top: 3px; }
        .status-box { 
          background-color: ${color}; 
          color: white; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 15px 0;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
        }
        .button { 
          display: inline-block;
          background-color: ${color};
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
          <h1>✓ Gestión Procesada</h1>
          <p>Solicitud de ${label} confirmada</p>
        </div>
        
        <div class="content">
          <div class="status-box">
            ESTADO: APROBADO
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
              <div class="field-label">Fecha de Procesamiento</div>
              <div class="field-value">${requestData.processDate}</div>
            </div>
          </div>
          
          ${attachmentLink ? `
            <div class="section">
              <div class="section-title">Archivos Generados</div>
              <p>Los archivos para importar a Workday están disponibles:</p>
              <a href="${attachmentLink}" class="button">Descargar Archivos</a>
            </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">Próximos Pasos</div>
            <p>Los ficheros EIB han sido generados y están listos para importar en Workday.</p>
            <p>El proceso se completará una vez se confirme la importación en el sistema.</p>
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
