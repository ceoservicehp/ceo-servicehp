"use strict";

const client = window.supabaseClient;
let currentData = null;

function rupiah(n){
  return "Rp " + Number(n||0).toLocaleString("id-ID");
}

function getId(){
  return new URLSearchParams(window.location.search).get("id");
}

/* ================= MAIN LOAD ================= */
document.addEventListener("DOMContentLoaded", async ()=>{

  /* ================= ACCORDION PROBLEM ================= */
  const toggleBtn = document.getElementById("problemToggle");
  const content = document.getElementById("problemContent");
  const icon = toggleBtn?.querySelector("i");

  toggleBtn?.addEventListener("click", () => {
    content.classList.toggle("active");
    icon?.classList.toggle("rotate");
  });

  /* ================= LOAD DATA ================= */
  const id = getId();
  if(!id) return;

  const { data, error } = await client
    .from("service_orders")
    .select("*")
    .eq("id", id)
    .single();

  if(error || !data){
    console.log("Gagal load invoice:", error);
    return;
  }

  currentData = data;

  /* ================= HEADER ================= */
  document.getElementById("inv-number").textContent =
    "INV-"+String(data.id).padStart(5,"0");

  document.getElementById("inv-date").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("c-name").textContent = data.nama || "-";
  document.getElementById("c-phone").textContent = data.phone || "-";
  document.getElementById("c-alamat").textContent = data.alamat || "-";
  document.getElementById("c-metode").textContent = data.metode || "-";
  document.getElementById("c-problem").textContent = data.problem || "-";

  if(data.problem){
    content?.classList.add("active");
    icon?.classList.add("rotate");
  }

  /* ================= SERVICE INFO ================= */
  document.getElementById("service-status").textContent = data.status || "-";

  document.getElementById("service-created").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("service-finished").textContent =
    data.tanggal_selesai
      ? new Date(data.tanggal_selesai).toLocaleString("id-ID")
      : "-";

/* ================= GARANSI ================= */
const garansiBox = document.getElementById("garansiBox");
const garansiText = document.getElementById("garansiText");

if(garansiBox && garansiText){

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

    garansiBox.style.display = "block";

    garansiText.innerHTML = `
      Berlaku sampai: <b>${garansiDate.toLocaleDateString("id-ID")}</b><br>
      Status: ${status} ${sisaHari}
    `;

  }else{

    // ✅ fallback kalau tidak ada tanggal garansi
    garansiBox.style.display = "block";
    garansiText.innerHTML = `
      Masa garansi: <b>Menyesuaikan jenis perbaikan</b>
    `;

  }
}
  
  const paymentStatusEl = document.getElementById("payment-status");
  paymentStatusEl.textContent = data.payment_status || "Belum Lunas";

  if((data.payment_status || "").toLowerCase().includes("lunas")){
    paymentStatusEl.classList.add("paid");
  }else{
    paymentStatusEl.classList.add("unpaid");
  }

  /* ================= TEMPO ================= */
  if(data.use_top && data.due_date){
    document.getElementById("top-section").style.display = "flex";
    document.getElementById("top-info").textContent =
      `${data.top_days || 0} Hari (Jatuh Tempo: ${
        new Date(data.due_date).toLocaleDateString("id-ID")
      })`;
  }

 /* ================= ITEMS TABLE ================= */
const container = document.getElementById("invoice-items");
container.innerHTML = "";

let subtotal = 0;

if(data.sparepart){
  try{

    const items = JSON.parse(data.sparepart);

    items.forEach((item)=>{

      const harga = item.harga || 0;
      const qty = item.qty || 0;
      const total = harga * qty;

      subtotal += total;

      container.innerHTML += `
        <tr>
          <td>${item.nama}</td>
          <td>${qty}</td>
          <td>${rupiah(harga)}</td>
          <td>${rupiah(total)}</td>
        </tr>
      `;

    });

  }catch(e){
    console.log("Format sparepart salah");
  }
}
  
  document.getElementById("sub-total").textContent = rupiah(subtotal);
  document.getElementById("trans-total").textContent = rupiah(data.transport || 0);
  document.getElementById("jasa-total").textContent = rupiah(data.jasa || 0);

  const grand =
  subtotal +
  (data.transport || 0) +
  (data.jasa || 0);

document.getElementById("grand-total").textContent = rupiah(grand);

/* ================= PEMBAYARAN ================= */

const paid = data.amount_paid || 0;
let remaining = grand - paid;

const paidEl = document.getElementById("paid-total");
const remainingEl = document.getElementById("remaining-total");
const remainingRow = document.getElementById("row-remaining");

if(paidEl) paidEl.textContent = rupiah(paid);

if(remainingRow && remainingEl){

  // KURANG BAYAR
  if(remaining > 0){
    remainingRow.querySelector("span").textContent = "Kurang Bayar";
    remainingEl.textContent = "- " + rupiah(remaining);
  }

  // LEBIH BAYAR
  else if(remaining < 0){
    const change = Math.abs(remaining);
    remainingRow.querySelector("span").textContent = "Kembalian";
    remainingEl.textContent = rupiah(change);
  }

  // PAS
  else{
    remainingRow.style.display = "none";
  }

}

  /* ================= HIDE ZERO VALUE ================= */

const rowSubtotal = document.getElementById("row-subtotal");
const rowTransport = document.getElementById("row-transport");
const rowJasa = document.getElementById("row-jasa");
const rowPaid = document.getElementById("row-paid");
const rowRemaining = document.getElementById("row-remaining");

if(subtotal === 0 && rowSubtotal){
  rowSubtotal.style.display = "none";
}

if((data.transport || 0) === 0 && rowTransport){
  rowTransport.style.display = "none";
}

if((data.jasa || 0) === 0 && rowJasa){
  rowJasa.style.display = "none";
}

if(paid === 0 && rowPaid){
  rowPaid.style.display = "none";
}

if(remaining === 0 && rowRemaining){
  rowRemaining.style.display = "none";
}
  
  /* ================= WATERMARK + DIGITAL STAMP ================= */
  const wm = document.getElementById("watermark");
  const stamp = document.getElementById("digital-stamp");

  if(data.payment_status === "Lunas"){
    wm.textContent = "LUNAS";
    wm.style.color = "rgba(0,150,0,0.12)";
    stamp.textContent = "✔ LUNAS";
    stamp.classList.add("stamp-paid");
  }else{
    wm.textContent = "BELUM LUNAS";
    wm.style.color = "rgba(200,0,0,0.12)";
    stamp.textContent = "BELUM LUNAS";
    stamp.classList.add("stamp-unpaid");
  }

  /* ================= QR ================= */
  const verifyUrl =
    window.location.origin + "/verifikasi.html?id=" + data.id;

  QRCode.toCanvas(
    document.createElement("canvas"),
    verifyUrl,
    (err, canvas)=>{
      if(!err){
        document.getElementById("qr").appendChild(canvas);
      }
    }
  );

  await loadSignature();

}); // ← hanya SATU penutup di sini

