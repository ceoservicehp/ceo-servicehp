"use strict";

const USER = "admin";
const PASS = "12345";

document.getElementById("loginForm").addEventListener("submit", e=>{
e.preventDefault();

const u = document.getElementById("username").value.trim();
const p = document.getElementById("password").value.trim();
const err = document.getElementById("errorMsg");

if(u===USER && p===PASS){

localStorage.setItem("admin_login","true");

window.location.href="dapur.html";
}
else{
err.textContent="Username atau password salah!";
}
});


/* PROTECT HALAMAN DAPUR */
if(window.location.pathname.includes("dapur.html")){
if(localStorage.getItem("admin_login")!=="true"){
window.location.href="login.html";
}
}
