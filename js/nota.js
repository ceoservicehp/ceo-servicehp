"use strict";

const db = window.supabaseClient;

function rupiah(n){
return "Rp " + Number(n||0).toLocaleString("id-ID");
}

function getId(){
return new URLSearchParams(window.location.search).get("id");
}

function generateInvoiceNumber(id){
const now = new Date();
return "INV-" +
now.getFullYear() +
String(id).padStart(4,"0");
}

document.addEventListener("DOMContentLoaded", async ()=>{

const id = getId();
if(!id) return;

const { data } = await db
.from("service_orders")
.select("*")
.eq("id", id)
.single();

if(!data) return;

document.getElementById("inv-number").textContent =
generateInvoiceNumber(data.id);

document.getElementById("inv-date").textContent =
new Date(data.created_at).toLocaleString("id-ID");

document.getElementById("c-name").textContent = data.nama;
document.getElementById("c-phone").textContent = data.phone;
document.getElementById("c-metode").textContent = data.metode;

let subtotal = 0;
const tbody = document.getElementById("invoice-items");

if(data.sparepart){
try{
const parts = JSON.parse(data.sparepart);

parts.forEach(p=>{
const total = p.qty * p.harga;
subtotal += total;

tbody.innerHTML += `
<tr>
<td>${p.nama}</td>
<td>${p.qty}</td>
<td>${rupiah(p.harga)}</td>
<td>${rupiah(total)}</td>
</tr>
`;
});
}catch(e){}
}

document.getElementById("sub-total").textContent = rupiah(subtotal);
document.getElementById("trans-total").textContent = rupiah(data.transport||0);
document.getElementById("jasa-total").textContent = rupiah(data.jasa||0);

const grand = subtotal + (data.transport||0) + (data.jasa||0);
document.getElementById("grand-total").textContent = rupiah(grand);

/* ===== QR CODE ===== */
const invoiceUrl = window.location.href;

QRCode.toCanvas(document.createElement("canvas"), invoiceUrl, (err, canvas)=>{
if(!err){
document.getElementById("qr").appendChild(canvas);
}
});

});