/* ================= LOAD SIGNATURE ================= */
async function loadSignature(){

  const sigBox = document.getElementById("ttdImg");
  const nameEl = document.getElementById("ttdName");

  if(!currentData?.approved_by){
    console.log("approved_by kosong");
    return;
  }

  const { data, error } = await client
    .from("profiles")
    .select("signature_url, full_name")
    .eq("id", currentData.approved_by)
    .maybeSingle();

  if(error){
    console.log("Signature error:", error.message);
    return;
  }

  if(!data){
    console.log("Profile tidak ditemukan");
    return;
  }

  if(data.full_name && nameEl){
    nameEl.textContent = data.full_name;
  }

  if(data.signature_url && sigBox){

    let imageUrl = data.signature_url;

    if(!imageUrl.startsWith("http")){
      const { data: publicUrlData } = client
        .storage
        .from("signature_url")
        .getPublicUrl(imageUrl);

      imageUrl = publicUrlData.publicUrl;
    }

    sigBox.style.backgroundImage = `url("${imageUrl}")`;
    sigBox.style.backgroundSize = "contain";
    sigBox.style.backgroundRepeat = "no-repeat";
    sigBox.style.backgroundPosition = "center";
  }
}

/* ================= DOWNLOAD PDF ================= */
function downloadPDF(){

  if(!currentData) return;

  const element = document.getElementById("invoice-area");

  document.body.classList.add("pdf-body");

  const opt = {
    margin: 0,
    filename: "Invoice_"+currentData.id+".pdf",

    image: { type: 'jpeg', quality: 0.98 },

    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      backgroundColor: "#ffffff",
      windowWidth: 1200
    },

    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };

  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(()=>{
      document.body.classList.remove("pdf-body");
    });

}

/* ================= WHATSAPP ================= */
function sendWhatsApp(){
  if(!currentData) return;

  const url = window.location.href;
  const adminPhone = "62895379221306";

  let msg = `
📄 INVOICE SERVICE HP

Nama: ${currentData.nama}
Status Service: ${currentData.status}
Status Pembayaran: ${currentData.payment_status || "Belum Lunas"}

Link Invoice:
${url}
`;

  window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`);
}
