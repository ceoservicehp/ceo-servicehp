"use strict";

const client = window.supabaseClient;
const alertBox = document.getElementById("alertBox");
const registerForm = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");

function showAlert(message, type="error"){
  if(!alertBox) return;
  alertBox.style.display = "block";
  alertBox.className = "alert-box " + (type === "success" ? "alert-success" : "alert-error");
  alertBox.textContent = message;
  alertBox.scrollIntoView({behavior:"smooth", block:"nearest"});
}
function clearAlert(){ if(alertBox) alertBox.style.display = "none"; }
function setLoading(active){
  if(!registerButton) return;
  registerButton.disabled = active;
  registerButton.innerHTML = active
    ? '<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses...</span>'
    : '<i class="fa-solid fa-user-plus"></i><span>Daftar Akun</span>';
}
function bindPasswordToggle(buttonId, inputId){
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  btn?.addEventListener("click", ()=>{
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
    btn.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  });
}
bindPasswordToggle("togglePassword", "registerPassword");
bindPasswordToggle("toggleConfirmPassword", "confirmPassword");

registerForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAlert();
  if(!client){ showAlert("Koneksi Supabase belum tersedia."); return; }

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const phone = document.getElementById("registerPhone").value.trim();
  const position = document.getElementById("registerPosition").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if(!name || !email || !phone || !position || !password || !confirmPassword){ showAlert("Semua data wajib diisi."); return; }
  if(password.length < 8){ showAlert("Password minimal 8 karakter."); return; }
  if(password !== confirmPassword){ showAlert("Konfirmasi password tidak sama."); return; }

  setLoading(true);
  try{
    const emailRedirectTo = window.location.origin + "/login.html";
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options:{ emailRedirectTo, data:{ full_name:name, phone, position } }
    });
    if(signUpError) throw signUpError;

    const user = signUpData?.user;
    if(!user) throw new Error("Gagal membuat akun pengguna.");

    const { error: insertError } = await client.from("admin_users").insert([{
      user_id:user.id,
      nama:name,
      email,
      phone,
      position,
      role:"admin",
      is_active:false
    }]);

    if(insertError){
      console.error("ADMIN INSERT ERROR:", insertError);
      showAlert("Akun Auth berhasil dibuat, tetapi data admin gagal disimpan. Hubungi Superadmin sebelum mencoba mendaftar ulang.");
      return;
    }

    registerForm.reset();
    showAlert("Registrasi berhasil. Silakan verifikasi email bila diminta, lalu tunggu Superadmin mengaktifkan akun Anda.", "success");
  }catch(error){
    console.error("REGISTER ERROR:", error);
    const msg = String(error?.message || "");
    if(/already|registered|exists/i.test(msg)) showAlert("Email tersebut sudah terdaftar. Silakan login atau gunakan Lupa Password.");
    else showAlert(msg || "Registrasi gagal. Silakan coba lagi.");
  }finally{
    setLoading(false);
  }
});
