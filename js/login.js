"use strict";

const db = window.supabaseClient;

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  await db.auth.signInWithOAuth({
    provider: "google"
  });

});

/* ================= LOGIN EMAIL ================= */
document.getElementById("loginForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorMsg = document.getElementById("errorMsg");

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    errorMsg.textContent = "Email atau password salah";
    return;
  }

  window.location.replace("dapur.html");
});

/* ================= AUTO REDIRECT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  // Kalau sudah login dan sedang di login.html
  if (data.session && window.location.pathname.includes("login.html")) {
    window.location.replace("dapur.html");
  }

});
