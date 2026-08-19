# Setup & Installation Guide

## Prerequisites

Before starting, ensure you have:

- ✅ **Google Workspace account** (Gmail, Google Drive access)
- ✅ **Google Forms** (ability to create forms)
- ✅ **Google Sheets** (ability to create spreadsheets)
- ✅ **Google Apps Script** (access to script editor)
- ✅ **Workday credentials** (optional, for EIB import)
- ✅ **Basic technical knowledge** (Google Sheets, simple scripting)

---

## Part 1: Create Infrastructure

### Step 1.1: Create Master Google Sheet

This is where all data lives. Create a new Google Sheet:

1. Go to **sheets.google.com**
2. Click **"+ New"** → **"Google Sheet"**
3. Name it: `External Management - WORKDAY`
4. Share with your HR team (Edit access)

### Step 1.2: Create Required Sheets

Inside the spreadsheet, create these 8 sheets by right-clicking tabs:

**INPUT SHEETS:**
Form responses 1 ← Auto-created when linking form

**PROCESSING SHEETS:**
Respuestas Ordenadas - WORKDAY (ordered/transformed responses)
Gestion ALTAS - WORKDAY (hiring queue)
Gestion BAJAS - WORKDAY (termination queue)
Gestion MODIFICACIONES - AREA - WORKDAY
Gestion MODIFICACIONES - FECHA FINAL - WORKDAY
Gestion CONSULTAS - WORKDAY (query results)

**ARCHIVE SHEETS:**
Gestiones Realizadas - WORKDAY (success archive)
Rechazadas - WORKDAY (error log)

**MASTER DATA:**
Datos Apoyo - WORKDAY (reference tables)
Traducciones - WORKDAY (translation maps)

**Total: 11 sheets**

### Step 1.3: Add Headers to Processing Sheets

For **Respuestas Ordenadas - WORKDAY** (Row 1), add headers:

A: ID Peticion
B: Timestamp
C: Tipo Gestion
D: Status
E: Nombre
F: Email
G: Supervisory
H: Empresa
... (continue for all columns in your form)


For **Gestion ALTAS - WORKDAY** (Row 1), add headers:

A: ID Peticion
B: Tipo Gestion
C: Worker Name
D: Worker ID
E: Start Date
F: End Date
... (map to your columns)


Repeat for other queue sheets (BAJAS, MODIF-AREA, MODIF-FF, CONSULTAS)

For **Datos Apoyo - WORKDAY** (Row 1), add master data columns:

A: GEOS
B: CIB
C: Supervisory
D: Location
E-Z: Other reference tables


**Populate with your organization's master data starting Row 2**

### Step 1.4: Create Google Form

1. Go to **forms.google.com**
2. Click **"+ Create new form"**
3. Name it: `External Workforce Management Request`
4. Add these questions:

**Basic Info:**
- Tipo Gestion (Multiple choice: ALTA / BAJA / MODIFICACION / CONSULTA)
- Nombre Trabajador (Short answer)
- ID Trabajador (Short answer)

**For ALTA:**
- Fecha Inicio (Date)
- Fecha Fin (Date)
- Rol (Short answer)
- Supervisory (Dropdown - will be dynamic)
- Empresa (Dropdown - will be dynamic)

**For BAJA:**
- Fecha Termination (Date)
- Motivo Baja (Dropdown - will be dynamic)

**For MODIFICACION:**
- Subtipo (Multiple choice: AREA / FECHA FINAL)
- Nueva Ubicacion (Short answer)
- Nueva Fecha Fin (Date, if FECHA FINAL)

**For CONSULTA:**
- Query Type (Multiple choice: BY_WORKER / BY_SUPERVISORY)

5. **Link form to spreadsheet:**
   - Click **"⋮"** (three dots) → **"Select response destination"**
   - Choose your `External Management - WORKDAY` spreadsheet
   - Click **"Create"** or **"Select"**

**This auto-creates "Form responses 1" sheet**

---

## Part 2: Deploy Google Apps Script

### Step 2.1: Open Google Apps Script Editor

1. In your Google Sheet, go to **Tools** → **Script editor**
2. This opens Google Apps Script IDE
3. You should see an empty `Code.gs` file

