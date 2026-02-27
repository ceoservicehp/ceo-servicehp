"use strict";

const client = window.supabaseClient;

function rupiah(n){
  return "Rp " + Number(n||0).toLocaleString("id-ID");
}

function getId(){
  return new URLSearchParams(window.location.search).get("id");
}

let currentData = null;

/* ================= LOAD DATA ================= */
document.addEventListener("DOMContentLoaded", async ()=>{
  onst toggleBtn = document.getElementById("problemToggle");
  const content = document.getElementById("problemContent");
  const icon = toggleBtn?.querySelector("i");

  toggleBtn?.addEventListener("click", () => {
    content.classList.toggle("active");

    // putar icon
    icon?.classList.toggle("rotate");
  });
});

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

  /* ================= SERVICE INFO ================= */

  document.getElementById("service-status").textContent = data.status || "-";

  document.getElementById("service-created").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("service-finished").textContent =
    data.tanggal_selesai
      ? new Date(data.tanggal_selesai).toLocaleString("id-ID")
      : "-";

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

  /* ================= ITEMS ACCORDION ================= */

  const container = document.getElementById("invoice-items");
  container.innerHTML = "";

  let subtotal = 0;

  if(data.sparepart){
    try{
      const items = JSON.parse(data.sparepart);

      items.forEach((item, index)=>{
        const total = (item.harga || 0) * (item.qty || 0);
        subtotal += total;

        container.innerHTML += `
          <div class="accordion-item">
            <div class="acc-header" onclick="toggleAcc(this)">
              <span>${index+1}. ${item.nama}</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="acc-body">
              <div>Qty : ${item.qty}</div>
              <div>Harga : ${rupiah(item.harga)}</div>
              <div>Total : ${rupiah(total)}</div>
            </div>
          </div>
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

});

/* ================= ACCORDION TOGGLE ================= */
function toggleAcc(el){
  const body = el.nextElementSibling;
  body.classList.toggle("open");
}

/* ================= LOAD SIGNATURE (BUCKET: signature_url) ================= */
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

  /* ================= SET NAMA ================= */
  if(data.full_name && nameEl){
    nameEl.textContent = data.full_name;
  }

  /* ================= SET TTD IMAGE ================= */
  if(data.signature_url && sigBox){

    let imageUrl = data.signature_url;

    // Kalau bukan full URL (masih path file saja)
    if(!imageUrl.startsWith("http")){
      const { data: publicUrlData } = client
        .storage
        .from("signature_url") // ← sesuai bucket kamu
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

  const element = document.querySelector(".invoice");

  const opt = {
    margin: 0,
    filename: "Invoice_"+currentData.id+".pdf",
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 3, backgroundColor:"#ffffff", useCORS:true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

/* ================= WHATSAPP ================= */
function sendWhatsApp(){

  if(!currentData) return;

  const url = window.location.href;

  let msg =
`📄 *INVOICE SERVICE HP*%0A
Nama: ${currentData.nama}%0A
Status Service: ${currentData.status}%0A
Status Pembayaran: ${currentData.payment_status || "Belum Lunas"}%0A
%0A🔧 *Syarat Garansi:*%0A
- Garansi 7 Hari%0A
- Tidak berlaku jika segel rusak%0A
- Tidak berlaku jika terkena air%0A
%0ALihat Invoice:%0A${url}`;

  window.open(`https://wa.me/${currentData.phone}?text=${msg}`);
}
