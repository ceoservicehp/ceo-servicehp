"use strict";

const supabase = window.supabaseClient;

/* ================= ELEMENT ================= */
const alertBox = document.getElementById("alertBox");
const loginForm = document.getElementById("loginForm");
const resetForm = document.getElementById("resetForm");
const updatePasswordForm = document.getElementById("updatePasswordForm");

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

/* ================= CHECK SESSION ================= */
document.addEventListener("DOMContentLoaded", async () => {

  if(!supabase) return;

  const { data } = await supabase.auth.getSession();

  if(data?.session){
    window.location.href = "dapur.html";
  }

});

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
?.addEventListener("click", async () => {

  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/login.html"
    }
  });

});

/* ================= LOGIN ================= */
loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();

  const email = loginForm.loginEmail.value.trim();
  const password = loginForm.loginPassword.value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if(error){
    showAlert("Email atau password salah.");
    return;
  }

  const user = data.user;

  const { data: adminData, error: roleError } = await supabase
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if(roleError){
    showAlert("Gagal mengambil data admin.");
    return;
  }

  if(!adminData){
    await supabase.auth.signOut();
    showAlert("Akun tidak terdaftar sebagai admin.");
    return;
  }

  if(!adminData.is_active){
    await supabase.auth.signOut();
    showAlert("Akun belum diaktifkan admin.");
    return;
  }

  localStorage.setItem("userRole", adminData.role);
  localStorage.setItem("userId", user.id);

  window.location.href = "dapur.html";
});