### Step 2.2: Copy All Script Files

You have **25 .gs files** to copy. There are 2 methods:

**Method A: Copy-Paste (Simple but Manual)**
1. For each .gs file in the repo:
   - Open the file on GitHub (raw view)
   - Copy all content
   - In Apps Script IDE, create new file: **"+ New"** → **"Script"**
   - Name it (e.g., `constants.gs`)
   - Paste content
   - Repeat for all 25 files

**Method B: GitHub Sync (Advanced)**
1. Use **GitHub Desktop** or **clasp** CLI tool
2. Clone the repo locally
3. Use `clasp` to push to Apps Script

**For now, Method A is recommended**

### Step 2.3: Important: Update `constants.gs`

Before saving scripts, update the configuration in `constants.gs`:

```javascript
// Find these lines and update:

const SPREADSHEET_ID_RESPUESTAS = '{YOUR_SHEET_ID}';
// Get ID from your Sheet's URL: https://docs.google.com/spreadsheets/d/[THIS_ID]/edit

const FORM_ID = '{YOUR_FORM_ID}';
// Get ID from Form's URL: https://docs.google.com/forms/d/[THIS_ID]/edit

const EMAIL_GESTIONES = 'your-email@company.com';
// Your HR team email for notifications

const EMAIL_STAFFING = 'staffing@company.com';
// Staffing team email

const URL_DESTINO_WEB_APP = '{WEBAPP_URL}';
// Optional: URL for file download links (leave as-is for now)
```

### Step 2.4: Set Execution Permissions

After copying all files:

1. Click **"<> Editor"** (should be default)
2. Select any function from dropdown (e.g., `runGestionesAutomation`)
3. Click **"▶ Run"** (play button)
4. **First run**: Google will ask for permissions
   - Click **"Review permissions"**
   - Click your account
   - Click **"Allow"** (authorize the script)
5. Script will fail the first time (missing sheets), but permissions are granted

---

## Part 3: Set Up Automation Triggers

### Step 3.1: Create Time-Based Triggers

1. In Apps Script, click **"⏰ Triggers"** (left sidebar)
2. Click **"+ Create new trigger"**

**Trigger 1: Main Automation**

Function to run: runGestionesAutomation
Deployment: Head
Event source: Time-driven
Type of time interval: Minutes timer
Interval: 30 minutes
Failure notification: Email me immediately

Click **"Save"**

**Trigger 2: Confirmations (Optional)**

Function to run: runConfirmacionesAutomation
Deployment: Head
Event source: Time-driven
Type of time interval: Hour timer
Interval: 1 hour
Failure notification: Email me immediately

Click **"Save"**

**Trigger 3: Form Dropdown Updates (Optional)**

Function to run: updateAllFormDropdowns
Deployment: Head
Event source: Time-driven
Type of time interval: Day timer
Interval: Daily
Time: 02:00 AM
Failure notification: Email me immediately

Click **"Save"**

### Step 3.2: Verify Triggers

1. Back in Apps Script, click **"⏰ Triggers"**
2. You should see 2-3 triggers listed
3. Check status: **"Last run"** and **"Next run"** should show dates

---

## Part 4: Testing & Validation

### Step 4.1: Submit Test Form Response

1. Go to your Google Form
2. Click **"Preview"** (eye icon)
3. Fill it out with test data:

Tipo Gestion: ALTA
Nombre: John Test
ID: TEST001
Fecha Inicio: 2025-01-01
Fecha Fin: 2025-12-31
Rol: Test Engineer
Supervisory: Test Manager
Empresa: Test Corp

4. Click **"Submit"**

### Step 4.2: Monitor Execution

1. Go back to Google Sheet
2. Check **"Form responses 1"** sheet - your response should appear

**Wait 30 seconds, then:**

3. Go to Apps Script → **"Execution log"** (clock icon)
4. You should see recent executions
5. Click on latest to see details

**Expected (First run will error because sheets need setup):**

[INFO] runGestionesAutomation: START
[ERROR] Missing required sheets
[INFO] runGestionesAutomation: COMPLETE


### Step 4.3: Manual Test Run

If you don't want to wait 30 min for trigger:

