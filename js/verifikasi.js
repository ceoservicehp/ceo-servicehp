"use strict";

document.addEventListener("DOMContentLoaded", async ()=>{

const supabase = window.supabaseClient;
const resultEl = document.getElementById("result");

if(!supabase){
  resultEl.innerHTML = "<p class='error'>Koneksi database gagal.</p>";
  return;
}

const id = new URLSearchParams(window.location.search).get("id");

if(!id){
  resultEl.innerHTML = "<p class='error'>ID tidak ditemukan pada URL.</p>";
  return;
}

const { data, error } = await supabase
  .from("service_orders")
  .select("*")
  .eq("id", id)
  .single();

if(error || !data){
  resultEl.innerHTML = "<p class='error'>Data invoice tidak ditemukan.</p>";
  return;
}

/* ================= DATA UTAMA ================= */

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

/* ================= GARANSI ================= */

const garansiBox = document.getElementById("garansiBox");
const garansiText = document.getElementById("garansiText");

// ✅ pastikan element ada
if(!garansiBox || !garansiText) return;

// tampilkan box
garansiBox.style.display = "block";

if(data.garansi){

  const garansiDate = new Date(data.garansi);

  const today = new Date();
  today.setHours(0,0,0,0);
  garansiDate.setHours(0,0,0,0);

  const isActive = garansiDate >= today;

  const diffTime = garansiDate - today;
  const diffDays = Math.ceil(Math.abs(diffTime) / (1000 * 60 * 60 * 24));

  let sisaHari = "";

  if(isActive){
    sisaHari = diffDays > 0
      ? `(${diffDays} hari lagi)`
      : "(Hari ini terakhir)";
  }else{
    sisaHari = `(${diffDays} hari yang lalu)`;
  }

  const status = isActive
    ? "<span style='color:green;font-weight:600;'>🟢 Aktif</span>"
    : "<span style='color:red;font-weight:600;'>🔴 Habis</span>";

  garansiText.innerHTML = `
    Berlaku sampai: <b>${garansiDate.toLocaleDateString("id-ID")}</b><br>
    Status: ${status} ${sisaHari}
  `;

}else{

  garansiText.innerHTML = `
    Masa garansi: <b>Menyesuaikan jenis perbaikan</b>
  `;

}

});
