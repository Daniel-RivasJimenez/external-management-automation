/**
 * === EMAIL-CONSULTAS.GS ===
 * External Management Automation System
 * Send HTML email with contract end date query results
 * 
 * Triggers when:
 * - CONSULTA query is processed successfully
 * - Contract end date data is retrieved
 * 
 * Sends HTML formatted response email with:
 * - Worker name and ID
 * - Contract end date
 * - Days until expiration
 * - Risk status (active, expiring soon, expired)
 * - Download link for detailed report
 */

/**
 * Send query result emails for CONSULTA (contract end date inquiry) requests
 * Called after query is processed and results are available
 * 
 * Preconditions:
 * - CONSULTA query must be processed (Status = "OK")
 * - Contract end date information must be retrieved
 * - Email recipient must be defined or use default
 * 
 * Parameters:
 * - requestIds: Array of CONSULTA request IDs
 * - queryResults: Array of result objects with contract info
 * 
 * Returns: { success: bool, emailsSent: int, message: string }
 */
function enviarCorreosConsultaFechaFinal(requestIds, queryResults) {
  try {
    if (!requestIds || requestIds.length === 0) {
      Logger.log('enviarCorreosConsultaFechaFinal: Missing parameters');
      return { success: false, emailsSent: 0, message: 'Missing required parameters' };
    }
    
    Logger.log('enviarCorreosConsultaFechaFinal: START - Queries: ' + requestIds.length);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetConsultas = ss.getSheetByName(NOMBRE_HOJA_CONSULTA);
    
    if (!sheetConsultas) {
      throw new Error('Missing CONSULTAS sheet');
    }
    
    let emailsSent = 0;
    
    // Step 1: For each query request, build and send results email
    requestIds.forEach((requestId, idx) => {
      try {
        // Lookup query request details
        const consultaData = lookupConsultaRequestData_(requestId, sheetConsultas);
        if (!consultaData) {
          Logger.warn('enviarCorreosConsultaFechaFinal: Request not found: ' + requestId);
          return;
        }
        
        // Get query results (from array or default)
        const results = queryResults && queryResults[idx] ? queryResults[idx] : null;
        if (!results) {
          Logger.warn('enviarCorreosConsultaFechaFinal: No results for request: ' + requestId);
          return;
        }
        
        // Step 2: Build HTML query result email template
        const emailHtml = buildConsultaResultEmailHtml_(consultaData, results);
        
        // Step 3: Send email
        const recipient = consultaData.email || EMAIL_GESTIONES;
        const subject = buildConsultaEmailSubject_(consultaData, results);
        
        MailApp.sendEmail(
          recipient,
          subject,
          '', // Plain text body (empty, using HTML instead)
          {
            htmlBody: emailHtml,
            noReply: false
          }
        );
        
        Logger.log('enviarCorreosConsultaFechaFinal: Query results sent to ' + recipient + ' for request ' + requestId);
        emailsSent++;
        
        // Small delay to avoid rate limiting
        Utilities.sleep(100);
        
      } catch (e) {
        Logger.error('enviarCorreosConsultaFechaFinal: Failed to send results for request ' + requestId + ' - ' + e.message);
      }
    });
    
    Logger.log('enviarCorreosConsultaFechaFinal: COMPLETE - Sent ' + emailsSent + ' query result emails');
    
    return {
      success: true,
      emailsSent: emailsSent,
      message: 'Query result emails sent: ' + emailsSent + ' notifications delivered'
    };
    
  } catch (e) {
    Logger.error('enviarCorreosConsultaFechaFinal ERROR: ' + e.message);
    return { success: false, emailsSent: 0, message: 'Error: ' + e.message };
  }
}

/**
 * Lookup CONSULTA query request details by request ID
 */
function lookupConsultaRequestData_(requestId, sheet) {
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  
  for (const row of data) {
    const id = safeInt_(row[0]);
    if (id === requestId) {
      return {
        requestId: id,
        workerId: toTrimmedString_(row[1]),
        workerName: toTrimmedString_(row[2]),
        email: toTrimmedString_(row[3]),
        requestingManager: toTrimmedString_(row[4]),
        requestDate: toTrimmedString_(row[5]),
        supervisory: toTrimmedString_(row[6]),
        company: toTrimmedString_(row[7]),
        queryType: toTrimmedString_(row[8])
      };
    }
  }
  
  return null;
}

/**
 * Build query result email subject line
 */
function buildConsultaEmailSubject_(consultaData, results) {
  const dateStr = formatDateTimeStrict_(new Date());
  
  if (results && results.contractInfo) {
    const status = results.contractInfo.status;
    if (status === 'EXPIRING_SOON') {
      return '[URGENTE] Contrato próximo a vencer - ' + consultaData.workerName + ' - ' + dateStr;
    } else if (status === 'EXPIRED') {
      return '[ALERTA] Contrato vencido - ' + consultaData.workerName + ' - ' + dateStr;
    }
  }
  
  return '[CONSULTA] Información de fecha fin de contrato - ' + consultaData.workerName + ' - ' + dateStr;
}

/**
 * Build HTML query result email template with contract information
 * Professional styling with status-based colors (green=active, yellow=expiring, red=expired)
 */