1. Apps Script → **"Select function"** dropdown
2. Choose `runGestionesAutomation`
3. Click **"▶ Run"** (play button)
4. Check Execution log for results

---

## Part 5: Fix Common Setup Issues

### Issue 1: "Missing required sheets"

**Cause:** Sheet names don't match `constants.gs`

**Fix:**
1. Check your sheet names exactly match those in `constants.gs`
2. Case-sensitive! `Gestion ALTAS - WORKDAY` ≠ `gestion altas - workday`

### Issue 2: "Column not found"

**Cause:** Headers in sheets don't match what scripts expect

**Fix:**
1. Add all expected headers to Row 1 of each sheet
2. Script looks for: `resolveCols_(sheet, HEADER_ROW_RO, {...})`
3. Verify column names match your form structure

### Issue 3: "Emails not sending"

**Cause:** EMAIL_GESTIONES not set or invalid

**Fix:**
1. Check `constants.gs` - `EMAIL_GESTIONES` should be valid email
2. Test: Click **▶ Run** → check Execution log for email errors
3. Verify your Google account has Gmail access

### Issue 4: "Form responses not appearing"

**Cause:** Form not linked to spreadsheet

**Fix:**
1. In Google Form: **⋮** → **"Select response destination"**
2. Choose your `External Management - WORKDAY` sheet
3. Re-submit test form

---

## Part 6: Verify Everything Works

### Checklist Before Going Live

- [ ] All 11 sheets created with correct names
- [ ] Google Form linked to spreadsheet
- [ ] All 25 .gs files copied to Apps Script
- [ ] `constants.gs` updated with your IDs and emails
- [ ] Triggers created (at least `runGestionesAutomation`)
- [ ] Test form submission successful
- [ ] Execution log shows successful run (even if with warnings)
- [ ] Email permissions granted (first run prompted)
- [ ] Master data populated in "Datos Apoyo - WORKDAY"

### Post-Setup Configuration

1. **Populate Master Data** in "Datos Apoyo - WORKDAY":
   - GEOS (geographic locations)
   - CIB codes (cost centers)
   - Supervisories (manager names/codes)
   - Physical locations
   - Any other lookup tables

2. **Update Form Dropdowns**:
   - Run `updateAllFormDropdowns()` manually
   - Or wait for scheduled trigger (02:00 AM)
   - Form dropdowns now pull from master data

3. **Test Full Workflow**:
   - Submit ALTA (hiring) request
   - Wait 30 min for automation
   - Check email for confirmation
   - Verify "Respuestas Ordenadas" sheet updated
   - Check queue sheet (e.g., "Gestion ALTAS - WORKDAY")

---

## Part 7: Production Deployment

### Before Going Live

1. **Backup your data**

File → Download all sheets as Excel


2. **Test with real data** (small batch)

Submit 5-10 real requests
Verify system processes correctly
Check confirmation emails


3. **Adjust trigger timing**

If processing is slow, increase interval (e.g., every 60 min)
If users complain about delays, decrease to every 15 min


4. **Monitor logs regularly**

Check Apps Script Execution log weekly
Look for error patterns
Address issues proactively


### Ongoing Maintenance

**Weekly:**
- Check Execution log for errors
- Verify emails being sent
- Spot-check processed requests

**Monthly:**
- Archive old data (move to backup sheet)
- Review "Rechazadas" (error log)
- Update master data if needed

**Quarterly:**
- Review performance metrics
- Optimize trigger timing
- Plan upgrades/customizations

---

## Customization Examples

### Change Email Recipients

In `constants.gs`:
```javascript
const EMAIL_GESTIONES = 'your-new-email@company.com';
```

### Add New Validation Rule

In `validar-ftes.gs`, add to `validateFTERow_()`:
```javascript
// Example: Reject if worker > 50 years old
const age = calculateAge(dob);
if (age > 50) {
  return { valid: false, reason: 'Worker age exceeds limit' };
}
```

### Change Email Template Colors

In `email-gestiones-realizadas.gs`, modify `getTypeColor()`:
```javascript
case 'ALTA': return '#0066cc'; // Change from green to blue
```

### Add New Request Type

