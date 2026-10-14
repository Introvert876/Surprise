import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, updateDoc, serverTimestamp, increment, getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ============================================================
// ANTI-SAVE PROTECTIONS
// ============================================================
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dragstart", (e) => e.preventDefault());

// ============================================================
// CONFIGURATION
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

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwd5R1YTjVv1LfS8MxnFV69_sxosGRvxIyUR1sNUuWVnmAJHafcLASX-H96AaNicLU04g/exec";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 100;
const ENABLE_REAL_UPLOADS = true;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let mode = "login";
let selectedFiles = [];
let busy = false;
let human;

// ============================================================
// UI HELPERS
// ============================================================
function showStatus(id, message, error = false) {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = error ? "#a4234d" : "#39764b";
}

function showPanel(id) {
  ["auth-panel", "verification-panel", "upload-panel", "reveal-panel", "gallery-panel"].forEach((panelId) => {
    const element = $(panelId);
    if (element) element.classList.toggle("hidden", panelId !== id);
  });
}

function setBusy(value) {
  busy = value;
  if ($("auth-submit")) $("auth-submit").disabled = value;
  if ($("resend-verification")) $("resend-verification").disabled = value;
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

// ============================================================
// BACKEND REQUEST HELPER
// ============================================================
async function backendRequest(payload) {
  if (!auth.currentUser) throw new Error("Please sign in first.");
  const idToken = await auth.currentUser.getIdToken();
  const requestBody = JSON.stringify({ ...payload, idToken });

  let response;
  try {
    response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: requestBody
    });
  } catch (error) {
    throw new Error("Could not reach Apps Script. Check deployment.");
  }

  if (!response.ok) throw new Error(`Backend request failed (HTTP ${response.status}).`);
  const result = await response.json();
  if (!result || result.success !== true) throw new Error(result?.error || "Backend rejected request.");
  
  return result;
}

// ============================================================
// AUTHENTICATION LOGIC & VERIFICATION
// ============================================================
function setMode(nextMode) {
  mode = nextMode;
  $("show-login").classList.toggle("active", mode === "login");
  $("show-register").classList.toggle("active", mode === "register");
  $("name-wrap").classList.toggle("hidden", mode !== "register");
  $("confirm-wrap").classList.toggle("hidden", mode !== "register");
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-submit").textContent = mode === "login" ? "Sign in ❤️" : "Create account ❤️";
  showStatus("auth-status", "");
}

$("show-login").addEventListener("click", () => setMode("login"));
$("show-register").addEventListener("click", () => setMode("register"));

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (mode === "register") {
      if (password !== $("confirm-password").value) throw new Error("Passwords do not match.");
      
      const displayName = $("display-name").value.trim();
      
      // --- STRICT NAME VALIDATION RULES ---
      if (displayName.split(/\s+/).length < 2) {
        throw new Error("Please enter your full name, including your surname.");
      }
      if (!/^[a-zA-Z\s\-']+$/.test(displayName)) {
        throw new Error("Please enter a valid human name (letters only, no numbers or special symbols).");
      }
      // ------------------------------------

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      
      if (displayName) await updateProfile(cred.user, { displayName: displayName });

      // Create user doc with verified: false
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email,
        displayName: displayName || "",
        createdAt: serverTimestamp(),
        verified: false,
        stats: {
          totalBatchesAttempted: 0,
          totalPicsTried: 0,
          totalPicsUploaded: 0,
          totalPicsFailed: 0,
          totalDuplicates: 0
        }
      });
      
      // Send the email and sign out to force verification flow
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setMode("login");
      showStatus("auth-status", "Account created! Check your email (and Spam folder) to verify before logging in.");
      
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      await routeSignedInUser();
    }
  } catch (error) {
    showStatus("auth-status", error.message, true);
  } finally {
    setBusy(false);
  }
});

$("resend-verification").addEventListener("click", async () => {
  if (busy || !auth.currentUser) return;
  setBusy(true);
  try {
    await sendEmailVerification(auth.currentUser);
    showStatus("verification-status", "Verification link sent! Please check your Spam or Junk folder.");
  } catch (error) {
    showStatus("verification-status", error.message, true);
  } finally {
    setBusy(false);
  }
});

$("verification-sign-out").addEventListener("click", async () => {
  await signOut(auth);
  resetSelection();
  showPanel("auth-panel");
});