function buildConsultaResultEmailHtml_(consultaData, results) {
  const contractInfo = results.contractInfo || {};
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'ACTIVE': return '#00A86B'; // Green
      case 'EXPIRING_SOON': return '#FF9500'; // Orange
      case 'EXPIRED': return '#DC143C'; // Red
      default: return '#808080';
    }
  };
  
  const getStatusLabel = (status) => {
    switch(status) {
      case 'ACTIVE': return 'ACTIVO';
      case 'EXPIRING_SOON': return 'PRÓXIMO A VENCER';
      case 'EXPIRED': return 'VENCIDO';
      case 'NOT_FOUND': return 'NO ENCONTRADO';
      default: return 'DESCONOCIDO';
    }
  };
  
  const getStatusEmoji = (status) => {
    switch(status) {
      case 'ACTIVE': return '✓';
      case 'EXPIRING_SOON': return '⚠️';
      case 'EXPIRED': return '✗';
      default: return '?';
    }
  };
  
  const statusColor = getStatusColor(contractInfo.status);
  const statusLabel = getStatusLabel(contractInfo.status);
  const statusEmoji = getStatusEmoji(contractInfo.status);
  
  const daysUntilEnd = contractInfo.daysUntilEnd || 0;
  const daysText = daysUntilEnd > 0 
    ? daysUntilEnd + ' días' 
    : (daysUntilEnd === 0 ? 'Hoy' : 'Vencido hace ' + Math.abs(daysUntilEnd) + ' días');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0 0; font-size: 14px; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .status-card {
          background-color: white;
          border-left: 4px solid ${statusColor};
          padding: 20px;
          margin: 15px 0;
          border-radius: 5px;
        }
        .status-line { 
          font-size: 18px; 
          font-weight: bold; 
          color: ${statusColor};
          margin-bottom: 10px;
        }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: ${statusColor}; font-size: 16px; margin-bottom: 10px; }
        .field { margin-bottom: 10px; }
        .field-label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
        .field-value { color: #333; font-size: 14px; margin-top: 3px; font-weight: 500; }
        .highlight {
          background-color: #fff3cd;
          padding: 10px 15px;
          border-radius: 5px;
          margin: 10px 0;
          border-left: 4px solid ${statusColor};
        }
        .action-box {
          background-color: #e8f4f8;
          border-left: 4px solid #4169E1;
          padding: 15px;
          margin: 15px 0;
          border-radius: 5px;
        }
        .button { 
          display: inline-block;
          background-color: ${statusColor};
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
          <h1>${statusEmoji} Resultado de Consulta</h1>
          <p>Información de fecha fin de contrato solicitada</p>
        </div>
        
        <div class="content">
          <div class="status-card">
            <div class="status-line">Estado: ${statusLabel}</div>
            <p style="margin: 0; color: #666; font-size: 14px;">
              ${daysUntilEnd > 0 
                ? 'El contrato vence en <strong>' + daysText + '</strong>' 
                : (daysUntilEnd === 0 
                  ? 'El contrato vence <strong>hoy</strong>' 
                  : 'El contrato venció hace <strong>' + Math.abs(daysUntilEnd) + ' días</strong>')}
            </p>
          </div>
          
          <div class="section">
            <div class="section-title">Datos del Trabajador</div>
            <div class="field">
              <div class="field-label">ID Trabajador</div>
              <div class="field-value">${escapeHtml(contractInfo.workerId || consultaData.workerId)}</div>
            </div>
            <div class="field">
              <div class="field-label">Nombre</div>
              <div class="field-value">${escapeHtml(contractInfo.name || consultaData.workerName)}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Información de Contrato</div>
            <div class="field">
              <div class="field-label">Fecha Fin Actual</div>
              <div class="field-value">${contractInfo.currentEndDate || 'No disponible'}</div>
            </div>
            <div class="field">
              <div class="field-label">Días Hasta Vencimiento</div>
              <div class="field-value">${daysText}</div>
            </div>
          </div>
          
          ${contractInfo.status === 'EXPIRING_SOON' ? `
            <div class="highlight">
              <strong>⚠️ ATENCIÓN:</strong> Este contrato está próximo a vencer. 
              Se recomienda gestionar la prórroga o renovación del contrato.
            </div>
          ` : ''}
          
          ${contractInfo.status === 'EXPIRED' ? `
            <div class="highlight" style="background-color: #ffe6e6; border-left-color: #DC143C;">
              <strong>✗ CRÍTICO:</strong> Este contrato ha vencido. 
              Por favor, contacte inmediatamente con RR.HH. para regularizar la situación.
            </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">Detalles de la Consulta</div>
            <div class="field">
              <div class="field-label">Solicitante</div>
              <div class="field-value">${escapeHtml(consultaData.requestingManager)}</div>
            </div>
            <div class="field">
              <div class="field-label">Supervisory</div>
              <div class="field-value">${escapeHtml(consultaData.supervisory)}</div>
            </div>
            <div class="field">
              <div class="field-label">Empresa</div>
              <div class="field-value">${escapeHtml(consultaData.company)}</div>
            </div>
            <div class="field">
              <div class="field-label">Fecha de Respuesta</div>
              <div class="field-value">${formatDateTimeStrict_(new Date())}</div>
            </div>
          </div>
          
          <div class="action-box">
            <h4>Próximos Pasos</h4>
            ${contractInfo.status === 'EXPIRING_SOON' || contractInfo.status === 'EXPIRED' 
              ? `<p><strong>Acción recomendada:</strong> Contacte con RR.HH. para gestionar la prórroga o renovación del contrato.</p>`
              : `<p><strong>Estado actual:</strong> El contrato está activo. No se requiere acción inmediata.</p>`}
            <p>Para consultas adicionales, use el formulario de gestión de externos o contacte directamente con RR.HH.</p>
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