1. Add to Form: New question "Tipo Gestion" option
2. Create sheet: "Gestion MYNEWTYPE - WORKDAY"
3. Create snapshot: `snapshotMynewtypePendientesToQueue()`
4. Create output: `createMynewtypeOutputXlsxFromTemplate()`
5. Update orchestrator: Add to `runGestionesAutomation()`

---

## Troubleshooting

### Script Execution Fails

**Check Execution Log:**
1. Apps Script → **Execution log** (clock icon)
2. Click on failed execution
3. Read error message carefully

**Common errors:**
- `Cannot read property 'getSheetByName' of null`
  → Sheet ID wrong in constants.gs

- `Column not found: "..."` 
  → Header name missing or misspelled

- `Timeout: This script is taking too long to run`
  → Processing too many rows; increase batch size

### Form Responses Not Processing

1. Verify form linked to spreadsheet
2. Check "Form responses 1" sheet exists
3. Manually run `volcadoRespuestasOrdenadas()` and check logs

### Emails Not Sending

1. Verify `EMAIL_GESTIONES` is valid in constants.gs
2. Check Gmail has been accessed from your account
3. Manually run `enviarCorreosGestionRealizadaWorkday()` and check logs

### Data Not Appearing in Queues

1. Check "Respuestas Ordenadas - WORKDAY" sheet has data
2. Verify Status column is empty (not "OK" or "ERROR")
3. Manually run `snapshotAltasPendientesToQueue()` and check logs

---

## Getting Help

If you encounter issues:

1. **Check logs**: Apps Script → Execution log (most info here)
2. **Review docs**: ARCHITECTURE.md has module details
3. **Check permissions**: Verify script has access to Sheet
4. **Test manually**: Run individual functions to isolate issues
5. **Enable debug logging**: Add `Logger.log()` statements in functions

---

## Next Steps

1. ✅ Complete setup (all steps above)
2. ✅ Test with sample data
3. 📋 Document your customizations
4. 📧 Train HR team on form usage
5. 📊 Monitor for 2 weeks in production
6. 🔄 Adjust based on feedback

Good luck! 🚀# Setup & Installation Guide

## Prerequisites

Before starting, ensure you have:

- ✅ **Google Workspace account** (Gmail, Google Drive access)
- ✅ **Google Forms** (ability to create forms)
- ✅ **Google Sheets** (ability to create spreadsheets)
- ✅ **Google Apps Script** (access to script editor)
- ✅ **Workday credentials** (optional, for EIB import)
- ✅ **Basic technical knowledge** (Google Sheets, simple scripting)

---

## Part 1: Create Infrastructure

### Step 1.1: Create Master Google Sheet

This is where all data lives. Create a new Google Sheet:

1. Go to **sheets.google.com**
2. Click **"+ New"** → **"Google Sheet"**
3. Name it: `External Management - WORKDAY`
4. Share with your HR team (Edit access)

### Step 1.2: Create Required Sheets

Inside the spreadsheet, create these 8 sheets by right-clicking tabs:

**INPUT SHEETS:**
Form responses 1 ← Auto-created when linking form

**PROCESSING SHEETS:**
Respuestas Ordenadas - WORKDAY (ordered/transformed responses)
Gestion ALTAS - WORKDAY (hiring queue)
Gestion BAJAS - WORKDAY (termination queue)
Gestion MODIFICACIONES - AREA - WORKDAY
Gestion MODIFICACIONES - FECHA FINAL - WORKDAY
Gestion CONSULTAS - WORKDAY (query results)

**ARCHIVE SHEETS:**
Gestiones Realizadas - WORKDAY (success archive)
Rechazadas - WORKDAY (error log)

**MASTER DATA:**
Datos Apoyo - WORKDAY (reference tables)
Traducciones - WORKDAY (translation maps)

**Total: 11 sheets**

### Step 1.3: Add Headers to Processing Sheets

For **Respuestas Ordenadas - WORKDAY** (Row 1), add headers:

A: ID Peticion
B: Timestamp
C: Tipo Gestion
D: Status
E: Nombre
F: Email
G: Supervisory
H: Empresa
... (continue for all columns in your form)


