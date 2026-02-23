"use strict";

const db = window.supabaseClient;
let currentUserId = null;

/* ========================================= */
/* INIT */
/* ========================================= */
document.addEventListener("DOMContentLoaded", async () => {

    if(!db){
        alert("Supabase belum terhubung");
        return;
    }

    const { data: authData } = await db.auth.getUser();
    const user = authData?.user;

    if(!user){
        window.location.href = "login.html";
        return;
    }

    currentUserId = user.id;

    applySavedTheme();
    setupThemeSwitcher();
    setupUploadHandlers();

    await loadProfile(user);
});


/* ========================================= */
/* LOAD PROFILE */
/* ========================================= */
async function loadProfile(user){

    const { data, error } = await db
        .from("admin_users")
        .select("*")
        .eq("user_id", user.id)   // 🔥 WAJIB
        .maybeSingle();

    if(error){
        console.log(error);
        alert("Gagal memuat profil.");
        return;
    }

    if(!data){
        await createInitialProfile(user);
        return;
    }

    fillProfileData(data);
}


/* ========================================= */
/* CREATE INITIAL PROFILE */
/* ========================================= */
async function createInitialProfile(user){

    const employeeId = "CEO-" + Date.now();

    const { error } = await db.from("admin_users").insert({
        user_id: user.id,
        email: user.email,
        full_name: user.email,
        role: "staff",
        employee_id: employeeId,
        theme_prefer: "light"
    });

    if(error){
        console.log(error);
        alert("Gagal membuat profil awal.");
        return;
    }

    await loadProfile(user);
}


/* ========================================= */
/* SAVE PROFILE */
/* ========================================= */
document.getElementById("saveProfile")
?.addEventListener("click", saveProfile);

async function saveProfile(){

    const updateData = {
        full_name: getValue("nameInput"),
        phone: getValue("phoneInput"),
        birth_date: getValue("birthInput"),
        address: getValue("addressInput"),
        gender: getValue("genderInput"),
        position: getValue("positionInput"),
        bank_name: getValue("bankNameInput"),
        bank_account_number: getValue("bankNumberInput"),
        email_notif: getChecked("emailNotif"),
        wa_notif: getChecked("waNotif"),
        finance_notif: getChecked("financeNotif"),
        theme_prefer: getValue("themeSelect")
    };

    const { error } = await db
        .from("admin_users")
        .update(updateData)
        .eq("user_id", currentUserId);   // 🔥 WAJIB

    if(error){
        console.log(error);
        alert("Gagal menyimpan profil.");
        return;
    }

    alert("Profil berhasil diperbarui.");
}


/* ========================================= */
/* UPLOAD HANDLER */
/* ========================================= */
function setupUploadHandlers(){
    setupUpload("uploadPhoto", "admin-photos", "photo_url");
    setupUpload("uploadKTP", "admin-documents", "ktp_url");
    setupUpload("uploadSignature", "admin-signatures", "signature_url");
}

function setupUpload(inputId, bucket, field){

    document.getElementById(inputId)
    ?.addEventListener("change", async e=>{

        const file = e.target.files[0];
        if(!file) return;

        const path = `${currentUserId}/${field}`;

        const { error } = await db.storage
            .from(bucket)
            .upload(path, file, { upsert: true });

        if(error){
            console.log(error);
            alert("Upload gagal.");
            return;
        }

        const { data } = await db.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        const url = data?.signedUrl;

        await db
            .from("admin_users")
            .update({ [field]: url })
            .eq("user_id", currentUserId);   // 🔥 WAJIB

        if(field === "photo_url"){
            document.getElementById("profilePhoto").src = url;
        }

        alert("Upload berhasil.");
    });
}


/* ========================================= */
/* THEME SWITCHER */
/* ========================================= */
function setupThemeSwitcher(){
    const select = document.getElementById("themeSelect");
    if(!select) return;

    select.addEventListener("change", async e=>{
        const theme = e.target.value;

        localStorage.setItem("theme", theme);
        applyTheme(theme);

        await db
            .from("admin_users")
            .update({ theme_prefer: theme })
            .eq("user_id", currentUserId);   // 🔥 WAJIB
    });
}


/* ========================================= */
/* THEME */
/* ========================================= */
function applySavedTheme(){
    const saved = localStorage.getItem("theme") || "light";
    applyTheme(saved);
}

function applyTheme(theme){
    document.body.classList.toggle("dark-mode", theme === "dark");
}


/* ========================================= */
/* ROLE BADGE */
/* ========================================= */
function styleRoleBadge(role){
    const badge = document.getElementById("roleBadge");
    if(!badge) return;

    badge.style.background =
        role === "superadmin" ? "#8e44ad" :
        role === "admin" ? "#2c5364" :
        "#7f8c8d";
}


/* ========================================= */
/* HELPERS */
/* ========================================= */
function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value || "-";
}

function setValue(id, value){
    const el = document.getElementById(id);
    if(el) el.value = value || "";
}

function setChecked(id, value){
    const el = document.getElementById(id);
    if(el) el.checked = !!value;
}

function getValue(id){
    return document.getElementById(id)?.value || "";
}

function getChecked(id){
    return document.getElementById(id)?.checked || false;
}
