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
  document.getElementById("c-brand").textContent = data.brand || "-";
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

function loadImage(url){
  return new Promise((resolve,reject)=>{

    const img = new Image();

    img.crossOrigin = "Anonymous";

    img.onload = ()=>resolve(img);

    img.onerror = reject;

    img.src = url;
  });
}

async function downloadPDF(){

  if(!currentData) return;

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // ================= HELPER =================

  function drawBox(x, y, w, h){

    pdf.setDrawColor(230);
    pdf.setFillColor(250,252,253);

    pdf.roundedRect(
      x,
      y,
      w,
      h,
      4,
      4,
      "FD"
    );
  }

  function formatRupiah(value){
    return "Rp " + Number(value || 0).toLocaleString("id-ID");
  }

  // ================= HEADER =================

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(22);

  pdf.setTextColor(20,120,120);
  pdf.text("CEO PART & SERVICE", 20, 20);

  pdf.setFontSize(10);
  pdf.setTextColor(90);

  pdf.text("Cellular Engineering Officer", 20, 27);
  pdf.text("ITC Roxy Mas LT.1 No.123 B", 20, 33);

  pdf.text(
    "Jl. KH. Hasyim Ashari No.125, Jakarta Pusat",
    20,
    39
  );

  // garis
  pdf.setDrawColor(225);
  pdf.line(20, 45, 190, 45);

  // ================= WATERMARK =================

pdf.setFontSize(50);

if(currentData.payment_status === "Lunas"){

  pdf.setTextColor(0,150,0,0.08);

  pdf.text(
    "LUNAS",
    105,
    170,
    {
      align:"center",
      angle: -25
    }
  );

}else{

  pdf.setTextColor(220,0,0,0.08);

  pdf.text(
    "BELUM LUNAS",
    105,
    170,
    {
      align:"center",
      angle: -25
    }
  );

}

pdf.setTextColor(40);

  // ================= INVOICE INFO =================

  drawBox(145, 14, 45, 22);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(40);

  pdf.text(
    "INV-"+String(currentData.id).padStart(5,"0"),
    152,
    24
  );

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(9);

  pdf.setTextColor(100);

  pdf.text(
    new Date(currentData.created_at)
      .toLocaleString("id-ID"),
    152,
    31
  );

  // ================= BOX =================

  drawBox(15, 52, 82, 70);
  drawBox(103, 52, 87, 70);

  // ================= DATA PELANGGAN =================

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(20,120,120);

  pdf.text("Data Pelanggan", 20, 63);

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.setTextColor(70);

  pdf.text(`Nama : ${currentData.nama || "-"}`, 20, 74);

  pdf.text(`No HP : ${currentData.phone || "-"}`, 20, 83);

  pdf.text(`Merk HP : ${currentData.brand || "-"}`, 20, 92);

  pdf.text(`Metode : ${currentData.metode || "-"}`, 20, 101);

  // detail kerusakan
  pdf.setFont("helvetica","bold");
  pdf.setTextColor(40);

  pdf.text("Detail Kerusakan", 20, 112);

  pdf.setFont("helvetica","normal");
  pdf.setTextColor(90);

  const problem = pdf.splitTextToSize(
    currentData.problem || "-",
    68
  );

  pdf.text(problem, 20, 119);

  // ================= SERVICE =================

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(20,120,120);

  pdf.text("Informasi Service", 108, 63);

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.setTextColor(70);

  pdf.text(`Status : ${currentData.status || "-"}`, 108, 74);

  pdf.text(
    `Tgl Masuk : ${
      new Date(currentData.created_at)
        .toLocaleDateString("id-ID")
    }`,
    108,
    83
  );

  pdf.text(
    `Tgl Selesai : ${
      currentData.finished_at
      ? new Date(currentData.finished_at)
          .toLocaleDateString("id-ID")
      : "-"
    }`,
    108,
    92
  );

  pdf.text(
    `Status Bayar : ${
      currentData.payment_status || "Belum Lunas"
    }`,
    108,
    101
  );

  // badge
if((currentData.payment_status || "")
.toLowerCase().includes("lunas")){

  pdf.setFillColor(220,255,230);

}else{

  pdf.setFillColor(255,230,230);

}

pdf.roundedRect(108, 106, 40, 8, 2, 2, "F");

pdf.setFontSize(9);

pdf.text(
  currentData.payment_status || "Belum Lunas",
  128,
  111,
  {align:"center"}
);

  // ================= TABLE =================

  drawBox(15, 130, 175, 68);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(20,120,120);

  pdf.text(
    "Detail Jenis Perbaikan / Sparepart",
    20,
    141
  );

  let body = [];
  let subtotal = 0;

  if(currentData.sparepart){

    try{

      const items = JSON.parse(currentData.sparepart);

      items.forEach(item=>{

        const harga = item.harga || 0;
        const qty = item.qty || 0;

        subtotal += harga * qty;

        body.push([
          item.nama || "-",
          qty,
          formatRupiah(harga)
        ]);

      });

    }catch(e){}
  }

  pdf.autoTable({

    startY: 148,

    margin:{
      left:20,
      right:20
    },

    head:[[
      "Jenis Perbaikan / Sparepart",
      "Qty",
      "Harga"
    ]],

    body: body,

    theme: "plain",

    styles:{
      fontSize:10,
      cellPadding:4,
      textColor:[60,60,60]
    },

    headStyles:{
      fillColor:[235,245,247],
      textColor:[40,40,40],
      fontStyle:"bold"
    },

    alternateRowStyles:{
      fillColor:[250,250,250]
    }

  });

  // ================= TOTAL =================

  let finalY = pdf.lastAutoTable.finalY + 8;

  const transport = Number(currentData.transport || 0);
  const jasa = Number(currentData.jasa || 0);
  const dibayar = Number(currentData.amount_paid || 0);

  const grand =
    subtotal +
    transport +
    jasa;

  const remaining = grand - dibayar;

  drawBox(110, finalY - 5, 80, 42);

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.setTextColor(90);

  pdf.text("Subtotal", 118, finalY + 4);
  pdf.text(formatRupiah(subtotal), 165, finalY + 4, {align:"right"});

  pdf.text("Transport", 118, finalY + 12);
  pdf.text(formatRupiah(transport), 165, finalY + 12, {align:"right"});

  pdf.text("Jasa", 118, finalY + 20);
  pdf.text(formatRupiah(jasa), 165, finalY + 20, {align:"right"});

  pdf.setDrawColor(220);
  pdf.line(118, finalY + 24, 182, finalY + 24);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(14);

  pdf.setTextColor(20,120,120);

  pdf.text("TOTAL", 118, finalY + 33);

  pdf.text(
    formatRupiah(grand),
    182,
    finalY + 33,
    {align:"right"}
  );

  pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

pdf.setTextColor(100);

if(remaining > 0){

  pdf.text(
    "Kurang Bayar : " + formatRupiah(remaining),
    118,
    finalY + 40
  );

}else if(remaining < 0){

  pdf.text(
    "Kembalian : " + formatRupiah(Math.abs(remaining)),
    118,
    finalY + 40
  );

}else{

  pdf.text(
    "Pembayaran Lunas",
    118,
    finalY + 40
  );

}

  // ================= GARANSI =================

let garansiY = finalY + 38;

drawBox(15, garansiY - 10, 175, 28);

pdf.setFont("helvetica","bold");
pdf.setFontSize(12);

pdf.setTextColor(20,120,120);

pdf.text("Masa Garansi", 20, garansiY);

pdf.setFont("helvetica","normal");
pdf.setFontSize(10);

pdf.setTextColor(70);

if(currentData.garansi){

  pdf.text(
    "Berlaku sampai: " +
    new Date(currentData.garansi)
      .toLocaleDateString("id-ID"),
    20,
    garansiY + 10
  );

}else{

  pdf.text(
    "Menyesuaikan jenis perbaikan",
    20,
    garansiY + 10
  );

}

  // ================= QR =================

const qrCanvas = document.querySelector("#qr canvas");

if(qrCanvas){

  const qrImage = qrCanvas.toDataURL("image/png");

  pdf.addImage(
    qrImage,
    "PNG",
    20,
    garansiY + 14,
    26,
    26
  );

  pdf.setFontSize(9);

  pdf.text(
    "Scan untuk Verifikasi",
    20,
    garansiY + 43
  );

}

  // ================= TTD =================

pdf.setFont("helvetica","normal");
pdf.setFontSize(10);

pdf.text(
  "Hormat Kami,",
  145,
  garansiY + 22
);

const sigBox = document.getElementById("ttdImg");

if(sigBox && sigBox.style.backgroundImage){

  const url = sigBox.style.backgroundImage
    .replace(/^url\(["']?/, '')
    .replace(/["']?\)$/, '');

  try{

    const img = await loadImage(url);

    pdf.addImage(
      img,
      "PNG",
      135,
      garansiY + 18,
      40,
      18
    );

  }catch(e){
    console.log("TTD gagal");
  }

}

pdf.setFont("helvetica","bold");

pdf.text(
  document.getElementById("ttdName").textContent,
  155,
  garansiY + 42,
  {align:"center"}
);

  // ================= SYARAT GARANSI =================

let syaratY = garansiY + 55;

drawBox(15, syaratY - 8, 175, 28);

pdf.setFont("helvetica","bold");
pdf.setFontSize(11);

pdf.setTextColor(20,120,120);

pdf.text(
  "Syarat & Ketentuan Garansi",
  20,
  syaratY
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

pdf.setTextColor(90);

const syarat = [
  "• Garansi hanya berlaku sesuai jenis perbaikan.",
  "• Garansi batal jika unit terkena air / benturan.",
  "• Segel rusak membatalkan garansi.",
  "• Nota wajib dibawa saat klaim garansi."
];

pdf.text(
  syarat,
  20,
  syaratY + 8
);

  // ================= SAVE =================

  pdf.save(`Invoice_${currentData.id}.pdf`);
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
