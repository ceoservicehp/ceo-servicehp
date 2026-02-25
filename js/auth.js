"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const db = window.supabaseClient;
    if(!db) return;

    const { data } = await db.auth.getSession();

    if(!data.session){
        window.location.replace("login.html");
        return;
    }

    const userId = data.session.user.id;

    // 🔥 GANTI email → user_id
    const { data: roleData, error } = await db
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();

    if(error || !roleData || roleData.is_active !== true){
        await db.auth.signOut();
        window.location.replace("login.html");
        return;
    }

    localStorage.setItem("userRole", roleData.role);

    console.log("Login sebagai:", roleData.role);

});
