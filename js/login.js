"use strict";

const db = window.supabaseClient;

/* ================= CEK ROLE ================= */
async function checkUserRole(email){

  const { data, error } = await db
    .from("admin_users")
    .select("role")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if(error || !data){
    return null;
  }

  return data.role;
}

/* ================= CEK / INSERT USER ================= */
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

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorMsg = document.getElementById("errorMsg");

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    errorMsg.textContent = "Email atau password salah.";
    return;
  }

  const user = data.user;

  await ensureAdminRecord(user);

  const role = await checkUserRole(user.email);

  if(!role){
    await db.auth.signOut();
    errorMsg.textContent = "Akun belum diaktifkan oleh Superadmin.";
    return;
  }

  localStorage.setItem("userRole", role);
  window.location.replace("dapur.html");
});

/* ================= REGISTER ================= */
document.getElementById("registerForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const phone = document.getElementById("registerPhone").value;
  const position = document.getElementById("registerPosition").value;
  const password = document.getElementById("registerPassword").value;
  const errorMsg = document.getElementById("errorMsg");

  if(password.length < 6){
    errorMsg.textContent = "Password minimal 6 karakter.";
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
    errorMsg.textContent = error.message;
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

  errorMsg.style.color = "green";
  errorMsg.textContent = "Registrasi berhasil. Tunggu persetujuan Superadmin.";
});

/* ================= RESET PASSWORD ================= */
document.getElementById("resetForm")
?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = document.getElementById("resetEmail").value;
  const errorMsg = document.getElementById("errorMsg");

  const { error } = await db.auth.resetPasswordForEmail(email,{
    redirectTo: window.location.origin + "/login.html"
  });

  if(error){
    errorMsg.textContent = "Gagal mengirim email reset.";
    return;
  }

  errorMsg.style.color = "green";
  errorMsg.textContent = "Link reset password telah dikirim.";
});

/* ================= AUTO REDIRECT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  if(data.session){

    const user = data.session.user;

    await ensureAdminRecord(user);

    const role = await checkUserRole(user.email);

    if(role){
      localStorage.setItem("userRole", role);
      window.location.replace("dapur.html");
    }else{
      await db.auth.signOut();
    }
  }

});
