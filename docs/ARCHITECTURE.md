# External Management Automation System - Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Data Model](#data-model)
4. [Workflow Orchestration](#workflow-orchestration)
5. [Module Deep Dive](#module-deep-dive)
6. [Error Handling](#error-handling)
7. [Performance Considerations](#performance-considerations)
8. [Security Model](#security-model)

---

## System Overview

### High-Level Architecture

The system follows a **pipeline architecture** with these phases:

INPUT → TRANSFORM → ROUTE → PROCESS → OUTPUT → NOTIFY


### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Orchestration | Google Apps Script | Code execution, scheduling |
| Data Store | Google Sheets | Source of truth |
| Input | Google Forms | Form responses collection |
| Email | Gmail API (MailApp) | Notification delivery |
| Integration | Workday API | EIB file import |

### Design Principles

1. **Idempotence**: Same input → same output (safe to retry)
2. **Fail-safe**: Errors logged, never silently fail
3. **Scalability**: Batch processing for 100K+ records
4. **Transparency**: Every step logged with timestamp
5. **Flexibility**: Dynamic column resolution (handles schema changes)

---

## Core Concepts

### Request Types (Tipo Gestion)

The system handles 4 types of HR requests:

#### 1. ALTA (Hiring)
**What**: Add new external worker to payroll
**Input**: Worker details, position info, contract terms
**Output**: 3 EIB files (Position + Contract + Worker)
**Workday Impact**: Creates new contingent worker record

#### 2. BAJA (Termination)
**What**: Remove worker from payroll
**Input**: Worker ID, termination date, reason
**Output**: 1 EIB file (Termination record)
**Workday Impact**: Closes contingent worker record

#### 3. MODIFICACION (Modification)
**What**: Change worker assignment or contract
**Subtypes**:
- AREA: Move to different team/location
- FECHA FINAL: Extend or change contract end date

**Output**: 2 EIB files per type
**Workday Impact**: Updates worker org assignment or contract

#### 4. CONSULTA (Query)
**What**: Request information about worker contract
**Input**: Worker ID, query type
**Output**: HTML email with contract end date info
**Workday Impact**: No impact (read-only)

### Status States

Every request moves through states:

[PENDING] → [VALIDATED] → [PROCESSED] → [OK/ERROR]
(empty) (status col) (queue col) (final)


| Status | Meaning | Example |
|--------|---------|---------|
| (empty) | Pending processing | Row ready to snapshot |
| OK | Successfully processed | Row archived to "Gestiones Realizadas" |
| ERROR | Failed validation/processing | Row logged to "Rechazadas" |

---

## Data Model

### Sheet Structure

#### 1. Form responses → "Form responses 1"
Direct output from Google Form. **DO NOT EDIT MANUALLY.**

Columns:

Timestamp (auto)
Email submitter (auto)
Tipo Gestion
Worker Name
Worker ID
... (all form fields)

#### 2. Respuestas Ordenadas - WORKDAY
Transformed, deduplicated, ordered responses.

**Key columns:**
- ID Peticion (auto-assigned seq ID)
- Timestamp (for dedup)
- Tipo Gestion (ALTA/BAJA/MODIF/CONSULTA)
- Status (empty / OK / ERROR)
- [All translated fields]

**Why this sheet?**
- Single source of truth after ETL
- Deduplicated (prevents double-processing)
- Ordered (sequential IDs for tracking)
- Status tracking
- Audit trail

#### 3. Queue Sheets (Gestion ALTAS, Gestion BAJAS, etc)
Snapshot of pending requests by type.

**Why separate sheets?**
- Process type-specific requests independently
- Prevents data silos
- Easy to monitor backlog per type
- Can be processed in parallel

#### 4. Gestiones Realizadas - WORKDAY
Archive of successfully processed requests.

**Purpose**: Compliance / audit trail
**Retention**: Permanent

#### 5. Rechazadas - WORKDAY
Archive of failed/rejected requests.

**Columns include:**
- Request ID
- Request type
- Error message
- Rejection date
- Submitter email (for notification)

**Purpose**: Error analysis, resubmission

#### 6. Datos Apoyo - WORKDAY
Master data reference tables.

**Content:**
- Column A: GEOS (geographic locations)
- Column B: CIB codes (cost centers)
- Column C: Supervisories
- Column D: Physical locations
- Column E-Z: Other lookup tables

**Why static?** Updated manually or via separate process; not changed by automation

---

## Workflow Orchestration

### Main Flow: runGestionesAutomation()

START
│
├─→ [LOCK SHEET] (prevent concurrent execution)
│
├─→ [STEP 1] ETL: volcadoRespuestasOrdenadas()
│ ├─ Read: Form responses
│ ├─ Transform: Translate, normalize, deduplicate
│ └─ Output: Ordered responses sheet
│
├─→ [STEP 2] SNAPSHOT all request types
│ ├─ snapshotAltasPendientesToQueue()
│ ├─ snapshotBajasPendientesToQueue()
│ ├─ snapshotModificacionesAreaPendientesToQueue()
│ ├─ snapshotModificacionesFechaFinalPendientesToQueue()
│ └─ snapshotConsultasFechaFinalToQueue()
│
├─→ [STEP 3] GENERATE output files
│ ├─ createAltasOutputXlsxFromTemplate()
│ ├─ createBajasOutputXlsxFromTemplate()
│ ├─ createModificacionesAreaOutputFromQueue()
│ ├─ createModificacionesFechaFinalOutputXlsxFromTemplate()
│ └─ createConsultasFechaFinalFromQueue()
│
├─→ [STEP 4] VALIDATE (optional)
│ └─ validarFTEs() [FTE consistency check]
│
├─→ [STEP 5] LOG SUMMARY
│
└─→ [UNLOCK SHEET]
END


### Secondary Flow: runConfirmacionesAutomation()

Runs AFTER main automation:

START
│
├─→ [LOCK SHEET]
│
├─→ [STEP 1] SNAPSHOT OK requests
│ └─ snapshotGestionesOK()
│
├─→ [STEP 2] SNAPSHOT ERROR requests
│ └─ snapshotGestionesRechazadas()
│
├─→ [STEP 3] SEND CONFIRMATION EMAILS
│ ├─ By type (ALTA/BAJA/MODIF)
│ └─ enviarCorreosGestionRealizadaWorkday()
│
├─→ [STEP 4] SEND REJECTION EMAILS
│ └─ enviarCorreosRechazadasWorkday()
│
└─→ [UNLOCK SHEET]
END


### Timing

**Option 1: Sequence (Recommended)**

30 min: runGestionesAutomation() [Process requests]
+10 min: runConfirmacionesAutomation() [Send emails]


**Option 2: Parallel**

Both run every 30 min independently
(but email sending waits for processing)


---

## Module Deep Dive

### 1. Core (src/core/)

#### constants.gs
**Purpose**: Centralized configuration

**Key vars:**
```javascript
SPREADSHEET_ID_RESPUESTAS  // Sheet ID
FORM_ID                    // Form ID
NOMBRE_HOJA_*              // Sheet names (14 total)
COL_STATUS_RESPUESTAS_ORDENADAS // Column index for status
MIN_PENDING                // Threshold for automation trigger
EMAIL_GESTIONES            // Default email recipient
URL_DESTINO_WEB_APP        // Callback URL for files
```

**Why important?** Single point to update configuration; all scripts reference these constants

#### helpers.gs
**Purpose**: Common function library

**Categories:**
- String utilities (forceText, escapeHtml)
- Number formatting (format8Digits, format11Digits)
- Date handling (normalizeToYMD, formatDateTimeStrict)
- Sheet operations (findLastNonEmptyRow, countPendingRows)
- Drive utilities (extractDriveFolderId)
- Geography (countryToISO3)
- Validation (isValidEmail, isValidDateFormat)

**Design:** All 50+ helpers are pure functions (no side effects)

#### column-header-mapping.gs
**Purpose**: Dynamic column resolution

**Key function: resolveCols_()**
```javascript
resolveCols_(sheet, headerRow, {
  MY_ALIAS: { name: 'Column Name' },
  DUPLICATED: { name: 'Dup Name', bloque: 'ALTA' },
  THIRD_OCC: { name: 'Triple', nth: 3 }
})
```

**Returns:** `{ MY_ALIAS: colIndex, DUPLICATED: colIndex, ... }`

**Why?** Handles:
- Schema changes (columns added/removed)
- Duplicate headers (same name in different blocks)
- Dynamic flexibility vs hardcoded column positions

**RO_DUP dictionary** maps duplicate column names to occurrence:
```javascript
'Estructura': { CONSULTA: 1, MODIF: 2, ALTA: 3 }
// means: 3 columns named "Estructura", distinguish by context
```

#### utilities-global.gs
**Purpose**: Consolidated 100+ utility functions

**Sections:**
- String/text (6 functions)
- Date/time (4 functions)
- Sheet operations (3 functions)
- Drive utilities (4 functions)
- Batch write (1 function)
- Geography (1 function)
- Validation (3 functions)

---

### 2. Data Transformation (src/features/data-transformation/)

#### volcado-respuestas.gs
**The ETL Pipeline - MOST CRITICAL**

**Flow:**

Raw Forms → buildTranslationMaps() → Transform each row → Deduplicate → Assign IDs → Write Ordered


**Key functions:**

**volcadoRespuestasOrdenadas()**
- Main orchestrator
- Locks sheet, clears old data, batch writes new
- Handles 10K+ rows efficiently

**buildTranslationMaps_()**
- Reads support sheet
- Creates lookup dicts: Country → ISO3, Company → Code, etc
- Built once, reused for all 100K rows

**buildOutputRow_()**
- Transforms single form response
- Column-by-column translation
- Example: Country "España" → ISO3 "ESP"

**Deduplication logic:**
```javascript
const dedupMap = new Map(); // Key: timestamp
// Keep first occurrence, skip duplicates
if (dedupMap.has(timestamp)) return; // Skip
dedupMap.set(timestamp, idx);
```

**Why timestamp?** Google Form's built-in timestamp is unique per submission

---

### 3. Snapshots (src/automation/snapshots/)

#### Pattern: snapshot-*-pending-to-queue.gs

**Generic pattern used by all 5 snapshot functions:**

```javascript
function snapshotXXXPendientesToQueue() {
  1. Read Respuestas Ordenadas
  2. Filter: Tipo = "XXX" AND Status = "" (pending)
  3. Deduplicate by timestamp
  4. Get last queue ID + assign sequential IDs
  5. Write to queue sheet
}
```

**Why separate snapshots?**
- Process types independently
- Easy to disable one type without affecting others
- Can prioritize (e.g., process ALTAS before CONSULTAS)
- Easy monitoring per type

---

### 4. Output Generation (src/features/altas, bajas, etc)

#### Pattern: create-*-output.gs

**Generic pattern:**

```javascript
function createXXXOutputXlsxFromTemplate() {
  1. Read queue sheet for type
  2. Parse each row (validate required fields)
  3. For each validated row:
     - Build output row(s)
     - Add to output array
  4. Write to sheet/export XLSX
}
```

**Key: buildXXXRow_()**
- Transforms queue row → Workday EIB format
- Maps internal codes → Workday codes
- Handles missing fields gracefully

---

## Error Handling

### Strategy: Fail-logged, not fail-silent

**On error:**
```javascript
try {
  // do operation
} catch (e) {
  Logger.error('context: ' + e.message);
  summary.errors.push(e.message);
  return { success: false, message: 'Error: ' + e.message };
}
```

**Result:** Errors logged, execution continues

### Validation-based Rejection

Different from hard errors:

```javascript
// HARD ERROR: throw exception
if (!sheet) throw new Error('Sheet missing');

// VALIDATION ERROR: set status to ERROR, log reason
if (fteMismatch) {
  sheet.getRange(row, statusCol).setValue('ERROR');
  rejectSheet.append([requestId, reason]);
}
```

### Email Notifications

**For OK requests:**
- Email template: Green, success message, file links
- Recipients: Submitter email from request

**For ERROR requests:**
- Email template: Red, error list, correction steps
- Recipients: Submitter email
- Includes: What went wrong, how to fix, resubmit link

---

## Performance Considerations

### Batch Processing

**Problem:** 100K rows in single loop = timeout risk

**Solution:** Batch writes
```javascript
const BATCH_SIZE = 500;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  sheet.getRange(...).setValues(batch);
  if (i + BATCH_SIZE < rows.length) Utilities.sleep(100);
}
```

**Result:** Process 100K rows in ~5 min (vs potential timeout)

### Concurrent Execution Prevention

**Problem:** If triggers run simultaneously, data corruption

**Solution: LockService**
```javascript
const lock = LockService.getDocumentLock();
if (!lock.tryLock(5000)) {
  Logger.warn('Already running; skipping');
  return;
}
try {
  // Critical section
} finally {
  lock.releaseLock();
}
```

### Query Optimization

**Don't:**
```javascript
for (let i = 0; i < 100K; i++) {
  const cell = sheet.getRange(i, 1).getValue(); // 100K API calls!
}
```

**Do:**
```javascript
const data = sheet.getRange(1, 1, 100000, 100).getValues(); // 1 API call
for (const row of data) {
  const cell = row[0];
}
```

### Memory Management

For very large datasets (>50K rows):
- Process in chunks
- Clear intermediate arrays: `array.length = 0`
- Use streaming where possible (avoid holding entire dataset in memory)

---

## Security Model

### Data Sanitization

**Input:** Form responses may contain:
- PII (emails, phone numbers)
- Accidental secrets (passwords, tokens)

**Handling:**
- Never log full request rows
- Escape HTML in emails (prevent XSS)
- Validate before processing (reject invalid data)

### Access Control

**Google Sheets permissions:**
- Form: Open to all (anyone can submit)
- Sheet: Private (only HR team can view)
- Scripts: Bound to sheet (execute in context of sheet owner)

**Result:** Form submissions public, data processing private

### Audit Trail

**What's logged:**
- Every execution: timestamp, step, result
- Every processed record: ID, status, date
- Every error: timestamp, message, context

**Who can access:**
- HR team: Full access to all logs
- Submitters: Can request info via query forms

### Email Security

**Precautions:**
- Use MailApp (not external SMTP)
- HTML escape all user-provided content
- No sensitive data in email subject lines
- Confirm recipient email validity before sending

---

## Advanced Topics

### Extending the System

**Adding new request type:**

1. Create new snapshot function: `snapshotXXXPendientesToQueue()`
2. Create output generator: `createXXXOutputXlsxFromTemplate()`
3. Create email template: `enviarCorreosXXX()`
4. Update main orchestrator: `runGestionesAutomation()` (add STEP 2.X)
5. Add sheet constant: `const NOMBRE_HOJA_XXX = 'Gestion XXX - WORKDAY'`

**Adding new validation rule:**

1. Create validation function: `validateXXX_()`
2. Call in appropriate snapshot: `if (!validateXXX_(row)) return;`
3. Or add to main validator: `validarFTEs()`

### Debugging

**Enable verbose logging:**
```javascript
// At top of function
Logger.log('DEBUG: Starting with input: ' + JSON.stringify(input));
```

**Monitor real-time:**
- Apps Script Editor → Execution log
- Filter by function name, timestamp, or status

**Trace data:**
- Add temporary log columns to sheets
- Write values: `sheet.getRange(...).setValue('[DEBUG] value')`
- Clean up after debugging

---

## Conclusion

This system demonstrates:
- **Scalability**: Handles 100K+ records monthly
- **Reliability**: Batch processing, lock management, error handling
- **Maintainability**: Modular design, clear separation of concerns
- **Extensibility**: Easy to add new features or request types
- **Security**: Data sanitization, audit trails, access control

For questions, refer to main README or specific module documentation.
