"use strict";

const db = window.supabaseClient;

/* ================= ELEMENT ================= */
const alertBox = document.getElementById("alertBox");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const formTitle = document.getElementById("formTitle");

const showRegisterBtn = document.getElementById("showRegister");
const showLoginBtn = document.getElementById("showLogin");

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

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  if(!db) return;

  const { data } = await db.auth.getSession();

  // Kalau sudah tahu session aktif → langsung ke dapur
  if(data?.session){
    window.location.replace("dapur.html");
  }

});

/* ================= LOGIN ================= */
loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = loginForm.loginEmail.value.trim();
  const password = loginForm.loginPassword.value.trim();

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if(error){
    showAlert("Email atau password salah.");
    return;
  }

  const user = data.user;

  // Ambil status dari admin_users
  const { data: adminData, error: roleError } = await db
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if(roleError || !adminData){
    await db.auth.signOut();
    showAlert("Akun belum terdaftar.");
    return;
  }

  if(!adminData.is_active){
    await db.auth.signOut();
    showAlert("Akun menunggu persetujuan superadmin.");
    return;
  }

  localStorage.setItem("userRole", adminData.role);

  window.location.replace("dapur.html");
});


/* ================= REGISTER ================= */
registerForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const name = registerForm.registerName.value.trim();
  const email = registerForm.registerEmail.value.trim();
  const phone = registerForm.registerPhone.value.trim();
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

  // Tidak perlu insert ke database lagi
  // Trigger database yang akan handle profiles + admin_users

  showAlert("Registrasi berhasil! Menunggu persetujuan superadmin.", "success");
  registerForm.reset();
});


/* ================= SWITCH FORM ================= */
function showLogin(){
  loginForm.style.display = "block";
  registerForm.style.display = "none";
  formTitle.textContent = "Admin Login";
}

function showRegister(){
  loginForm.style.display = "none";
  registerForm.style.display = "block";
  formTitle.textContent = "Daftar Akun";
}

showRegisterBtn?.addEventListener("click", showRegister);
showLoginBtn?.addEventListener("click", showLogin);
