import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCRwg_4QZ1RTax0fR8YXHNUMKjTGlhoAFI",
  authDomain: "name-840f3.firebaseapp.com",
  projectId: "name-840f3",
  storageBucket: "name-840f3.firebasestorage.app",
  messagingSenderId: "522532386468",
  appId: "1:522532386468:web:1341b069b6c1fb919dd831",
  measurementId: "G-7NK90QTMCT"
};

// ============================================================
// GOOGLE APPS SCRIPT BACKEND
// ============================================================

const BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbwd5R1YTjVv1LfS8MxnFV69_sxosGRvxIyUR1sNUuWVnmAJHafcLASX-H96AaNicLU04g/exec";

const MINIMUM_PHOTOS = 30;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit for full quality
const MAX_BATCH_FILES = 100;

// Set to true since the backend changes have been implemented
const ENABLE_REAL_UPLOADS = true;

// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

let mode = "login";
let selectedFiles = [];
let busy = false;

// ============================================================
// STATUS HELPERS
// ============================================================

function showStatus(id, message, error = false) {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = error ? "#a4234d" : "#39764b";
}

function showPanel(id) {
  [
    "auth-panel",
    "upload-panel",
    "reveal-panel",
    "gallery-panel"
  ].forEach((panelId) => {
    const element = $(panelId);
    if (element) {
      element.classList.toggle("hidden", panelId !== id);
    }
  });
}

function setBusy(value) {
  busy = value;
  if ($("auth-submit")) $("auth-submit").disabled = value;
  refreshUploadButton();
  if ($("reveal-button")) $("reveal-button").disabled = value;
}

function refreshUploadButton() {
  const button = $("upload-button");
  const consent = $("consent");
  if (!button || !consent) return;
  const hasImages = selectedFiles.some((file) => file.type.startsWith("image/"));
  button.disabled = busy || !hasImages || !consent.checked;
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email. Please sign in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };
  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}

// ============================================================
// BACKEND REQUEST HELPER
// ============================================================

async function backendRequest(payload) {
  if (!BACKEND_URL) throw new Error("Backend URL is not configured.");
  if (!auth.currentUser) throw new Error("Please sign in first.");

  const idToken = await auth.currentUser.getIdToken();
  const requestId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const requestBody = JSON.stringify({ ...payload, idToken, requestId });

  let response;
  try {
    response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: requestBody,
      redirect: "follow"
    });
  } catch (error) {
    throw new Error("Could not reach Apps Script. Check the deployment and access settings.");
  }

  if (!response.ok) throw new Error(`Backend request failed (HTTP ${response.status}).`);

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Backend did not return JSON. Check the Apps Script deployment.");
  }

  if (!result || result.success !== true) {
    throw new Error(result?.error || result?.message || "Backend rejected the request.");
  }

  return result;
}

function resultBatchId(result) {
  return result.batchId || result.batch_id || result.batch?.batch_id || result.batch?.batchId || null;
}

// ============================================================
// LOGIN / REGISTRATION MODE
// ============================================================

function setMode(nextMode) {
  mode = nextMode;
  $("show-login").classList.toggle("active", mode === "login");
  $("show-register").classList.toggle("active", mode === "register");
  $("name-wrap").classList.toggle("hidden", mode !== "register");
  $("confirm-wrap").classList.toggle("hidden", mode !== "register");
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-submit").textContent = mode === "login" ? "Sign in ❤️" : "Create account ❤️";
  $("auth-note").textContent = mode === "login" 
    ? "Sign in to continue to the private photo experience."
    : "Create an account to continue to the photo upload page.";
  showStatus("auth-status", "");
}

$("show-login").addEventListener("click", () => setMode("login"));
$("show-register").addEventListener("click", () => setMode("register"));

// ============================================================
// REGISTER / SIGN IN
// ============================================================

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const email = $("email").value.trim();
  const password = $("password").value;

  setBusy(true);

  try {
    if (mode === "register") {
      const name = $("display-name").value.trim();
      if (password !== $("confirm-password").value) throw new Error("Passwords do not match.");
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(credential.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    await routeSignedInUser();
  } catch (error) {
    showStatus("auth-status", friendlyError(error), true);
  } finally {
    setBusy(false);
  }
});

$("reset-password").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) {
    showStatus("auth-status", "Enter your email address first.", true);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showStatus("auth-status", "If the account exists, a password reset email has been sent.");
  } catch (error) {
    showStatus("auth-status", friendlyError(error), true);
  }
});

