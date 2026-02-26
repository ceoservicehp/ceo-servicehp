"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const client = window.supabaseClient;
    if(!client) return;

    const { data } = await client.auth.getSession();

    if(!data.session){
        window.location.replace("login.html");
        return;
    }

    const userId = data.session.user.id;

    const { data: roleData, error } = await client
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();

    if(error || !roleData || roleData.is_active !== true){
        await client.auth.signOut();
        window.location.replace("login.html");
        return;
    }

    localStorage.setItem("userRole", roleData.role);

    console.log("Login sebagai:", roleData.role);

});
