/**
 * === CONFIG ===
 * External Management Automation System
 * Constants and configuration values
 */

/****************************************************
 * CONFIGURACIÓN COMÚN
 ****************************************************/
const SPREADSHEET_ID_RESPUESTAS = '{SPREADSHEET_ID_RESPUESTAS}';
const FORM_ID = '{FORM_ID}';
const NOMBRE_HOJA_PRUEBAS = 'PRUEBAS - WORKDAY';
const NOMBRE_HOJA_RESPUESTAS_ORDENADAS = 'Respuestas Ordenadas - WORKDAY';
const NOMBRE_HOJA_RESPUESTAS_FORMULARIO = 'Form responses 1';
const NOMBRE_HOJA_DATOS_APOYO = 'Datos Apoyo - WORKDAY';
const NOMBRE_HOJA_TRADUCCIONES = 'Traducciones - WORKDAY';
const NOMBRE_HOJA_GESTIONES_REALIZADAS = 'Gestiones Realizadas - WORKDAY';
const NOMBRE_HOJA_GESTIONES_RECHAZADAS = 'Rechazadas - WORKDAY';
const NOMBRE_HOJA_BAJAS = 'Gestion BAJAS - WORKDAY';
const NOMBRE_HOJA_MODIFICACIONES_FF = 'Gestion MODIFICACIONES - FECHA FINAL - WORKDAY';
const NOMBRE_HOJA_MODIFICACIONES_AREA = 'Gestion MODIFICACIONES - AREA - WORKDAY';
const NOMBRE_HOJA_CONSULTA = 'Gestion CONSULTAS - WORKDAY';

const COL_STATUS_RESPUESTAS_ORDENADAS = 79;   // Realizada
const COL_ULTIMA_RESPUESTAS_ORDENADAS = 91;   // Última columna con datos
const COL_ULTIMA_TRADUCCIONES = 'AH';         // Última columna con datos
const MIN_PENDING = 10;                       // Número mínimo de peticiones pendientes

// Emails corporativos (considerados internos, sin cambios)
const EMAIL_GESTIONES = '{CORPORATE_EMAIL_GESTIONES}';
const EMAIL_STAFFING = '{CORPORATE_EMAIL_STAFFING}';

// URLs internas (reemplazar con tus valores)
const URL_DESTINO_WEB_APP = '{WEBAPP_URL}';
