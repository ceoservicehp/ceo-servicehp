"use strict";

const db = window.supabaseClient;

/* ================= ELEMENT ================= */
const alertBox = document.getElementById("alertBox");

/* ================= ALERT ================= */
function showAlert(message, type="error"){
  alertBox.style.display = "block";
  alertBox.className = "alert-box";
  alertBox.classList.add(type === "success" ? "alert-success" : "alert-error");
  alertBox.textContent = message;
}

function clearAlert(){
  alertBox.style.display = "none";
  alertBox.textContent = "";
}

/* ================= CEK ROLE ================= */
async function checkUserRole(email){

  const { data } = await db
    .from("admin_users")
    .select("role,is_active")
    .eq("email", email)
    .maybeSingle();

  if(!data) return null;

  if(!data.is_active){
    return "pending";
  }

  return data.role;
}

/* ================= ENSURE RECORD ================= */
async function ensureAdminRecord(user){

  const { data } = await db
    .from("admin_users")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if(!data){

    await db.from("admin_users").insert({
      full_name: user.user_metadata?.full_name || user.email,
      email: user.email,
      phone: user.user_metadata?.phone || null,
      position: user.user_metadata?.position || "Staff",
      role: "staff",
      is_active: false,
      approved_by: null
    });

  }
}

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  await db.auth.signInWithOAuth({
    provider: "google",
    options:{
      redirectTo: window.location.origin + "/login.html"
    }
  });

});

/* ================= LOGIN EMAIL ================= */
document.getElementById("loginForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    showAlert("Email atau password salah.");
    return;
  }

  const user = data.user;

  await ensureAdminRecord(user);

  const role = await checkUserRole(user.email);

  if(role === "pending"){
    await db.auth.signOut();
    showAlert("Akun Anda belum disetujui oleh Superadmin.");
    return;
  }

  if(!role){
    await db.auth.signOut();
    showAlert("Akun tidak ditemukan.");
    return;
  }

  localStorage.setItem("userRole", role);

  // redirect setelah login
  window.location.replace("profile.html");
});

/* ================= REGISTER ================= */
document.getElementById("registerForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const phone = document.getElementById("registerPhone").value;
  const position = document.getElementById("registerPosition").value;
  const password = document.getElementById("registerPassword").value;

  if(password.length < 6){
    showAlert("Password minimal 6 karakter.");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options:{
      data:{
        full_name: name,
        phone: phone,
        position: position
      }
    }
  });

  if(error){
    showAlert(error.message);
    return;
  }

  await db.from("admin_users").insert({
    full_name: name,
    email: email,
    phone: phone,
    position: position,
    role: "staff",
    is_active: false,
    approved_by: null
  });

  showAlert("Registrasi berhasil! Tunggu persetujuan Superadmin.", "success");

  document.getElementById("registerForm").reset();
});

/* ================= RESET PASSWORD ================= */
document.getElementById("resetForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = document.getElementById("resetEmail").value;

  const { error } = await db.auth.resetPasswordForEmail(email,{
    redirectTo: window.location.origin + "/login.html"
  });

  if(error){
    showAlert("Gagal mengirim email reset.");
    return;
  }

  showAlert("Link reset password telah dikirim.", "success");
});

/* ================= AUTO REDIRECT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  if(data.session){

    const user = data.session.user;

    await ensureAdminRecord(user);

    const role = await checkUserRole(user.email);

    if(role === "pending"){
      await db.auth.signOut();
      showAlert("Akun Anda belum disetujui oleh Superadmin.");
      return;
    }

    if(role){
      localStorage.setItem("userRole", role);
      window.location.replace("profile.html");
    }
  }

});

/* ================= SWITCH FORM ================= */

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");

const showRegisterBtn = document.getElementById("showRegister");
const showLoginBtn = document.getElementById("showLogin");
const showResetBtn = document.getElementById("showReset");
const formTitle = document.getElementById("formTitle");

function showLogin(){
  loginForm.style.display = "block";
  registerForm.style.display = "none";
  resetForm.style.display = "none";
  formTitle.textContent = "Admin Login";

  showRegisterBtn.style.display = "inline";
  showLoginBtn.style.display = "none";
}

function showRegister(){
  loginForm.style.display = "none";
  registerForm.style.display = "block";
  resetForm.style.display = "none";
  formTitle.textContent = "Daftar Akun";

  showRegisterBtn.style.display = "none";
  showLoginBtn.style.display = "inline";
}

function showReset(){
  loginForm.style.display = "none";
  registerForm.style.display = "none";
  resetForm.style.display = "block";
  formTitle.textContent = "Reset Password";

  showRegisterBtn.style.display = "inline";
  showLoginBtn.style.display = "inline";
}

showRegisterBtn?.addEventListener("click", showRegister);
showLoginBtn?.addEventListener("click", showLogin);
showResetBtn?.addEventListener("click", showReset);
