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

  /* ================= HEADER ================= */

  document.getElementById("inv-number").textContent =
    "INV-"+String(data.id).padStart(5,"0");

  document.getElementById("inv-date").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("c-name").textContent = data.nama;
  document.getElementById("c-phone").textContent = data.phone;
  document.getElementById("c-metode").textContent = data.metode;

  /* ================= SERVICE INFO ================= */

  document.getElementById("service-status").textContent = data.status;

  document.getElementById("service-created").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("service-finished").textContent =
    data.tanggal_selesai
      ? new Date(data.tanggal_selesai).toLocaleString("id-ID")
      : "-";

  document.getElementById("payment-status").textContent =
    data.payment_status || "Belum Bayar";

  /* ================= TOP ================= */

  if(data.use_top && data.due_date){
    document.getElementById("top-section").style.display = "block";
    document.getElementById("top-info").textContent =
      `${data.top_days} Hari (Jatuh Tempo: ${
        new Date(data.due_date).toLocaleDateString("id-ID")
      })`;
  }

  /* ================= ITEMS ================= */

  const tbody = document.getElementById("invoice-items");
  tbody.innerHTML = "";

  let subtotal = 0;

  if(data.sparepart){
    try{
      const items = JSON.parse(data.sparepart);

      items.forEach(item=>{
        const total = item.harga * item.qty;
        subtotal += total;

        tbody.innerHTML += `
          <tr>
            <td>${item.nama}</td>
            <td>${item.qty}</td>
            <td>${rupiah(item.harga)}</td>
            <td>${rupiah(total)}</td>
          </tr>
        `;
      });

    }catch(e){}
  }

  document.getElementById("sub-total").textContent = rupiah(subtotal);
  document.getElementById("trans-total").textContent = rupiah(data.transport || 0);
  document.getElementById("jasa-total").textContent = rupiah(data.jasa || 0);

  const grand =
    subtotal +
    (data.transport || 0) +
    (data.jasa || 0);

  document.getElementById("grand-total").textContent = rupiah(grand);

  /* ================= WATERMARK ================= */

  const wm = document.getElementById("watermark");

  if(data.payment_status === "Lunas"){
    wm.textContent = "LUNAS";
    wm.style.color = "rgba(0,150,0,0.15)";
  }else{
    wm.textContent = "BELUM LUNAS";
    wm.style.color = "rgba(200,0,0,0.15)";
  }

  /* ================= QR VERIFICATION ================= */

  const verifyUrl =
    window.location.origin + "/cek.html?id=" + data.id;

  QRCode.toCanvas(
    document.createElement("canvas"),
    verifyUrl,
    (err, canvas)=>{
      if(!err){
        document.getElementById("qr").appendChild(canvas);
      }
    }
  );

});
