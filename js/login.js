"use strict";

/* ================== KONFIG LOGIN ================== */
const USER = "admin";
const PASS = "12345";

/* ================== DAFTAR HALAMAN YANG WAJIB LOGIN ================== */
const PROTECTED_PAGES = [
    "dapur.html",
    "keuangan.html",
    "produk.html",
    "pengeluaran.html",
    "kelola.html"
];

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", ()=>{

    handleLoginForm();
    protectPage();
    handleLogout(); // ⬅ TAMBAHKAN INI

});

/* ================== HANDLE LOGIN ================== */
function handleLoginForm(){

    const form = document.getElementById("loginForm");

    if(!form) return; // hanya jalan di login.html

    form.addEventListener("submit", e=>{
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const errorMsg = document.getElementById("errorMsg");

        if(username === USER && password === PASS){

            localStorage.setItem("admin_login","true");

            // redirect ke dapur sebagai default
            window.location.href = "dapur.html";

        }else{
            errorMsg.textContent = "Username atau password salah!";
        }
    });

}

/* ================== PROTECT PAGE ================== */
function protectPage(){

    const currentPage = window.location.pathname.split("/").pop();

    if(PROTECTED_PAGES.includes(currentPage)){

        const isLogin = localStorage.getItem("admin_login");

        if(isLogin !== "true"){
            window.location.href = "login.html";
        }
    }
}

/* ================== HANDLE LOGOUT ================== */
function handleLogout(){

    const logoutBtn = document.getElementById("logoutBtn");

    if(!logoutBtn) return; // hanya jalan jika tombol ada

    logoutBtn.addEventListener("click", ()=>{
        localStorage.removeItem("admin_login");
        window.location.href = "index.html"; 
        // atau "login.html" kalau mau balik ke login
    });

}
