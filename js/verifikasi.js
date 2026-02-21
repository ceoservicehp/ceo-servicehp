"use strict";

document.addEventListener("DOMContentLoaded", async ()=>{

const db = window.supabaseClient;
const resultEl = document.getElementById("result");

if(!db){
  resultEl.innerHTML = "<p class='error'>Koneksi database gagal.</p>";
  return;
}

const id = new URLSearchParams(window.location.search).get("id");

if(!id){
  resultEl.innerHTML = "<p class='error'>ID tidak ditemukan pada URL.</p>";
  return;
}

const { data, error } = await db
  .from("service_orders")
  .select("*")
  .eq("id", id)
  .single();

if(error || !data){
  resultEl.innerHTML = "<p class='error'>Data invoice tidak ditemukan.</p>";
  return;
}

const invoiceNumber = "INV-"+String(data.id).padStart(5,"0");

const statusClass =
  data.status?.toLowerCase() === "selesai" ? "selesai" :
  data.status?.toLowerCase() === "batal" ? "batal" :
  "proses";

const bayarClass =
  data.payment_status?.toLowerCase() === "lunas"
  ? "lunas"
  : "belum";

resultEl.innerHTML = `
  <div class="item">
    <span>Nomor Invoice</span>
    <b>${invoiceNumber}</b>
  </div>

  <div class="item">
    <span>Nama</span>
    <b>${data.nama || "-"}</b>
  </div>

  <div class="item">
    <span>Status Service</span>
    <span class="badge ${statusClass}">
      ${data.status || "-"}
    </span>
  </div>

  <div class="item">
    <span>Status Pembayaran</span>
    <span class="badge ${bayarClass}">
      ${data.payment_status || "Belum Lunas"}
    </span>
  </div>

  <div class="item">
    <span>Total</span>
    <b>Rp ${(data.total || 0).toLocaleString("id-ID")}</b>
  </div>

  <p class="success">Invoice Valid ✓</p>
`;

});
