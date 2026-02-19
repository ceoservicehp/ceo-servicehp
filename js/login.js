"use strict";

const db = window.supabaseClient;

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/dapur.html"
    }
  });

  if(error){
    console.error(error);
  }
});

/* ================= LOGIN ================= */
document.getElementById("loginForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = document.getElementById("loginEmail")?.value;
  const password = document.getElementById("loginPassword")?.value;
  const errorMsg = document.getElementById("errorMsg");

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    errorMsg.textContent = "Email atau password salah";
    return;
  }

  window.location.href = "dapur.html";
});

/* ================= REGISTER ================= */
document.getElementById("registerForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = document.getElementById("registerEmail")?.value;
  const password = document.getElementById("registerPassword")?.value;
  const errorMsg = document.getElementById("errorMsg");

  const { error } = await db.auth.signUp({
    email,
    password
  });

  if(error){
    errorMsg.textContent = error.message;
    return;
  }

  errorMsg.style.color="green";
  errorMsg.textContent="Akun berhasil dibuat! Cek email untuk verifikasi.";
});

/* ================= RESET PASSWORD ================= */
document.getElementById("resetForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = document.getElementById("resetEmail")?.value;
  const errorMsg = document.getElementById("errorMsg");

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/login.html"
  });

  if(error){
    errorMsg.textContent="Gagal kirim reset email";
    return;
  }

  errorMsg.style.color="green";
  errorMsg.textContent="Link reset password sudah dikirim.";
});

/* ================= SWITCH FORM ================= */
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const formTitle = document.getElementById("formTitle");

document.getElementById("showRegister")?.addEventListener("click", ()=>{
  loginForm.style.display="none";
  resetForm.style.display="none";
  registerForm.style.display="block";
  formTitle.textContent="Daftar Admin";
});

document.getElementById("showLogin")?.addEventListener("click", ()=>{
  registerForm.style.display="none";
  resetForm.style.display="none";
  loginForm.style.display="block";
  formTitle.textContent="Admin Login";
});

document.getElementById("showReset")?.addEventListener("click", ()=>{
  loginForm.style.display="none";
  registerForm.style.display="none";
  resetForm.style.display="block";
  formTitle.textContent="Reset Password";
});

/* ================= AUTO REDIRECT ================= */
db.auth.getSession().then(({ data })=>{
  if(data.session){
    window.location.href="dapur.html";
  }
});
