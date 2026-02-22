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
        .eq("user_id", user.id)
        .single();

    // Jika belum ada profile → buat
    if(error?.code === "PGRST116"){ 
    // no rows found
    await createInitialProfile(user);
    return;
    }

    fillProfileData(data);
}


/* ========================================= */
/* CREATE INITIAL PROFILE */
/* ========================================= */
async function createInitialProfile(user){

    const employeeId = generateEmployeeId();

    await db.from("admin_users").insert([{
        user_id: user.id,
        email: user.email,
        name: user.email,
        role: "staff",
        employee_id: employeeId
    }]);

    await loadProfile(user);
}


/* ========================================= */
/* FILL UI */
/* ========================================= */
function fillProfileData(data){

    setText("fullName", data.name);
    setText("roleBadge", data.role);
    setText("employeeId", data.employee_id);

    setValue("nameInput", data.name);
    setValue("emailInput", data.email);
    setValue("phoneInput", data.phone);
    setValue("birthInput", data.birth_date);
    setValue("addressInput", data.address);
    setValue("genderInput", data.gender);
    setValue("positionInput", data.position);
    setValue("roleInput", data.role);
    setValue("bankNameInput", data.bank_name);
    setValue("bankNumberInput", data.bank_number);
    setValue("bankOwnerInput", data.bank_owner);

    setChecked("emailNotif", data.email_notif);
    setChecked("waNotif", data.wa_notif);
    setChecked("financeNotif", data.finance_notif);

    if(data.photo_url){
        document.getElementById("profilePhoto").src = data.photo_url;
    }

    styleRoleBadge(data.role);
}


/* ========================================= */
/* SAVE PROFILE */
/* ========================================= */
document.getElementById("saveProfile")
?.addEventListener("click", saveProfile);

async function saveProfile(){

    const updateData = {
        name: getValue("nameInput"),
        phone: getValue("phoneInput"),
        birth_date: getValue("birthInput"),
        address: getValue("addressInput"),
        gender: getValue("genderInput"),
        position: getValue("positionInput"),
        bank_name: getValue("bankNameInput"),
        bank_number: getValue("bankNumberInput"),
        bank_owner: getValue("bankOwnerInput"),
        email_notif: getChecked("emailNotif"),
        wa_notif: getChecked("waNotif"),
        finance_notif: getChecked("financeNotif")
    };

    const { error } = await db
        .from("admin_users")
        .update(updateData)
        .eq("user_id", currentUserId);

    if(error){
        alert("Gagal menyimpan profil.");
        return;
    }

    alert("Profil berhasil diperbarui.");
}


/* ========================================= */
/* EMPLOYEE ID GENERATOR */
/* ========================================= */
function generateEmployeeId(){
    return "CEO-" + Date.now();
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

        const url = await uploadFile(bucket, file, path);
        if(!url){
            alert("Upload gagal.");
            return;
        }

        await updateField(field, url);

        if(field === "photo_url"){
            document.getElementById("profilePhoto").src = url;
        }

        alert("Upload berhasil.");
    });
}


/* ========================================= */
/* STORAGE (SIGNED URL SAFE VERSION) */
/* ========================================= */
async function uploadFile(bucket, file, path){

    const { error } = await db.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

    if(error){
        console.log(error);
        return null;
    }

    const { data } = await db.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 tahun

    return data?.signedUrl || null;
}


async function updateField(field, value){
    await db
        .from("admin_users")
        .update({ [field]: value })
        .eq("user_id", currentUserId);
}


/* ========================================= */
/* ROLE BADGE */
/* ========================================= */
function styleRoleBadge(role){

    const badge = document.getElementById("roleBadge");
    if(!badge) return;

    if(role === "superadmin"){
        badge.style.background = "#8e44ad";
    }
    else if(role === "admin"){
        badge.style.background = "#2c5364";
    }
    else{
        badge.style.background = "#7f8c8d";
    }
}


/* ========================================= */
/* THEME SWITCHER */
/* ========================================= */
function setupThemeSwitcher(){

    const select = document.getElementById("themeSelect");
    if(!select) return;

    select.addEventListener("change", e=>{
        const theme = e.target.value;
        localStorage.setItem("theme", theme);
        applyTheme(theme);
    });
}

function applySavedTheme(){
    const saved = localStorage.getItem("theme") || "light";
    applyTheme(saved);
    const select = document.getElementById("themeSelect");
    if(select) select.value = saved;
}

function applyTheme(theme){
    document.body.classList.toggle("dark-mode", theme === "dark");
}


/* ========================================= */
/* SMALL HELPERS */
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