For **Gestion ALTAS - WORKDAY** (Row 1), add headers:

A: ID Peticion
B: Tipo Gestion
C: Worker Name
D: Worker ID
E: Start Date
F: End Date
... (map to your columns)


Repeat for other queue sheets (BAJAS, MODIF-AREA, MODIF-FF, CONSULTAS)

For **Datos Apoyo - WORKDAY** (Row 1), add master data columns:

A: GEOS
B: CIB
C: Supervisory
D: Location
E-Z: Other reference tables


**Populate with your organization's master data starting Row 2**

### Step 1.4: Create Google Form

1. Go to **forms.google.com**
2. Click **"+ Create new form"**
3. Name it: `External Workforce Management Request`
4. Add these questions:

**Basic Info:**
- Tipo Gestion (Multiple choice: ALTA / BAJA / MODIFICACION / CONSULTA)
- Nombre Trabajador (Short answer)
- ID Trabajador (Short answer)

**For ALTA:**
- Fecha Inicio (Date)
- Fecha Fin (Date)
- Rol (Short answer)
- Supervisory (Dropdown - will be dynamic)
- Empresa (Dropdown - will be dynamic)

**For BAJA:**
- Fecha Termination (Date)
- Motivo Baja (Dropdown - will be dynamic)

**For MODIFICACION:**
- Subtipo (Multiple choice: AREA / FECHA FINAL)
- Nueva Ubicacion (Short answer)
- Nueva Fecha Fin (Date, if FECHA FINAL)

**For CONSULTA:**
- Query Type (Multiple choice: BY_WORKER / BY_SUPERVISORY)

5. **Link form to spreadsheet:**
   - Click **"⋮"** (three dots) → **"Select response destination"**
   - Choose your `External Management - WORKDAY` spreadsheet
   - Click **"Create"** or **"Select"**

**This auto-creates "Form responses 1" sheet**

---

## Part 2: Deploy Google Apps Script

### Step 2.1: Open Google Apps Script Editor

1. In your Google Sheet, go to **Tools** → **Script editor**
2. This opens Google Apps Script IDE
3. You should see an empty `Code.gs` file

### Step 2.2: Copy All Script Files

You have **25 .gs files** to copy. There are 2 methods:

**Method A: Copy-Paste (Simple but Manual)**
1. For each .gs file in the repo:
   - Open the file on GitHub (raw view)
   - Copy all content
   - In Apps Script IDE, create new file: **"+ New"** → **"Script"**
   - Name it (e.g., `constants.gs`)
   - Paste content
   - Repeat for all 25 files

**Method B: GitHub Sync (Advanced)**
1. Use **GitHub Desktop** or **clasp** CLI tool
2. Clone the repo locally
3. Use `clasp` to push to Apps Script

**For now, Method A is recommended**

### Step 2.3: Important: Update `constants.gs`

Before saving scripts, update the configuration in `constants.gs`:

```javascript
// Find these lines and update:

const SPREADSHEET_ID_RESPUESTAS = '{YOUR_SHEET_ID}';
// Get ID from your Sheet's URL: https://docs.google.com/spreadsheets/d/[THIS_ID]/edit

const FORM_ID = '{YOUR_FORM_ID}';
// Get ID from Form's URL: https://docs.google.com/forms/d/[THIS_ID]/edit

const EMAIL_GESTIONES = 'your-email@company.com';
// Your HR team email for notifications

const EMAIL_STAFFING = 'staffing@company.com';
// Staffing team email

const URL_DESTINO_WEB_APP = '{WEBAPP_URL}';
// Optional: URL for file download links (leave as-is for now)
```

### Step 2.4: Set Execution Permissions

After copying all files:

1. Click **"<> Editor"** (should be default)
2. Select any function from dropdown (e.g., `runGestionesAutomation`)
3. Click **"▶ Run"** (play button)
4. **First run**: Google will ask for permissions
   - Click **"Review permissions"**
   - Click your account
   - Click **"Allow"** (authorize the script)
5. Script will fail the first time (missing sheets), but permissions are granted

---

## Part 3: Set Up Automation Triggers

### Step 3.1: Create Time-Based Triggers

