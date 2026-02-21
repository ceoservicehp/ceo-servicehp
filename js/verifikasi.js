"use strict";

const db = window.supabaseClient;
const id = new URLSearchParams(window.location.search).get("id");
const resultEl = document.getElementById("result");

if(!id){
  resultEl.innerHTML = "<p class='error'>ID tidak ditemukan.</p>";
}else{

  db.from("service_orders")
  .select("*")
  .eq("id", id)
  .single()
  .then(({data, error})=>{

    if(error || !data){
      resultEl.innerHTML = "<p class='error'>Data tidak ditemukan.</p>";
      return;
    }

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
    `;

  });
}
