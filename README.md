# A Little World for Kirti — reviewed project bundle

## Files
- `index.html`: main page and all frontend element IDs used by `app.js`.
- `style.css`: responsive styling.
- `app.js`: Firebase email/password auth, photo challenge UI, browser-side photo optimization, backend client and diagnostic timings.
- `Code.gs`: Google Apps Script backend with grouped Drive writes and one Sheets append per upload group.
- `.github/workflows/static.yml`: GitHub Pages Actions workflow.

## Important deployment and security status
This bundle is based on the saved project files available in this chat. It has not been end-to-end tested against your live Firebase, Drive, Sheets, Apps Script deployment, or GitHub repository. Do not treat it as production-certified.

`app.js` intentionally keeps `ENABLE_REAL_UPLOADS = false`. Apps Script must also keep `ENABLE_UPLOADS` and `ENABLE_GALLERY` false until authentication is implemented with trusted Firebase ID-token verification and all backend actions are security-reviewed. The current `verifyFirebaseToken()` uses Identity Toolkit `accounts:lookup`, which is not a full replacement for Firebase Admin SDK `verifyIdToken()` signature/issuer/audience/expiry/revocation validation. The current frontend security lock means sign-in/registration can work, but upload and gallery actions are intentionally unavailable.

## Setup
1. Upload the root files and `.github/workflows/static.yml` to the `main` branch of `introvert876/Surprise`.
2. In GitHub repository Settings → Pages, select **GitHub Actions** as the build/deployment source.
3. Check Actions after pushing. The workflow uploads only the repository contents as the Pages artifact and uses the official Pages deployment action.
4. In Firebase Console → Authentication → Settings → Authorized domains, confirm `introvert876.github.io` is authorized. Enable Email/Password sign-in.
5. For Apps Script, configure Script Properties `FIREBASE_API_KEY`, `ENABLE_UPLOADS=false`, and `ENABLE_GALLERY=false`. Keep both Drive folders private. Verify spreadsheet headers before running `initializeBackend()`.

## Fixes made in this review
- Removed a reveal-screen consent check that depended on the upload-panel checkbox. The checkbox is hidden on the reveal screen and is reset after an upload, so this check could prevent an eligible user from revealing the gallery. Upload consent is still required before uploading photos.
- Added browser-side image optimization for still images: large photos are resized to a maximum 1280-pixel long edge and JPEG-compressed at quality 0.74 where this reduces file size. Animated GIFs are kept unchanged. This reduces upload bytes, but optimized files may differ from the selected originals.
- Changed a 30-photo challenge to use one grouped upload request (up to 30 photos per request), instead of six requests of five photos each.
- Reworked the grouped Apps Script handler to validate hashes first, acquire the script lock once per group, load existing upload rows once, write Drive files in the group, and append new upload records to Sheets in one range write rather than per-photo append/recount operations.
- Added server timing logs for group processing, Drive writes, the Sheets write, and the final request.

## Upload speed caveat
These changes are performance optimizations, not proof that every 30-photo attempt will finish in under 10 seconds. Real duration depends on phone CPU/memory, photo sizes, network upload speed, Firebase token retrieval, Apps Script startup, and Google Drive service latency. The website's upload feature remains deliberately disabled in this bundle, so no live timing benchmark has been run. Do not enable the upload switches solely on the strength of the code changes; run an authenticated end-to-end test first and measure the `[TIMING]` logs.

## Verification performed on this bundle
- JavaScript parser check (`node --check app.js`).
- Apps Script JavaScript syntax/parser check (parsed by Node after copying the `.gs` source to a temporary `.js` file; this does not emulate Apps Script services).
- HTML-to-JavaScript required element-ID consistency check.
- Backend action/response contract inspection for `beginBatch`, `uploadPhotoBatch`, `finishBatch`, `revealStatus`, `revealGallery`, `listGallery`, and `getGalleryImage`.
- Basic CSS/HTML/workflow presence checks.

Not performed: real Firebase login, real email reset, Apps Script deployment calls, Drive upload/retrieval, Sheets mutation, or live GitHub Actions execution; these require access to your external accounts and live services. The current security lock intentionally prevents photo uploads and gallery access in the frontend, and the backend Script Properties must remain disabled until trusted ID-token verification and live contract testing are complete. Therefore this bundle is not yet a fully enabled production deployment. Never paste passwords or private service credentials into chat.