$("sign-out").addEventListener("click", async () => {
  try {
    await signOut(auth);
    resetSelection();
    showPanel("auth-panel");
  } catch (error) {
    showStatus("upload-status", "Could not sign out. Please try again.", true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    resetSelection();
    showPanel("auth-panel");
    return;
  }
  $("signed-in-as").textContent = user.displayName ? `${user.displayName} (${user.email || ""})` : (user.email || "");
  await routeSignedInUser();
});

async function routeSignedInUser() {
  if (!auth.currentUser) {
    showPanel("auth-panel");
    return;
  }

  $("signed-in-as").textContent = auth.currentUser.displayName ? `${auth.currentUser.displayName} (${auth.currentUser.email || ""})` : (auth.currentUser.email || "");

  if (!ENABLE_REAL_UPLOADS) {
    showPanel("upload-panel");
    showStatus("upload-status", "Sign-in works. Photo uploads and gallery access are temporarily disabled while backend security and deployment are verified.");
    refreshUploadButton();
    return;
  }

  try {
    const result = await backendRequest({ action: "revealStatus" });
    const revealed = Boolean(result.revealed || result.alreadyRevealed || result.galleryRevealed || result.hasRevealed);
    const eligible = Boolean(result.qualified || result.eligible || result.canReveal || result.qualifies);

    if (revealed) {
      await loadGallery();
    } else if (eligible) {
      showPanel("reveal-panel");
      showStatus("reveal-status", "Your photo challenge is complete. You can reveal the gallery.");
    } else {
      showPanel("upload-panel");
      showStatus("upload-status", "Choose new photos to begin a new attempt.");
    }
  } catch (error) {
    showPanel("upload-panel");
    showStatus("upload-status", "Could not verify backend status. Uploads and gallery access remain unavailable. " + error.message, true);
  }
}

// ============================================================
// PHOTO SELECTION
// ============================================================

function resetSelection() {
  selectedFiles = [];
  if ($("photos")) $("photos").value = "";
  if ($("consent")) $("consent").checked = false;
  if ($("selection-summary")) $("selection-summary").textContent = "No files selected.";
  refreshUploadButton();
}

$("photos").addEventListener("change", () => {
  selectedFiles = Array.from($("photos").files || []);
  const images = selectedFiles.filter((file) => file.type.startsWith("image/"));
  const nonImages = selectedFiles.length - images.length;
  const tooLarge = images.filter((file) => file.size > MAX_FILE_SIZE_BYTES).length;
  const totalBytes = images.reduce((sum, file) => sum + file.size, 0);

  let message = `${images.length} image(s) selected · ${(totalBytes / 1048576).toFixed(1)} MB total.`;
  if (nonImages) message += ` ${nonImages} non-image file(s) will be ignored.`;
  if (tooLarge) message += ` ${tooLarge} image(s) exceed the 10 MB limit.`;

  $("selection-summary").textContent = message;
  refreshUploadButton();
});

$("consent").addEventListener("change", () => refreshUploadButton());

// ============================================================
// FILE CONVERSION & PREPARATION
// ============================================================

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("Could not encode file."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// BYPASS COMPRESSION - KEEP 100% QUALITY
async function preparePhotoForUpload(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} exceeds the 10 MB limit.`);
  }
  return {
    originalFilename: file.name,
    mimeType: file.type,
    fileSize: file.size,
    base64Data: await blobToBase64(file)
  };
}

// ============================================================
// CONCURRENT UPLOAD SELECTED PHOTOS
// ============================================================

$("upload-button").addEventListener("click", async () => {
  if (busy) return;
  if (!auth.currentUser) {
    showStatus("upload-status", "Please sign in first.", true);
    return;
  }
  if (!$("consent").checked) {
    showStatus("upload-status", "Please agree to the photo upload terms.", true);
    return;
  }
  if (!ENABLE_REAL_UPLOADS) {
    showStatus("upload-status", "Uploads are disabled.", true);
    return;
  }

  const images = selectedFiles.filter((file) => file.type.startsWith("image/"));
  if (!images.length) {
    showStatus("upload-status", "Choose image files first.", true);
    return;
  }
  if (images.length > MAX_BATCH_FILES) {
    showStatus("upload-status", `Choose no more than ${MAX_BATCH_FILES} images per attempt.`, true);
    return;
  }

  setBusy(true);
  let uploaded = 0;
  let duplicates = 0;

  try {
    showStatus("upload-status", "Starting high-speed upload attempt…");
    const started = await backendRequest({ action: "beginBatch", consent: true });
    const batchId = resultBatchId(started);

    if (!batchId) throw new Error("Backend did not return a batch ID.");

    showStatus("upload-status", `Uploading ${images.length} original-quality photos...`);

    // CONCURRENCY LOOP: Run 4 uploads in parallel
    const CONCURRENCY_LIMIT = 4;
    let index = 0;

    async function uploadWorker() {
      while (index < images.length) {
        const currentIndex = index++;
        const file = images[currentIndex];
        
        try {
          const payload = await preparePhotoForUpload(file);
          const result = await backendRequest({
            action: "uploadPhoto", 
            batchId: batchId,
            consent: true,
            ...payload
          });

          if (result.duplicate) duplicates++;
          else if (result.uploaded) uploaded++;
          
          showStatus("upload-status", `Progress: ${uploaded + duplicates} / ${images.length} processed...`);
        } catch (error) {
          console.error(`Failed to upload ${file.name}`, error);
          throw error;
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, images.length) }, () => uploadWorker());
    await Promise.all(workers);

    showStatus("upload-status", "Verifying completion with server…");
    const finished = await backendRequest({ action: "finishBatch", batchId });

    resetSelection();

    if (finished.qualifies) {
      showPanel("reveal-panel");
      showStatus("reveal-status", `Success! ${finished.newUniquePhotos} new photos verified. You can reveal the gallery.`);
    } else {
      showStatus("upload-status", `Attempt incomplete. Only ${finished.newUniquePhotos} unique photos found.`, true);
    }

  } catch (error) {
    showStatus("upload-status", `Upload stopped: ${error.message} Check backend records.`, true);
  } finally {
    setBusy(false);
    refreshUploadButton();
  }
});

// ============================================================
// GALLERY REVEAL & PRIVATE GALLERY
// ============================================================

$("reveal-button").addEventListener("click", async () => {
  if (busy) return;
  if (!auth.currentUser) return showStatus("reveal-status", "Please sign in first.", true);
  if (!ENABLE_REAL_UPLOADS) return;

  const confirmed = window.confirm("Reveal the private gallery now? This action will be recorded.");
  if (!confirmed) return;

  setBusy(true);
  try {
    const result = await backendRequest({ action: "revealGallery", consent: true });
    showStatus("reveal-status", result.alreadyRevealed ? "Your gallery is already unlocked." : "Gallery unlocked successfully.");
    await loadGallery();
  } catch (error) {
    showStatus("reveal-status", error.message || "Unable to unlock the gallery.", true);
  } finally {
    setBusy(false);
  }
});

async function loadGallery() {
  if (!auth.currentUser) return;
  if (!ENABLE_REAL_UPLOADS) return;

  showPanel("gallery-panel");
  $("gallery").replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Loading your private gallery…";
  $("gallery").appendChild(loading);

  try {
    const result = await backendRequest({ action: "listGallery" });
    const images = Array.isArray(result.images) ? result.images : [];
    $("gallery").replaceChildren();

    if (images.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "The gallery is unlocked, but no pictures are available yet.";
      $("gallery").appendChild(empty);
      showStatus("reveal-status", "Gallery unlocked, but no photos were found.");
      return;
    }

    for (const item of images) {
      const fileId = item.id;
      if (!fileId) continue;

      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");
      image.alt = item.name || "Private gallery photo";
      image.loading = "lazy";
      image.decoding = "async";
      caption.textContent = item.name || "Our memory";
      figure.append(image, caption);
      $("gallery").appendChild(figure);

      try {
        const imageResult = await backendRequest({ action: "getGalleryImage", fileId });
        const mimeType = imageResult.mimeType || "image/jpeg";
        image.src = `data:${mimeType};base64,${imageResult.base64}`;
      } catch (error) {
        figure.remove();
      }
    }

    if (!$("gallery").children.length) {
      const message = document.createElement("p");
      message.textContent = "Gallery images could not be loaded.";
      $("gallery").appendChild(message);
    }

    showStatus("reveal-status", "Your private gallery is ready.");
  } catch (error) {
    showStatus("reveal-status", error.message || "Unable to load the gallery.", true);
  }
}