1. In Apps Script, click **"⏰ Triggers"** (left sidebar)
2. Click **"+ Create new trigger"**

**Trigger 1: Main Automation**

Function to run: runGestionesAutomation
Deployment: Head
Event source: Time-driven
Type of time interval: Minutes timer
Interval: 30 minutes
Failure notification: Email me immediately

Click **"Save"**

**Trigger 2: Confirmations (Optional)**

Function to run: runConfirmacionesAutomation
Deployment: Head
Event source: Time-driven
Type of time interval: Hour timer
Interval: 1 hour
Failure notification: Email me immediately

Click **"Save"**

**Trigger 3: Form Dropdown Updates (Optional)**

Function to run: updateAllFormDropdowns
Deployment: Head
Event source: Time-driven
Type of time interval: Day timer
Interval: Daily
Time: 02:00 AM
Failure notification: Email me immediately

Click **"Save"**

### Step 3.2: Verify Triggers

1. Back in Apps Script, click **"⏰ Triggers"**
2. You should see 2-3 triggers listed
3. Check status: **"Last run"** and **"Next run"** should show dates

---

## Part 4: Testing & Validation

### Step 4.1: Submit Test Form Response

1. Go to your Google Form
2. Click **"Preview"** (eye icon)
3. Fill it out with test data:

Tipo Gestion: ALTA
Nombre: John Test
ID: TEST001
Fecha Inicio: 2025-01-01
Fecha Fin: 2025-12-31
Rol: Test Engineer
Supervisory: Test Manager
Empresa: Test Corp

4. Click **"Submit"**

### Step 4.2: Monitor Execution

1. Go back to Google Sheet
2. Check **"Form responses 1"** sheet - your response should appear

**Wait 30 seconds, then:**

3. Go to Apps Script → **"Execution log"** (clock icon)
4. You should see recent executions
5. Click on latest to see details

**Expected (First run will error because sheets need setup):**

[INFO] runGestionesAutomation: START
[ERROR] Missing required sheets
[INFO] runGestionesAutomation: COMPLETE


### Step 4.3: Manual Test Run

If you don't want to wait 30 min for trigger:

1. Apps Script → **"Select function"** dropdown
2. Choose `runGestionesAutomation`
3. Click **"▶ Run"** (play button)
4. Check Execution log for results

---

## Part 5: Fix Common Setup Issues

### Issue 1: "Missing required sheets"

**Cause:** Sheet names don't match `constants.gs`

**Fix:**
1. Check your sheet names exactly match those in `constants.gs`
2. Case-sensitive! `Gestion ALTAS - WORKDAY` ≠ `gestion altas - workday`

### Issue 2: "Column not found"

**Cause:** Headers in sheets don't match what scripts expect

**Fix:**
1. Add all expected headers to Row 1 of each sheet
2. Script looks for: `resolveCols_(sheet, HEADER_ROW_RO, {...})`
3. Verify column names match your form structure

### Issue 3: "Emails not sending"

**Cause:** EMAIL_GESTIONES not set or invalid

**Fix:**
1. Check `constants.gs` - `EMAIL_GESTIONES` should be valid email
2. Test: Click **▶ Run** → check Execution log for email errors
3. Verify your Google account has Gmail access

### Issue 4: "Form responses not appearing"

**Cause:** Form not linked to spreadsheet

**Fix:**
1. In Google Form: **⋮** → **"Select response destination"**
2. Choose your `External Management - WORKDAY` sheet
3. Re-submit test form

---

## Part 6: Verify Everything Works

### Checklist Before Going Live

- [ ] All 11 sheets created with correct names
- [ ] Google Form linked to spreadsheet
- [ ] All 25 .gs files copied to Apps Script
- [ ] `constants.gs` updated with your IDs and emails
- [ ] Triggers created (at least `runGestionesAutomation`)
- [ ] Test form submission successful
- [ ] Execution log shows successful run (even if with warnings)
- [ ] Email permissions granted (first run prompted)
- [ ] Master data populated in "Datos Apoyo - WORKDAY"

### Post-Setup Configuration

1. **Populate Master Data** in "Datos Apoyo - WORKDAY":
   - GEOS (geographic locations)
   - CIB codes (cost centers)
   - Supervisories (manager names/codes)
   - Physical locations
   - Any other lookup tables

