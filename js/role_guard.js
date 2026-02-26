"use strict";

const db = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await db.auth.getSession();

  if(!data?.session){
    window.location.href = "login.html";
    return;
  }

  const userId = data.session.user.id;

  const { data: userData } = await db
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if(!userData || !userData.is_active){
    alert("Akun belum aktif.");
    await db.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  const role = userData.role;
  const page = window.location.pathname.split("/").pop();

  const rules = {
    "admin-users.html": ["superadmin"],
    "keuangan.html": ["superadmin"],
    "produk.html": ["admin","superadmin"],
    "dapur.html": ["staff","admin","superadmin"],
    "profile.html": ["staff","admin","superadmin"]
  };

  if(rules[page] && !rules[page].includes(role)){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
  }

});
