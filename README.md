# A Little World for Kirti

## Files
- `index.html`: page structure
- `style.css`: responsive romantic styling
- `app.js`: Firebase email/password UI and verification

## Before use
1. In Firebase Console, enable Authentication > Email/Password.
2. Add your hosting domain to Authentication > Settings > Authorized domains.
3. Keep the Google Drive folder and spreadsheet private.
4. Do not deploy a public Apps Script upload endpoint until it verifies Firebase ID tokens and enforces all limits server-side.
5. In `app.js`, set `BACKEND_URL` only after that backend security work is complete.

The frontend intentionally does not upload files yet. Firebase client sign-in alone does not protect a public Apps Script endpoint. Do not collect anyone's photos until the page explains the storage purpose and they consent.