$("sign-out").addEventListener("click", async () => {
  await signOut(auth);
  resetSelection();
  showPanel("auth-panel");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { resetSelection(); showPanel("auth-panel"); return; }
  $("signed-in-as").textContent = user.displayName || user.email;
  await routeSignedInUser();
});

async function routeSignedInUser() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  let isVerified = false;

  if (userSnap.exists()) {
    const data = userSnap.data();
    
    // Check 1: If verified field is completely missing, create it as false
    if (typeof data.verified === "undefined") {
      await updateDoc(userRef, { verified: false });
      isVerified = false;
    } else {
      isVerified = data.verified;
    }

    // Check 2: If Firebase sees the email as verified, but Firestore still says false, update Firestore to true
    if (user.emailVerified && !isVerified) {
      await updateDoc(userRef, { verified: true });
      isVerified = true;
    }
  }

  // If still not verified, block access and show the verification panel
  if (!isVerified) {
    showPanel("verification-panel");
    return;
  }

  // Normal Routing Flow
  if (!ENABLE_REAL_UPLOADS) return showPanel("upload-panel");
  try {
    const result = await backendRequest({ action: "revealStatus" });
    if (result.revealed) {
      await loadGallery();
    } else if (result.eligible) {
      showPanel("reveal-panel");
      showStatus("reveal-status", "Dare completed! You can now reveal the gallery.");
    } else {
      showPanel("upload-panel");
      showStatus("upload-status", "Complete the dare to proceed.");
    }
  } catch (error) {
    showStatus("upload-status", "Could not verify backend status.", true);
  }
}

// ============================================================
// IMAGE COMPRESSION ENGINE 
// ============================================================
function compressImage(file, maxWidth = 2560, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

// ============================================================
// FILE SELECTION & AI FACE CHECKING
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
  const images = selectedFiles.filter((f) => f.type.startsWith("image/"));
  const totalMB = (images.reduce((sum, f) => sum + f.size, 0) / 1048576).toFixed(1);
  $("selection-summary").textContent = `${images.length} image(s) selected · ${totalMB} MB total.`;
  refreshUploadButton();
});

$("consent").addEventListener("change", refreshUploadButton);

async function initializeAI() {
  if (!human && window.Human) {
    human = new Human.Human({
      modelBasePath: 'https://vladmandic.github.io/human/models/',
      filter: { enabled: true },
      face: { enabled: true, detector: { rotation: false, maxDetected: 1, return: true }, mesh: { enabled: false }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: false } },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }
    });
    await human.load();
  }
}

async function containsFace(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const result = await human.detect(img);
        URL.revokeObjectURL(url);
        resolve(result.face && result.face.length > 0);
      } catch (e) { URL.revokeObjectURL(url); resolve(false); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

async function preparePhoto(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`${file.name} exceeds 10 MB limit.`);
  return { originalFilename: file.name, mimeType: file.type, base64Data: await blobToBase64(file) };
}

