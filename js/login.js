"use strict";

/* ================== KONFIG LOGIN ================== */
const USER = "admin";
const PASS = "12345";

/* ================== HANDLE LOGIN ================== */
document.addEventListener("DOMContentLoaded", ()=>{

    const form = document.getElementById("loginForm");

    if(form){ // hanya jalan kalau di login.html

        form.addEventListener("submit", e=>{
            e.preventDefault();

            const u = document.getElementById("username").value.trim();
            const p = document.getElementById("password").value.trim();
            const err = document.getElementById("errorMsg");

            if(u===USER && p===PASS){

                localStorage.setItem("admin_login","true");

                window.location.href="dapur.html";

            }else{
                err.textContent="Username atau password salah!";
            }
        });
    }

    /* ================== PROTECT PAGE ================== */
    protectPage();

});

/* ================== PROTECT FUNCTION ================== */
function protectPage(){

    const isLogin = localStorage.getItem("admin_login");

    const protectedPages = ["dapur.html","keuangan.html"];

    const currentPage = window.location.pathname.split("/").pop();

    if(protectedPages.includes(currentPage)){
        if(isLogin!=="true"){
            window.location.href="login.html";
        }
    }
}

/* ================== LOGOUT FUNCTION ================== */
function logout(){
    localStorage.removeItem("admin_login");
    window.location.href="login.html";
}
