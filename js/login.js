const supabase = window.supabaseClient;

/* ================= GOOGLE LOGIN ================= */
document.getElementById("googleLogin")
.addEventListener("click", async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
  });
});

/* ================= LOGIN ================= */
document.getElementById("loginForm")
.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = loginEmail.value;
  const password = loginPassword.value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    errorMsg.textContent = "Email atau password salah";
    return;
  }

  window.location.href = "dapur.html";
});

/* ================= REGISTER ================= */
document.getElementById("registerForm")
.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = registerEmail.value;
  const password = registerPassword.value;

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if(error){
    errorMsg.textContent = error.message;
    return;
  }

  errorMsg.style.color="green";
  errorMsg.textContent="Akun berhasil dibuat! Silakan cek email untuk verifikasi.";
});

/* ================= RESET PASSWORD ================= */
document.getElementById("resetForm")
.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const email = resetEmail.value;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/login.html"
  });

  if(error){
    errorMsg.textContent="Gagal kirim reset email";
    return;
  }

  errorMsg.style.color="green";
  errorMsg.textContent="Link reset password sudah dikirim ke email.";
});

/* ================= SWITCH FORM ================= */
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const formTitle = document.getElementById("formTitle");

document.getElementById("showRegister").onclick = ()=>{
  loginForm.style.display="none";
  resetForm.style.display="none";
  registerForm.style.display="block";
  formTitle.textContent="Daftar Admin";
};

document.getElementById("showLogin").onclick = ()=>{
  registerForm.style.display="none";
  resetForm.style.display="none";
  loginForm.style.display="block";
  formTitle.textContent="Admin Login";
};

document.getElementById("showReset").onclick = ()=>{
  loginForm.style.display="none";
  registerForm.style.display="none";
  resetForm.style.display="block";
  formTitle.textContent="Reset Password";
};

/* ================= AUTO REDIRECT ================= */
supabase.auth.getSession().then(({ data })=>{
  if(data.session){
    window.location.href="dapur.html";
  }
});