2. **Update Form Dropdowns**:
   - Run `updateAllFormDropdowns()` manually
   - Or wait for scheduled trigger (02:00 AM)
   - Form dropdowns now pull from master data

3. **Test Full Workflow**:
   - Submit ALTA (hiring) request
   - Wait 30 min for automation
   - Check email for confirmation
   - Verify "Respuestas Ordenadas" sheet updated
   - Check queue sheet (e.g., "Gestion ALTAS - WORKDAY")

---

## Part 7: Production Deployment

### Before Going Live

1. **Backup your data**

File → Download all sheets as Excel


2. **Test with real data** (small batch)

Submit 5-10 real requests
Verify system processes correctly
Check confirmation emails


3. **Adjust trigger timing**

If processing is slow, increase interval (e.g., every 60 min)
If users complain about delays, decrease to every 15 min


4. **Monitor logs regularly**

Check Apps Script Execution log weekly
Look for error patterns
Address issues proactively


### Ongoing Maintenance

**Weekly:**
- Check Execution log for errors
- Verify emails being sent
- Spot-check processed requests

**Monthly:**
- Archive old data (move to backup sheet)
- Review "Rechazadas" (error log)
- Update master data if needed

**Quarterly:**
- Review performance metrics
- Optimize trigger timing
- Plan upgrades/customizations

---

## Customization Examples

### Change Email Recipients

In `constants.gs`:
```javascript
const EMAIL_GESTIONES = 'your-new-email@company.com';
```

### Add New Validation Rule

In `validar-ftes.gs`, add to `validateFTERow_()`:
```javascript
// Example: Reject if worker > 50 years old
const age = calculateAge(dob);
if (age > 50) {
  return { valid: false, reason: 'Worker age exceeds limit' };
}
```

### Change Email Template Colors

In `email-gestiones-realizadas.gs`, modify `getTypeColor()`:
```javascript
case 'ALTA': return '#0066cc'; // Change from green to blue
```

### Add New Request Type

1. Add to Form: New question "Tipo Gestion" option
2. Create sheet: "Gestion MYNEWTYPE - WORKDAY"
3. Create snapshot: `snapshotMynewtypePendientesToQueue()`
4. Create output: `createMynewtypeOutputXlsxFromTemplate()`
5. Update orchestrator: Add to `runGestionesAutomation()`

---

## Troubleshooting

### Script Execution Fails

**Check Execution Log:**
1. Apps Script → **Execution log** (clock icon)
2. Click on failed execution
3. Read error message carefully

**Common errors:**
- `Cannot read property 'getSheetByName' of null`
  → Sheet ID wrong in constants.gs

- `Column not found: "..."` 
  → Header name missing or misspelled

- `Timeout: This script is taking too long to run`
  → Processing too many rows; increase batch size

### Form Responses Not Processing

1. Verify form linked to spreadsheet
2. Check "Form responses 1" sheet exists
3. Manually run `volcadoRespuestasOrdenadas()` and check logs

### Emails Not Sending

1. Verify `EMAIL_GESTIONES` is valid in constants.gs
2. Check Gmail has been accessed from your account
3. Manually run `enviarCorreosGestionRealizadaWorkday()` and check logs

### Data Not Appearing in Queues

1. Check "Respuestas Ordenadas - WORKDAY" sheet has data
2. Verify Status column is empty (not "OK" or "ERROR")
3. Manually run `snapshotAltasPendientesToQueue()` and check logs

---

## Getting Help

If you encounter issues:

1. **Check logs**: Apps Script → Execution log (most info here)
2. **Review docs**: ARCHITECTURE.md has module details
3. **Check permissions**: Verify script has access to Sheet
4. **Test manually**: Run individual functions to isolate issues
5. **Enable debug logging**: Add `Logger.log()` statements in functions

---

## Next Steps

1. ✅ Complete setup (all steps above)
2. ✅ Test with sample data
3. 📋 Document your customizations
4. 📧 Train HR team on form usage
5. 📊 Monitor for 2 weeks in production
6. 🔄 Adjust based on feedback

Good luck! 🚀
