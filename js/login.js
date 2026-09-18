"use strict";
const client = window.supabaseClient;
const alertBox = document.getElementById("alertBox");
const loginForm = document.getElementById("loginForm");
function showAlert(message,type="error"){
  if(!alertBox)return;
  alertBox.style.display="block";
  alertBox.className=`alert-box ${type === "success" ? "alert-success" : "alert-error"}`;
  alertBox.textContent=message;
}
function clearAlert(){ if(alertBox) alertBox.style.display="none"; }
document.addEventListener("DOMContentLoaded",async()=>{
  if(!client){ showAlert("Supabase belum siap. Periksa js/supabase.js."); return; }
  const {data}=await client.auth.getSession();
  if(data?.session) window.location.href="dapur.html";
});
document.getElementById("googleLogin")?.addEventListener("click",async()=>{
  clearAlert();
  const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/login.html"}});
  if(error) showAlert(error.message);
});
loginForm?.addEventListener("submit",async(e)=>{
  e.preventDefault(); clearAlert();
  const email=document.getElementById("loginEmail").value.trim();
  const password=document.getElementById("loginPassword").value;
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error){ showAlert("Email atau password salah."); return; }
  const user=data.user;
  const {data:adminData,error:roleError}=await client.from("admin_users").select("role, is_active").eq("user_id",user.id).maybeSingle();
  if(roleError){ await client.auth.signOut(); showAlert("Gagal mengambil data admin."); return; }
  if(!adminData){ await client.auth.signOut(); showAlert("Akun tidak terdaftar sebagai admin."); return; }
  if(!adminData.is_active){ await client.auth.signOut(); showAlert("Akun belum diaktifkan admin."); return; }
  localStorage.setItem("userRole",adminData.role); localStorage.setItem("userId",user.id);
  window.location.href="dapur.html";
});