// ============================================================
// STRICT UPLOAD LOGIC & FIRESTORE METRICS
// ============================================================
$("upload-button").addEventListener("click", async () => {
  if (busy || !ENABLE_REAL_UPLOADS) return;
  const rawImages = selectedFiles.filter((file) => file.type.startsWith("image/"));
  if (rawImages.length === 0 || rawImages.length > MAX_BATCH_FILES) return;

  setBusy(true);
  try {
    showStatus("upload-status", "Compressing photos for fast upload...");
    
    const images = [];
    for (let i = 0; i < rawImages.length; i++) {
      const compressed = await compressImage(rawImages[i]);
      images.push(compressed);
    }

    showStatus("upload-status", "Waking up AI face scanner...");
    await initializeAI();
    
    const invalidFiles = [];
    
    for (let i = 0; i < images.length; i++) {
      showStatus("upload-status", `Scanning photo ${i + 1} of ${images.length} for a face...`);
      const hasFace = await containsFace(images[i]);
      if (!hasFace) {
        invalidFiles.push(images[i].name);
      }
    }
    
    showStatus("upload-status", "Starting secure upload...");
    const started = await backendRequest({ action: "beginBatch", consent: true });
    const batchId = started.batchId;
    let uploaded = 0, duplicates = 0, index = 0;

    async function uploadWorker() {
      while (index < images.length) {
        const file = images[index++];
        const payload = await preparePhoto(file);
        
        let success = false;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await backendRequest({ action: "uploadPhoto", batchId, consent: true, ...payload });
            if (res.duplicate) duplicates++; else uploaded++;
            showStatus("upload-status", `Progress: ${uploaded + duplicates} / ${images.length} processed...`);
            success = true;
            break; 
          } catch (e) {
            lastError = e;
            console.warn(`Attempt ${attempt} failed. Retrying...`);
            await new Promise(r => setTimeout(r, 1000)); 
          }
        }
        
        if (!success) throw lastError; 
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, images.length) }, uploadWorker));

    showStatus("upload-status", "Verifying completion with server…");
    const finished = await backendRequest({ action: "finishBatch", batchId });
    resetSelection();
    
    const failed = images.length - uploaded - duplicates;

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        "stats.totalBatchesAttempted": increment(1),
        "stats.totalPicsTried": increment(images.length),
        "stats.totalPicsUploaded": increment(uploaded),
        "stats.totalPicsFailed": increment(failed),
        "stats.totalDuplicates": increment(duplicates)
      });
    } catch (e) {
      console.warn("Could not log metrics to Firestore:", e);
    }

    if (invalidFiles.length > 0) {
      showStatus(
        "upload-status", 
        `Access Denied. Upload completed, but ${invalidFiles.length} photo(s) did not contain a face. Even if you uploaded enough valid photos, the presence of non-face photos voids this attempt. You must upload ONLY photos with faces.`, 
        true
      );
    } else if (finished.qualifies) {
      showPanel("reveal-panel");
      showStatus("reveal-status", `Success! ${finished.newUniquePhotos} new photos verified.`);
    } else {
      showStatus("upload-status", `Attempt incomplete. Only ${finished.newUniquePhotos} unique photos found.`, true);
    }
  } catch (error) {
    showStatus("upload-status", `Upload stopped: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
});

// ============================================================
// GALLERY LOGIC
// ============================================================
$("reveal-button").addEventListener("click", async () => {
  if (busy || !ENABLE_REAL_UPLOADS) return;
  if (!window.confirm("Reveal the private gallery now? This will begin your secure viewing session.")) return;

  setBusy(true);
  try {
    const result = await backendRequest({ action: "revealGallery", consent: true });
    await loadGallery(result.images); 
  } catch (error) {
    showStatus("reveal-status", error.message, true);
    setBusy(false);
  }
});

async function loadGallery(preloadedImages = null) {
  showPanel("gallery-panel");
  const gallery = $("gallery");
  gallery.innerHTML = "<p id='gallery-status' style='font-weight:500; color:#d81b60; text-align:center;'>Step 1: Connecting to secure vault...</p>";
  
  try {
    let images = preloadedImages;
    
    if (!images) {
      const result = await backendRequest({ action: "listGallery" });
      images = result.images;
    }
    
    if (!images || images.length === 0) {
      gallery.innerHTML = "<p>Gallery unlocked, but no photos were found in the folder.</p>";
      return;
    }

    gallery.innerHTML = `<p id='gallery-status' style='font-weight:500; color:#d81b60; text-align:center;'>Step 2: Found ${images.length} photos. Downloading safely...</p><div id='gallery-grid' class='gallery-grid'></div>`;
    const grid = document.getElementById("gallery-grid");
    const statusText = document.getElementById("gallery-status");

    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      statusText.innerText = `Downloading photo ${i + 1} of ${images.length}...`;
      
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      const caption = document.createElement("figcaption");
      img.loading = "lazy";
      caption.textContent = item.name;
      
      figure.append(img, caption);
      grid.appendChild(figure);

      try {
        const res = await backendRequest({ action: "getGalleryImage", fileId: item.id });
        img.src = `data:${res.mimeType};base64,${res.base64}`;
      } catch (err) {
        caption.textContent = `Error: ${err.message}`;
        caption.style.color = "red";
      }
    }
    
    statusText.innerText = "All photos loaded successfully!";
    statusText.style.color = "#39764b";

  } catch (error) {
    gallery.innerHTML = `<p style="color: #d81b60; text-align: center; font-weight: 500; margin-top: 20px;">Error: ${error.message}</p>`;
  }
}
