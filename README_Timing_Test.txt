KIRTI PHOTO WEBSITE - TIMING DIAGNOSTICS BUILD

FILES
- app.js: Frontend with browser timing logs.
- Code.gs: Apps Script backend with server timing logs.

PRESERVED BEHAVIOR
- Five photos per request.
- At most two upload groups concurrently.
- 30 new unique photos in one batch required for qualification.
- Exact-byte SHA-256 duplicate checks remain server-side.
- ENABLE_REAL_UPLOADS remains false in app.js.
- Backend Script Properties ENABLE_UPLOADS and ENABLE_GALLERY
  must remain false until authentication and endpoint compatibility
  have been reviewed.

BROWSER LOGS
Open browser Developer Tools > Console and filter for [TIMING].

These include:
- Firebase token retrieval duration
- Request payload size
- Request/response latency
- Response JSON parsing
- Per-file FileReader/Base64 preparation
- Group preparation
- Overall upload attempt duration

APPS SCRIPT LOGS
Deploy the updated Code.gs as a new web app version.

Open Apps Script > Executions and inspect logs for [TIMING].

These include:
- Firebase account lookup
- Total action duration
- Base64 decoding
- Image signature validation
- SHA-256 hashing
- Script lock wait
- Duplicate checking
- Batch scans
- Drive file creation
- Sheets writes

MEASUREMENT NOTE
Browser fetch duration includes network time, server execution,
and response return. It is not a pure network-transfer measurement.

Compare browser timings with the corresponding Apps Script
requestId and serverElapsedMs to estimate where time is spent.

Apps Script Date.now() measurements have millisecond granularity.

SAFETY
Do not enable real uploads just to collect timings until token
verification and upload compatibility have been security-reviewed.

The current Apps Script accounts:lookup flow is a prototype,
not full Firebase Admin SDK ID-token verification.

Do not make Drive folders public.
