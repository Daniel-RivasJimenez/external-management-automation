# Troubleshooting & FAQ

## Table of Contents
1. [Common Errors](#common-errors)
2. [Performance Issues](#performance-issues)
3. [Email Problems](#email-problems)
4. [Data Issues](#data-issues)
5. [Google Forms Issues](#google-forms-issues)
6. [Workday Integration](#workday-integration)
7. [FAQ](#faq)

---

## Common Errors

### Error: "Cannot read property 'getSheetByName' of null"

**What it means:** The script can't find your spreadsheet

**Causes:**
- Wrong Spreadsheet ID in `constants.gs`
- Spreadsheet deleted or you lost access
- App Script not bound to the spreadsheet

**Fix:**
1. Check Spreadsheet ID in `constants.gs`:
```javascript
   const SPREADSHEET_ID_RESPUESTAS = '{YOUR_SHEET_ID}';
```
2. Get correct ID from Sheet URL:

https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_ID]/edit

3. Copy-paste the ID (between `/d/` and `/edit`)
4. Save and re-run

### Error: "Column not found: 'XYZ'"

**What it means:** Script is looking for a column header that doesn't exist

**Causes:**
- Header name misspelled in sheet
- Column not added to sheet
- Header is in wrong row (should be row 1)
- Column was deleted accidentally

**Fix:**
1. Check all headers in Row 1 of the sheet
2. Look at the error message - it tells you which column is missing
3. Add the column if missing
4. Verify spelling exactly matches (case-sensitive)
5. Re-run function

**Example:**

Error: Column not found: "Supervisory"
→ Check that Row 1 has exactly "Supervisory" (not "supervisory" or "SUPERVISORY")


### Error: "Timeout: This script is taking too long to run"

**What it means:** Script exceeded Google Apps Script's 6-minute execution limit

**Causes:**
- Processing too many rows (100K+) in single batch
- Too many API calls (should batch)
- Waiting for external API response

**Fix:**
1. Check how many rows are in "Form responses 1"
   - If >10K: Increase batch size in `volcadoRespuestasOrdenadas()`
```javascript
   const BATCH_SIZE = 1000; // Increase from 500
```

2. Increase delay between batches:
```javascript
   Utilities.sleep(200); // Increase from 100
```

3. If still timing out: Split processing
   - Run ETL separately from snapshots
   - Run each snapshot type separately

### Error: "Exception: You do not have permission to call getRange()"

**What it means:** Script doesn't have access to the sheet

**Causes:**
- First-time run (permissions not granted)
- Lost access to sheet
- Spreadsheet is in trash

**Fix:**
1. Grant permissions:
   - Run any function manually
   - Click "Review permissions" when prompted
   - Click your account and "Allow"

2. Check sheet isn't in trash:
   - Go to Google Drive
   - Check Trash folder
   - Restore if needed

3. Verify you have Edit access:
   - Open sheet → Share → Check your permissions

### Error: "ReferenceError: X is not defined"

**What it means:** Variable or function doesn't exist

**Causes:**
- Typo in function name
- Function file wasn't copied
- Variable name misspelled

**Fix:**
1. Check typo: `voltadoRespuestasOrdenadas` vs `volcadoRespuestasOrdenadas`
2. Verify all 25 .gs files are copied to Apps Script
3. Check spelling in `constants.gs`

---

## Performance Issues

### Issue: Script runs slowly (takes 5+ minutes)

**Causes:**
- Large dataset (50K+ rows)
- Too many API calls
- Not batching writes
- Triggers running simultaneously

**Fix:**
1. Reduce data:
   - Archive old data to separate sheet
   - Delete test rows
   - Keep "Form responses 1" < 50K rows

2. Optimize batch size:
```javascript
   const BATCH_SIZE = 1000; // Larger = faster but higher memory
```

3. Check for concurrent runs:
   - Apps Script → Triggers
   - Verify only one trigger runs at a time
   - Adjust timing (e.g., 30 min vs 15 min)

4. Use LockService:
   - Ensures only one execution at a time
   - Prevents overlapping runs

### Issue: "Quota exceeded: Email quota exceeded"

**What it means:** Too many emails sent too quickly

**Causes:**
- Sending emails to 1000+ people in single run
- Running confirmations multiple times
- Email list includes many invalid addresses

**Fix:**
1. Batch email sending:
   - Don't send all emails in one trigger
   - Spread across multiple runs

2. Filter recipients:
   - Only send to valid email addresses
   - Add validation before sending

3. Increase time between confirmations trigger:
   - Set to run every 2 hours instead of 1 hour
   - Apps Script → Triggers → Edit

---

## Email Problems

### Issue: Emails not being sent

**Check 1: Configuration**
```javascript
// In constants.gs, is this set?
const EMAIL_GESTIONES = 'your-real-email@company.com';

// Not this (placeholder):
const EMAIL_GESTIONES = '{CORPORATE_EMAIL_GESTIONES}';
```

**Fix:** Update to real email address

**Check 2: Permissions**
- First time running email functions?
- Click ▶ Run → Google prompts for permissions
- Must click "Allow" to grant Gmail access

**Fix:**
1. Apps Script → Select `enviarCorreosGestionRealizadaWorkday`
2. Click ▶ Run
3. Click "Review permissions"
4. Click your account and "Allow"

**Check 3: Recipients exist**
```javascript
// Is the recipient email set?
const recipient = requestData.email || EMAIL_GESTIONES;

// If requestData.email is empty string or null:
// Falls back to EMAIL_GESTIONES (your email)
```

**Fix:** Ensure form has email field or hardcode in constants.gs

**Check 4: Logs**
1. Apps Script → Execution log
2. Click on the email function execution
3. Look for errors:

[ERROR] enviarCorreosGestionRealizadaWorkday: 'to' is required
→ Missing recipient email

[ERROR] MailApp.sendEmail: ...
→ Gmail API error; check permissions


### Issue: Emails being marked as spam

**Causes:**
- Using generic email address
- Too many HTML tags
- No unsubscribe link
- Sending from untrusted account

**Fix:**
1. Use company email (from your Workspace)
2. Simplify HTML templates (remove excess CSS)
3. Add footer with "Do not reply" message
4. Send test email to yourself first to verify formatting

### Issue: Recipients not receiving emails

**Causes:**
- Typo in email address
- Address is invalid (misspelled domain)
- Bounced as spam
- User disabled notifications

**Fix:**
1. Validate email format before sending:
```javascript
   if (!isValidEmail_(recipient)) {
     Logger.warn('Invalid email: ' + recipient);
     return;
   }
```

2. Check bounce notifications in Gmail
3. Verify address format (should be: name@company.com)
4. Test with your own email first

---

## Data Issues

### Issue: Data not appearing in "Respuestas Ordenadas - WORKDAY"

**Causes:**
- Form responses not appearing in "Form responses 1"
- ETL (volcado) hasn't run yet
- Sheet doesn't exist or name is wrong
- Headers don't match

**Fix:**
1. Check "Form responses 1" sheet:
   - Does it have data from form submission?
   - If not: Form not linked to sheet

2. Run ETL manually:
   - Apps Script → Select `volcadoRespuestasOrdenadas`
   - Click ▶ Run
   - Check Execution log for errors

3. Verify sheet exists:
   - Spreadsheet tabs: Do you see "Respuestas Ordenadas - WORKDAY"?
   - If not: Create it and add headers

### Issue: Duplicates appearing in queue sheets

**Causes:**
- Same form submission processed twice
- ETL deduplication not working
- Manually copied data

**Fix:**
1. Check "Respuestas Ordenadas - WORKDAY":
   - Duplicates should already be removed here
   - If duplicates exist: deduplication failed

2. Clear queue and re-run:
   - Delete rows from queue sheet (keep headers)
   - Run `snapshotAltasPendientesToQueue()` again

3. Verify timestamp column:
   - Form responses must have Timestamp column
   - Should be auto-created by Google Forms

### Issue: Data missing columns

**Causes:**
- Form changed (new fields added)
- Headers not updated in queue sheets
- Column deleted accidentally

**Fix:**
1. Check form fields match sheet headers:
   - Form: Does it have all necessary fields?
   - Sheet headers: Do they match?

2. Add missing column to sheet Row 1

3. Update column mappings if needed:
   - `resolveCols_()` should find columns dynamically

### Issue: Status column shows "ERROR" for all rows

**Causes:**
- Validation failed (FTE mismatch, invalid data)
- All requests rejected
- Validation function is too strict

**Fix:**
1. Check "Rechazadas - WORKDAY" sheet:
   - What's the error message?
   - This tells you why validation failed

2. Common validation issues:
   - FTE sum doesn't match declared total
   - Missing required fields
   - Invalid email format
   - Date format wrong (not YYYY-MM-DD)

3. Fix data and resubmit

---

## Google Forms Issues

### Issue: Form dropdown options not updating

**Causes:**
- `updateAllFormDropdowns()` hasn't run
- Master data sheet is empty
- Form question names don't match script expectations

**Fix:**
1. Populate master data:
   - Go to "Datos Apoyo - WORKDAY" sheet
   - Add GEOS, CIB, Supervisories, etc. in columns A-D

2. Run update manually:
   - Apps Script → Select `updateAllFormDropdowns`
   - Click ▶ Run
   - Check Execution log for which dropdowns updated

3. Verify question names:
   - In form: Question name should match:
     - "GEOS" or containing "GEOS"
     - "CIB" or containing "CIB"
     - "Supervisory" or containing "Supervisory"
   - Script uses partial matching, not exact

### Issue: Form responses not appearing in sheet

**Causes:**
- Form not linked to spreadsheet
- Link broken when sheet moved
- Sheet deleted

**Fix:**
1. In Google Form:
   - Click ⋮ (three dots)
   - Select "Select response destination"
   - Choose your External Management spreadsheet
   - Click "Select" or "Create"

2. Submit test form
3. Check "Form responses 1" sheet for new row

### Issue: Duplicate form submissions

**Causes:**
- User submitted twice by accident
- Browser cached submission
- Script processing delay

**Fix:**
1. Deduplication happens automatically:
   - `volcadoRespuestasOrdenadas()` deduplicates by timestamp
   - First submission kept, duplicates dropped

2. Manual fix (if urgent):
   - Delete duplicate row from "Form responses 1"
   - Run ETL again

---

## Workday Integration

### Issue: Output files not importing to Workday

**Causes:**
- EIB file format incorrect
- File headers don't match Workday schema
- Missing required fields

**Fix:**
1. Verify EIB file structure:
   - Check `buildXXXRow_()` functions
   - Ensure all required columns present
   - Column order matters for Workday

2. Compare to Workday template:
   - Get template from Workday team
   - Match field names exactly
   - Use same data types (date format, etc.)

3. Test with small batch:
   - Generate 1 file
   - Import manually to Workday
   - Check error messages
   - Adjust mapping if needed

### Issue: "Field mapping error" from Workday

**Causes:**
- Column names don't match Workday schema
- Data format wrong (date, currency, etc.)
- Missing required field

**Fix:**
1. Ask Workday team for EIB specification
2. Match column names exactly:
   - If Workday expects "Worker_ID", don't send "WorkerId"
3. Format dates consistently: YYYY-MM-DD
4. Validate required fields are populated

---

## FAQ

### Q: Can I run the automation manually?

**A:** Yes! 
1. Apps Script → Select the function you want
2. Click ▶ Run
3. Check Execution log for results

Useful for testing or running outside scheduled times.

### Q: What if I need to add a new request type?

**A:** Create:
1. New question in form
2. New sheet: "Gestion MYNEWTYPE - WORKDAY"
3. New snapshot: `snapshotMynewtypePendientesToQueue()`
4. New output: `createMynewtypeOutputXlsxFromTemplate()`
5. Update main orchestrator: `runGestionesAutomation()`

See ARCHITECTURE.md for detailed instructions.

### Q: How do I monitor what the system is doing?

**A:** 
1. **Real-time**: Apps Script → Execution log
2. **Data trail**: Check sheets:
   - "Form responses 1" (input)
   - "Respuestas Ordenadas" (transformed)
   - Queue sheets (pending)
   - "Gestiones Realizadas" (success)
   - "Rechazadas" (errors)
3. **Email**: Check inbox for notifications

### Q: Can I customize email templates?

**A:** Yes! Edit:
1. `enviarCorreosGestionRealizadaWorkday()` - success emails
2. `enviarCorreosRechazadasWorkday()` - rejection emails
3. `enviarCorreosConsultaFechaFinal()` - query results

Functions like `buildConfirmationEmailHtml_()` contain HTML. Change:
- Colors: `background-color: #00A86B;`
- Text: "Gestión Procesada" → your message
- Fields: Add/remove fields from template

### Q: How often does automation run?

**A:** By default:
- Main automation: Every 30 minutes
- Confirmations: Every 1 hour
- Form dropdowns: Every day at 2 AM

Change in Apps Script → Triggers → Edit

### Q: What if I want to disable a request type?

**A:** 
1. Option A: Don't snapshot it
   - Comment out `snapshotXXXPendientesToQueue()` in main orchestrator

2. Option B: Remove form question
   - Delete from Google Form
   - Users can't submit that type

3. Option C: Archive and hide
   - Move data to archive sheet
   - Keep code but trigger manually only

### Q: How do I backup my data?

**A:**
1. Google Sheets → File → Download all sheets as Excel
2. Store in Google Drive or local machine
3. Do this weekly or before major changes

### Q: Can multiple people use the form?

**A:** Yes! 
- Form is open to anyone with link
- All submissions go to same sheet
- All data processed automatically
- Confirmations sent to each submitter

### Q: What if a request fails validation?

**A:**
1. Status set to "ERROR"
2. Copied to "Rechazadas" sheet with error message
3. Rejection email sent to submitter
4. Submitter fixes data and resubmits

### Q: How do I know if something broke?

**A:**
1. Check Apps Script → Execution log
2. Look for red ✗ (failed executions)
3. Click to see error message
4. Use this guide to troubleshoot

### Q: Who can see the data?

**A:**
- Form: Public (anyone with link can submit)
- Sheet: Private (only people with access)
- Scripts: Execute as sheet owner
- Emails: Only go to specified recipients

Adjust sheet sharing in: Sheet → Share → Change permissions

### Q: Can I undo a processed request?

**A:** Partial undo:
1. Find request in "Gestiones Realizadas" (success) or "Rechazadas" (error)
2. Delete the row
3. Manually undo in Workday if already imported
4. Resubmit form if needed

No automatic rollback - be careful with deletions!

### Q: How much does this cost?

**A:** Free! (Within Google Workspace quotas)
- Google Forms: Free
- Google Sheets: Free
- Google Apps Script: Free (up to quota limits)
- Gmail: Free (within workspace)

Workday EIB import: Check with Workday pricing

---

## Still Having Issues?

1. **Check logs**: Apps Script → Execution log (start here!)
2. **Review ARCHITECTURE.md**: Details on each module
3. **Check SETUP.md**: Verify configuration is correct
4. **Manual test**: Run functions individually to isolate problem
5. **Enable logging**: Add `Logger.log()` statements to debug

If stuck: Share the error message and steps to reproduce, and we can help!
