"use strict";

const db = window.supabaseClient;

/* ================= FUNCTION CEK ROLE ================= */
async function checkUserRole(email){

  const { data, error } = await db
    .from("admin_users")
    .select("role")
    .eq("email", email)
    .eq("is_active", true)
    .single();

  if(error || !data){
    return null;
  }

  return data.role;
}

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

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    errorMsg.textContent = "Email atau password salah";
    return;
  }

  const user = data.user;

  // 🔥 CEK ROLE DI TABEL admin_users
  const role = await checkUserRole(user.email);

  if(!role){
    await db.auth.signOut();
    errorMsg.textContent = "Akun belum di-ACC Admin.";
    return;
  }

  localStorage.setItem("userRole", role);

  window.location.replace("dapur.html");
});

/* ================= AUTO REDIRECT ================= */
document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  if(data.session){

    const role = await checkUserRole(data.session.user.email);

    if(role){
      localStorage.setItem("userRole", role);
      window.location.replace("dapur.html");
    } else {
      await db.auth.signOut();
    }

  }

});
