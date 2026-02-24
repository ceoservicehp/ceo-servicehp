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
    
    const { data: sessionCheck } = await db.auth.getSession();
    console.log("SESSION CHECK:", sessionCheck);
    
    const { data: authData, error } = await db.auth.getUser();

    if(error){
        console.log("AUTH ERROR:", error);
        window.location.href = "login.html";
        return;
    }

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
      .eq("user_id", user.id);
    
    console.log("USER ID:", user.id);
    console.log("PROFILE DATA:", data);
    console.log("PROFILE ERROR:", error);
    
    if(error){
        console.log("LOAD PROFILE ERROR:", error);
        return;
    }

    if(!data || data.length === 0){
        await createInitialProfile(user);
        return;
    }

    fillProfileData(data[0]);
}

/* ========================================= */
/* CREATE INITIAL PROFILE */
/* ========================================= */
async function createInitialProfile(user){

    const employeeId = "CEO-" + Date.now();

    const { error } = await db
        .from("admin_users")
        .insert({
            user_id: user.id,
            email: user.email,
            full_name: user.email,
            role: "staff",
            employee_id: employeeId,
            theme_prefer: "light"
        });

    if(error){
        console.log("CREATE PROFILE ERROR:", error);
        alert("Gagal membuat profil awal.");
        return;
    }

    await loadProfile(user);
}


/* ========================================= */
/* FILL UI */
/* ========================================= */
function fillProfileData(data){

    setText("fullName", data.full_name);
    setText("roleBadge", data.role);
    setText("employeeId", data.employee_id);

    setValue("nameInput", data.full_name);
    setValue("emailInput", data.email);
    setValue("phoneInput", data.phone);
    setValue("birthInput", data.birth_date);
    setValue("addressInput", data.address);
    setValue("genderInput", data.gender);
    setValue("positionInput", data.position);
    setValue("roleInput", data.role);
    setValue("bankNameInput", data.bank_name);
    setValue("bankNumberInput", data.bank_account_number);

    setChecked("emailNotif", data.email_notif);
    setChecked("waNotif", data.wa_notif);
    setChecked("financeNotif", data.finance_notif);

    if(data.photo_url){
        document.getElementById("profilePhoto").src = data.photo_url;
    }

    if(data.theme_prefer){
        applyTheme(data.theme_prefer);
        const select = document.getElementById("themeSelect");
        if(select) select.value = data.theme_prefer;
    }

    styleRoleBadge(data.role);
}


/* ========================================= */
/* SAVE PROFILE */
/* ========================================= */
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
        .eq("user_id", currentUserId)
        .select(); // penting supaya tidak 400

    if(error){
        console.log("UPDATE ERROR:", error);
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

        const { error: uploadError } = await db.storage
            .from(bucket)
            .upload(path, file, { upsert: true });

        if(uploadError){
            console.log("UPLOAD ERROR:", uploadError);
            alert("Upload gagal.");
            return;
        }

        const { data } = await db.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        const url = data?.signedUrl;

        const { error: updateError } = await db
          .from("admin_users")
          .update({ [field]: url })
          .eq("user_id", currentUserId)
          .select();
        
        if(updateError){
            console.log("PHOTO UPDATE ERROR:", updateError);
            alert("Gagal menyimpan URL file.");
            return;
        }

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
            .eq("user_id", currentUserId);
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
