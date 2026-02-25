(function(){

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

    const { data: sessionData } = await db.auth.getSession();

    if(!sessionData.session){
        window.location.href = "login.html";
        return;
    }

    const user = sessionData.session.user;
    currentUserId = user.id;

    applySavedTheme();
    setupUploadHandlers();

    await loadProfile(user);
    await loadRole();
});


/* ========================================= */
/* LOAD PROFILE */
/* ========================================= */
async function loadProfile(user){

    const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if(error){
        console.log("LOAD PROFILE ERROR:", error);
        return;
    }

    // AUTO CREATE PROFILE
    if(!data){

        const { error: insertError } = await db
            .from("profiles")
            .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || "",
                created_at: new Date()
            });

        if(insertError){
            console.log("AUTO CREATE PROFILE ERROR:", insertError);
            return;
        }

        return loadProfile(user);
    }

    // AUTO GENERATE EMPLOYEE ID
    if(!data.employee_id){
        const random = Math.floor(Math.random() * 9000) + 1000;
        const employeeId = "CEO-" + random;

        await db
          .from("profiles")
          .update({ employee_id: employeeId })
          .eq("id", user.id);

        data.employee_id = employeeId;
    }

    fillProfileData(data);
}


/* ========================================= */
/* LOAD ROLE */
/* ========================================= */
async function loadRole(){

    const { data } = await db
        .from("admin_users")
        .select("role")
        .eq("user_id", currentUserId)
        .maybeSingle();

    if(!data) return;

    setText("roleBadge", data.role);
    setValue("roleInput", data.role);
    styleRoleBadge(data.role);
}


/* ========================================= */
/* FILL UI */
/* ========================================= */
function fillProfileData(data){

    setText("fullName", data.full_name);
    setText("employeeId", data.employee_id);

    setValue("nameInput", data.full_name);
    setValue("emailInput", data.email);
    setValue("phoneInput", data.phone);
    setValue("birthInput", data.birth_date);
    setValue("addressInput", data.address);
    setValue("genderInput", data.gender);
    setValue("positionInput", data.position);
    setValue("bankNameInput", data.bank_name);
    setValue("bankNumberInput", data.bank_account);
    setValue("bankOwnerInput", data.bank_owner);

    const emailNotif = document.getElementById("emailNotif");
    const waNotif = document.getElementById("waNotif");
    const financeNotif = document.getElementById("financeNotif");
    
    if(emailNotif) emailNotif.checked = data.email_notification || false;
    if(waNotif) waNotif.checked = data.wa_notification || false;
    if(financeNotif) financeNotif.checked = data.finance_notification || false;
    
    if(data.photo_url){
        document.getElementById("profilePhoto").src = data.photo_url;
    }

    if(data.theme_prefer){
        applyTheme(data.theme_prefer);
        document.getElementById("themeSelect").value = data.theme_prefer;
    }
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
        bank_account: getValue("bankNumberInput"),
        bank_owner: getValue("bankOwnerInput"),
        email_notification: document.getElementById("emailNotif").checked,
        wa_notification: document.getElementById("waNotif").checked,
        finance_notification: document.getElementById("financeNotif").checked,
        theme_prefer: getValue("themeSelect"),
        updated_at: new Date()
    };

    if(!updateData.full_name){
        alert("Nama tidak boleh kosong.");
        return;
    }

    // UPDATE PROFILE
    const { error } = await db
        .from("profiles")
        .update(updateData)
        .eq("id", currentUserId);

    if(error){
        console.log("UPDATE PROFILE ERROR:", error);
        alert("Gagal menyimpan profil.");
        return;
    }

    // SYNC KE admin_users
    await db
        .from("admin_users")
        .update({
            nama: updateData.full_name,
            phone: updateData.phone,
            position: updateData.position
        })
        .eq("user_id", currentUserId);

    setText("fullName", updateData.full_name);
    applyTheme(updateData.theme_prefer);

    alert("Profil berhasil diperbarui.");
}

document.getElementById("saveProfile")
?.addEventListener("click", saveProfile);


/* ========================================= */
/* IMAGE COMPRESS */
/* ========================================= */
async function compressImage(file){

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");

    const maxWidth = 800;
    const scale = maxWidth / bitmap.width;

    canvas.width = maxWidth;
    canvas.height = bitmap.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return new Promise(resolve=>{
        canvas.toBlob(blob=>{
            resolve(blob);
        }, "image/jpeg", 0.7);
    });
}


/* ========================================= */
/* UPLOAD HANDLER */
/* ========================================= */
function setupUploadHandlers(){
    setupUpload("uploadPhoto", "admin-photos", "photo_url");
    setupUpload("uploadKTP", "admin-documents", "ktp_url");
    setupUpload("uploadSignature", "admin-documents", "signature_url");
}

   function setupUpload(inputId, bucket, field){

    document.getElementById(inputId)
    ?.addEventListener("change", async e=>{

        const file = e.target.files[0];
        if(!file) return;
        // VALIDASI TIPE FILE
        if(!file.type.startsWith("image/")){
            alert("Hanya file gambar yang diperbolehkan.");
            return;
        }
        
        // BATASI SIZE 5MB
        const maxSize = 2 * 1024 * 1024;

        if(file.size > maxSize){
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            alert(`Ukuran file ${sizeMB}MB melebihi batas 2MB.`);
            return;
        }
        
        try{

            // PREVIEW FOTO LANGSUNG
            if(field === "photo_url"){
                document.getElementById("profilePhoto").src =
                    URL.createObjectURL(file);
            }

            // COMPRESS IMAGE
            let compressed;

            try{
                compressed = await compressImage(file);
            }catch{
                compressed = file;
            }

            const path = `${currentUserId}/${field}.jpg`;

            // UPLOAD KE STORAGE
            const { error: uploadError } = await db.storage
                .from(bucket)
                .upload(path, compressed, {
                    upsert: true,
                    contentType: "image/jpeg"
                });

            if(uploadError){
                console.log("UPLOAD ERROR:", uploadError);
                alert("Upload gagal: " + uploadError.message);
                return;
            }

            // AMBIL PUBLIC URL
        const { data: publicData } = db.storage
            .from(bucket)
            .getPublicUrl(path);
        
        if(!publicData?.publicUrl){
            alert("Gagal mendapatkan URL file.");
            return;
        }
        
        const url = publicData.publicUrl;
        
        // SIMPAN KE DATABASE
        const { error: updateError } = await db
            .from("profiles")
            .update({ [field]: url })
            .eq("id", currentUserId);
        
        if(updateError){
            console.log("DB UPDATE ERROR:", updateError);
            alert("Gagal menyimpan URL.");
            return;
        }
        
        // UPDATE FOTO SETELAH UPLOAD
        if(field === "photo_url"){
            document.getElementById("profilePhoto").src = url;
        }
        
        alert("Upload berhasil.");
            
        }catch(err){
            console.log("UPLOAD CATCH ERROR:", err);
            alert("Terjadi kesalahan saat upload.");
        }
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
    localStorage.setItem("theme", theme);
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

function getValue(id){
    return document.getElementById(id)?.value || "";
}


/* ========================================= */
/* LOGOUT */
/* ========================================= */
document.getElementById("logoutBtn")
?.addEventListener("click", async () => {
  await db.auth.signOut();
  localStorage.removeItem("userRole");
  window.location.href = "login.html";
});

})();
