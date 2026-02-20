"use strict";

const db = window.supabaseClient;

function rupiah(n){
return "Rp " + Number(n||0).toLocaleString("id-ID");
}

function getId(){
return new URLSearchParams(window.location.search).get("id");
}

let currentData = null;

/* ================= LOAD DATA ================= */
document.addEventListener("DOMContentLoaded", async ()=>{

const id = getId();
if(!id) return;

const { data } = await db
.from("service_orders")
.select("*")
.eq("id", id)
.single();

if(!data) return;

currentData = data;

document.getElementById("inv-number").textContent =
"INV-"+String(data.id).padStart(5,"0");

document.getElementById("inv-date").textContent =
new Date(data.created_at).toLocaleString("id-ID");

document.getElementById("c-name").textContent = data.nama;
document.getElementById("c-phone").textContent = data.phone;
document.getElementById("c-metode").textContent = data.metode;

/* WATERMARK */
const wm = document.getElementById("watermark");
wm.textContent = data.status === "selesai" ? "LUNAS" : "BELUM LUNAS";

/* QR VERIFICATION */
const verifyUrl = window.location.origin+"/cek.html?id="+data.id;

QRCode.toCanvas(document.createElement("canvas"), verifyUrl, (err, canvas)=>{
if(!err){
document.getElementById("qr").appendChild(canvas);
}
});

});

/* ================= DOWNLOAD PDF ================= */
function downloadPDF(){
const element = document.querySelector(".invoice");

html2pdf().set({
margin:0.5,
filename:"Invoice_CEO_"+currentData.id+".pdf",
image:{ type:'jpeg', quality:0.98 },
html2canvas:{ scale:2 },
jsPDF:{ unit:'in', format:'a4', orientation:'portrait' }
}).from(element).save();
}

/* ================= WHATSAPP ================= */
function sendWhatsApp(){

if(!currentData) return;

const url = window.location.href;

let msg =
`📄 *INVOICE SERVICE HP*%0A
Nama: ${currentData.nama}%0A
Total: ${rupiah(currentData.total)}%0A
Status: ${currentData.status}%0A
Lihat Invoice: ${url}`;

window.open(`https://wa.me/${currentData.phone}?text=${msg}`);
}

/* ================= SIGNATURE ================= */
const canvas = document.getElementById("signature-pad");
if(canvas){
const ctx = canvas.getContext("2d");
let drawing = false;

canvas.addEventListener("mousedown", ()=> drawing=true);
canvas.addEventListener("mouseup", ()=> drawing=false);
canvas.addEventListener("mousemove", draw);

function draw(e){
if(!drawing) return;
ctx.lineWidth = 2;
ctx.lineCap = "round";
ctx.strokeStyle = "#000";

ctx.lineTo(e.offsetX, e.offsetY);
ctx.stroke();
ctx.beginPath();
ctx.moveTo(e.offsetX, e.offsetY);
}
}
