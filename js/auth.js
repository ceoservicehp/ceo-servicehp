"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const db = window.supabaseClient;
    if(!db) return;

    const { data } = await db.auth.getSession();

    // ❌ Kalau belum login → kembali ke login
    if(!data.session){
        window.location.replace("login.html");
        return;
    }

    const userEmail = data.session.user.email;

    // 🔥 CEK ROLE DI TABEL admin_users
    const { data: roleData } = await db
        .from("admin_users")
        .select("role")
        .eq("email", userEmail)
        .eq("is_active", true)
        .single();

    // ❌ Kalau tidak ada role → logout + kembali ke login
    if(!roleData){
        await db.auth.signOut();
        window.location.replace("login.html");
        return;
    }

    // ✅ Simpan role untuk kontrol fitur
    localStorage.setItem("userRole", roleData.role);

    console.log("Login sebagai:", roleData.role);

});
