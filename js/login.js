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
  if(!alertBox) return;
  alertBox.style.display = "block";
  alertBox.className = "alert-box";
  alertBox.classList.add(type === "success" ? "alert-success" : "alert-error");
  alertBox.textContent = message;
}

function clearAlert(){
  if(alertBox) alertBox.style.display = "none";
}

/* ================= ENSURE PROFILE (LOGIN SAJA) ================= */
async function ensureProfile(user){

  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if(!data){
    await db.from("profiles").insert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      phone: user.user_metadata?.phone || null,
      position: user.user_metadata?.position || "Staff",
      role: "staff",
      is_active: false
    });
  }
}

/* ================= GET ROLE ================= */
async function getUserRole(user){

  const { data } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if(!data) return null;
  if(data.is_active !== true) return "pending";

  return data.role;
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  if(data.session){
    window.location.href = "dapur.html";
  }

});

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/login.html"
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

  // Ambil role dari admin_users
  const { data: adminData, error: roleError } = await db
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if(roleError){
    console.error(roleError);
    showAlert("Gagal mengambil data admin.");
    return;
  }

  if(!adminData){
    await db.auth.signOut();
    showAlert("Akun tidak terdaftar sebagai admin.");
    return;
  }

  if(!adminData.is_active){
    await db.auth.signOut();
    showAlert("Akun belum diaktifkan admin.");
    return;
  }

  localStorage.setItem("userRole", adminData.role);
  localStorage.setItem("userId", user.id);

  window.location.href = "dapur.html";
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

  showAlert("Registrasi berhasil! Menunggu persetujuan superadmin.", "success");
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
