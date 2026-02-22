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

    const { data } = await db.auth.getUser();
    const user = data?.user;

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
        .eq("email", user.email)
        .single();

    if(error){
        console.log("Profile belum ada, membuat baru...");
        await createInitialProfile(user);
        return;
    }

    fillProfileData(data);
}


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

    document.getElementById("fullName").textContent = data.name || "-";
    document.getElementById("roleBadge").textContent = data.role || "-";
    document.getElementById("employeeId").textContent = data.employee_id || "-";

    document.getElementById("nameInput").value = data.name || "";
    document.getElementById("emailInput").value = data.email || "";
    document.getElementById("phoneInput").value = data.phone || "";
    document.getElementById("birthInput").value = data.birth_date || "";
    document.getElementById("addressInput").value = data.address || "";
    document.getElementById("genderInput").value = data.gender || "";
    document.getElementById("positionInput").value = data.position || "";
    document.getElementById("roleInput").value = data.role || "";
    document.getElementById("bankNameInput").value = data.bank_name || "";
    document.getElementById("bankNumberInput").value = data.bank_number || "";
    document.getElementById("bankOwnerInput").value = data.bank_owner || "";

    document.getElementById("emailNotif").checked = data.email_notif || false;
    document.getElementById("waNotif").checked = data.wa_notif || false;
    document.getElementById("financeNotif").checked = data.finance_notif || false;

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
        name: document.getElementById("nameInput").value,
        phone: document.getElementById("phoneInput").value,
        birth_date: document.getElementById("birthInput").value,
        address: document.getElementById("addressInput").value,
        gender: document.getElementById("genderInput").value,
        position: document.getElementById("positionInput").value,
        bank_name: document.getElementById("bankNameInput").value,
        bank_number: document.getElementById("bankNumberInput").value,
        bank_owner: document.getElementById("bankOwnerInput").value,
        email_notif: document.getElementById("emailNotif").checked,
        wa_notif: document.getElementById("waNotif").checked,
        finance_notif: document.getElementById("financeNotif").checked
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
    location.reload();
}


/* ========================================= */
/* EMPLOYEE ID GENERATOR */
/* ========================================= */
function generateEmployeeId(){
    const random = Math.floor(1000 + Math.random() * 9000);
    return "CEO-" + random;
}


/* ========================================= */
/* UPLOAD HANDLER */
/* ========================================= */
function setupUploadHandlers(){

    document.getElementById("uploadPhoto")
    ?.addEventListener("change", async e=>{
        const file = e.target.files[0];
        if(!file) return;

        const url = await uploadFile("admin-photos", file, `photo-${currentUserId}`);
        await updateField("photo_url", url);

        document.getElementById("profilePhoto").src = url;
    });

    document.getElementById("uploadKTP")
    ?.addEventListener("change", async e=>{
        const file = e.target.files[0];
        if(!file) return;

        const url = await uploadFile("admin-documents", file, `ktp-${currentUserId}`);
        await updateField("ktp_url", url);

        alert("KTP berhasil diupload.");
    });

    document.getElementById("uploadSignature")
    ?.addEventListener("change", async e=>{
        const file = e.target.files[0];
        if(!file) return;

        const url = await uploadFile("admin-signatures", file, `sign-${currentUserId}`);
        await updateField("signature_url", url);

        alert("Tanda tangan berhasil diupload.");
    });
}


async function uploadFile(bucket, file, path){

    await db.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

    const { data } = db.storage
        .from(bucket)
        .getPublicUrl(path);

    return data.publicUrl;
}


async function updateField(field, value){
    await db
        .from("admin_users")
        .update({ [field]: value })
        .eq("user_id", currentUserId);
}


/* ========================================= */
/* ROLE BADGE STYLE */
/* ========================================= */
function styleRoleBadge(role){

    const badge = document.getElementById("roleBadge");

    badge.classList.remove("superadmin","admin","staff");

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

    if(theme === "dark"){
        document.body.classList.add("dark-mode");
    }else{
        document.body.classList.remove("dark-mode");
    }
}
