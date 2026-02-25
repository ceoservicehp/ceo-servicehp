"use strict";

const db = window.supabaseClient;

/* ================= ELEMENT ================= */
const alertBox = document.getElementById("alertBox");
const registerForm = document.getElementById("registerForm");

/* ================= ALERT ================= */
function showAlert(message, type="error"){
  if(!alertBox) return;
  alertBox.style.display = "block";
  alertBox.className = "alert-box";
  alertBox.classList.add(type === "success" ? "alert-success" : "alert-error");
  alertBox.textContent = message;
}

function clearAlert(){
  if(alertBox) alertBox.style.display = "none";
}

/* ================= REGISTER ================= */
registerForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const name = registerForm.registerName.value.trim();
  const email = registerForm.registerEmail.value.trim();
  const phone = registerForm.registerPhone.value.trim();
  const position = registerForm.registerPosition.value.trim();
  const password = registerForm.registerPassword.value;

  if(password.length < 6){
    showAlert("Password minimal 6 karakter.");
    return;
  }

  // 1️⃣ Buat akun di Supabase Auth
  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if(error){
    showAlert(error.message);
    return;
  }

  const user = data.user;

  if(!user){
    showAlert("Gagal membuat akun.");
    return;
  }

  // 2️⃣ Insert ke tabel admin_users
  const { data, error } = await db.auth.signUp({
  email: "test12345@gmail.com",
  password: "12345678"
});

console.log(data, error);

  if(insertError){
    console.error(insertError);
    showAlert("Akun dibuat tapi gagal simpan data admin.");
    return;
  }

  showAlert("Registrasi berhasil! Menunggu persetujuan superadmin.", "success");
  registerForm.reset();
});
