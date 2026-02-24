"use strict";

const db = window.supabaseClient;

/* ================= ELEMENT ================= */
const alertBox = document.getElementById("alertBox");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const updatePasswordForm = document.getElementById("updatePasswordForm");
const formTitle = document.getElementById("formTitle");

const showRegisterBtn = document.getElementById("showRegister");
const showLoginBtn = document.getElementById("showLogin");
const showResetBtn = document.getElementById("showReset");

/* ================= ALERT ================= */
function showAlert(message, type="error"){
  alertBox.style.display = "block";
  alertBox.className = "alert-box";
  alertBox.classList.add(type === "success" ? "alert-success" : "alert-error");
  alertBox.textContent = message;
}

function clearAlert(){
  alertBox.style.display = "none";
}

/* ================= ENSURE PROFILE ================= */
async function ensureProfile(user){

  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if(!data){
    await db.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email,
      phone: user.user_metadata?.phone || null,
      position: user.user_metadata?.position || "Staff",
      role: "staff",
      is_active: false
    });
  }
}

/* ================= CEK ROLE ================= */
async function getUserRole(user){

  const { data } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if(!data) return null;
  if(!data.is_active) return "pending";
  return data.role;
}

/* ================= AUTH LISTENER ================= */
db.auth.onAuthStateChange(async (event, session) => {

  console.log("AUTH EVENT:", event);

  if(event === "SIGNED_IN" && session){

    const user = session.user;

    await ensureProfile(user);

    const role = await getUserRole(user);

    if(role === "pending"){
      await db.auth.signOut();
      showAlert("Akun belum disetujui.");
      return;
    }

    if(role){
      localStorage.setItem("userRole", role);
      window.location.replace("profile.html");
    }
  }

});

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const isRecovery = params.get("type") === "recovery";

  if(isRecovery){
    loginForm.style.display = "none";
    registerForm.style.display = "none";
    resetForm.style.display = "none";
    updatePasswordForm.style.display = "block";
    formTitle.textContent = "Buat Password Baru";
    return;
  }

  const { data } = await db.auth.getSession();

  if(data.session){
    window.location.replace("profile.html");
  }
});

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/profile.html"
    }
  });

});

/* ================= LOGIN ================= */
loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = loginForm.loginEmail.value;
  const password = loginForm.loginPassword.value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if(error){
    showAlert("Email atau password salah.");
    return;
  }

  const user = data.user;

  await ensureProfile(user);

  const role = await getUserRole(user);

  if(role === "pending"){
    await db.auth.signOut();
    showAlert("Akun belum disetujui.");
    return;
  }

  if(!role){
    showAlert("Akun tidak ditemukan.");
    return;
  }

  localStorage.setItem("userRole", role);
  window.location.replace("profile.html");
});

/* ================= REGISTER ================= */
registerForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const name = registerForm.registerName.value;
  const email = registerForm.registerEmail.value;
  const phone = registerForm.registerPhone.value;
  const position = registerForm.registerPosition.value;
  const password = registerForm.registerPassword.value;

  if(password.length < 6){
    showAlert("Password minimal 6 karakter.");
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password,
    options:{
      emailRedirectTo: window.location.origin + "/login.html",
      data:{ full_name:name, phone, position }
    }
  });

  if(error){
    showAlert(error.message);
    return;
  }

  showAlert("Registrasi berhasil! Cek email untuk verifikasi.", "success");
  registerForm.reset();
});

/* ================= SWITCH FORM ================= */
function showLogin(){
  loginForm.style.display = "block";
  registerForm.style.display = "none";
  resetForm.style.display = "none";
  updatePasswordForm.style.display = "none";
  formTitle.textContent = "Admin Login";
}

function showRegister(){
  loginForm.style.display = "none";
  registerForm.style.display = "block";
  resetForm.style.display = "none";
  updatePasswordForm.style.display = "none";
  formTitle.textContent = "Daftar Akun";
}

function showReset(){
  loginForm.style.display = "none";
  registerForm.style.display = "none";
  resetForm.style.display = "block";
  updatePasswordForm.style.display = "none";
  formTitle.textContent = "Reset Password";
}

showRegisterBtn?.addEventListener("click", showRegister);
showLoginBtn?.addEventListener("click", showLogin);
showResetBtn?.addEventListener("click", showReset);
