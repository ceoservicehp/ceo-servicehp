"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const db = window.supabaseClient;
    if(!db) return;

    const { data } = await db.auth.getSession();

    // Jika belum login → kembali ke login
    if(!data.session){
        window.location.replace("login.html");
    }

});
