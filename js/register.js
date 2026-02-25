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

  // 🔥 Signup dengan redirect Vercel
  const { data: signUpData, error: signUpError } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://ceo-servicehp.vercel.app/login.html"
    }
  });

  if(signUpError){
    showAlert(signUpError.message);
    return;
  }

  const user = signUpData?.user;

  if(!user){
    showAlert("Gagal membuat akun.");
    return;
  }

  // 🔥 Insert ke admin_users
  const { error: insertError } = await db
    .from("admin_users")
    .insert([
      {
        user_id: user.id,
        full_name: name,
        phone,
        position,
        role: "admin",
        is_active: false
      }
    ]);

  if(insertError){
    console.error(insertError);
    showAlert("Akun dibuat tapi gagal simpan data admin.");
    return;
  }

  showAlert("Registrasi berhasil! Silakan cek email untuk verifikasi.", "success");
  registerForm.reset();
});
