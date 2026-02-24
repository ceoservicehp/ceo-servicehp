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

/* ================= CEK ROLE ================= */
async function checkUserRole(user){
  const { data } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if(!data) return null;
  if(!data.is_active) return "pending";
  return data.role;
}

/* ================= ENSURE RECORD ================= */
async function ensureAdminRecord(user){
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if(!data){
  await db.from("profiles").upsert({
    user_id: user.id,
    full_name: user.user_metadata?.full_name || user.email,
    email: user.email,
    phone: user.user_metadata?.phone || null,
    position: user.user_metadata?.position || "Staff",
    role: "staff",
    is_active: false
  }, {
    onConflict: "user_id"
  });
  }
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const isRecovery = params.get("type") === "recovery";

  // ================= RECOVERY MODE =================
  if(isRecovery){
    loginForm.style.display = "none";
    registerForm.style.display = "none";
    resetForm.style.display = "none";
    updatePasswordForm.style.display = "block";
    formTitle.textContent = "Buat Password Baru";

    // isi hidden email untuk accessibility
    const { data } = await db.auth.getSession();
    if(data.session){
      const recoveryEmailInput = document.getElementById("recoveryEmail");
      if(recoveryEmailInput){
        recoveryEmailInput.value = data.session.user.email;
      }
    }

    return; // stop di sini kalau recovery
  }

  // ================= NORMAL SESSION CHECK =================
  const { data } = await db.auth.getSession();

  if(data.session){
    const user = data.session.user;

    await ensureAdminRecord(user);
    const role = await checkUserRole(user);

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

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  console.log("Google login clicked");

  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/login.html"
    }
  });

  if(error){
    console.log("Google OAuth Error:", error);
    showAlert("Login Google gagal.");
  }
});

/* ================= LOGIN ================= */
loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = loginForm.loginEmail.value;
  const password = loginForm.loginPassword.value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if(error){
    if(error.message.includes("Email not confirmed")){
      showAlert("Silakan verifikasi email Anda terlebih dahulu.");
    } else {
      showAlert("Email atau password salah.");
    }
    return;
}

  const user = data.user;
  await ensureAdminRecord(user);
  const role = await checkUserRole(user);

  if(role === "pending"){
    await db.auth.signOut();
    showAlert("Akun belum disetujui.");
    return;
  }

  if(!role){
    await db.auth.signOut();
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

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options:{
      emailRedirectTo: window.location.origin + "/login.html",
      data:{ full_name:name, phone, position }
    }
  });

  // 🔍 TAMBAHKAN DEBUG DI SINI
  console.log("SIGNUP RESULT:", data, error);

  if(error){
    showAlert(error.message);
    return;
  }

  showAlert(
    "Registrasi berhasil! Silakan cek email Anda untuk verifikasi sebelum login.",
    "success"
  );

  registerForm.reset();
});

/* ================= RESET REQUEST ================= */
resetForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const btn = resetForm.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Mengirim...";

  const email = resetForm.resetEmail.value;

  const { error } = await db.auth.resetPasswordForEmail(email,{
    redirectTo: window.location.origin + "/login.html?type=recovery"
  });

  if(error){
    showAlert("Terlalu banyak permintaan. Coba lagi nanti.");
    btn.disabled = false;
    btn.textContent = "Kirim Link Reset";
    return;
  }

  showAlert("Link reset password telah dikirim.", "success");

setTimeout(()=>{
  btn.disabled = false;
  btn.textContent = "Kirim Link Reset";
}, 3000);
});

/* ================= UPDATE PASSWORD ================= */
updatePasswordForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const newPassword = updatePasswordForm.newPassword.value;
  const confirmPassword = updatePasswordForm.confirmPassword.value;

  if(newPassword.length < 6){
    showAlert("Password minimal 6 karakter.");
    return;
  }

  if(newPassword !== confirmPassword){
    showAlert("Konfirmasi password tidak cocok.");
    return;
  }

  const { error } = await db.auth.updateUser({ password:newPassword });

  if(error){
    showAlert("Gagal mengubah password.");
    return;
  }

  showAlert("Password berhasil diperbarui.", "success");

  setTimeout(()=>{
    window.location.replace("login.html");
  },2000);
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
