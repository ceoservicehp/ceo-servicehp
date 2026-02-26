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

  const id = getId();
  if(!id) return;

  const { data, error } = await client
    .from("service_orders")
    .select("*")
    .eq("id", id)
    .single();

  if(error || !data) return;

  currentData = data;

  /* ================= HEADER ================= */

  document.getElementById("inv-number").textContent =
    "INV-"+String(data.id).padStart(5,"0");

  document.getElementById("inv-date").textContent =
    new Date(data.created_at).toLocaleString("id-ID");

  document.getElementById("c-name").textContent = data.nama || "-";
  document.getElementById("c-phone").textContent = data.phone || "-";
  document.getElementById("c-metode").textContent = data.metode || "-";

  /* ================= SERVICE INFO ================= */

  const serviceStatusEl = document.getElementById("service-status");
  const createdEl = document.getElementById("service-created");
  const finishedEl = document.getElementById("service-finished");
  const paymentStatusEl = document.getElementById("payment-status");

  if(serviceStatusEl)
    serviceStatusEl.textContent = data.status || "-";

  if(createdEl)
    createdEl.textContent =
      new Date(data.created_at).toLocaleString("id-ID");

  if(finishedEl)
    finishedEl.textContent =
      data.tanggal_selesai
        ? new Date(data.tanggal_selesai).toLocaleString("id-ID")
        : "-";

  if(paymentStatusEl){
    paymentStatusEl.textContent =
      data.payment_status || "Belum Lunas";

    if((data.payment_status || "").toLowerCase().includes("lunas")){
      paymentStatusEl.classList.add("paid");
    }else{
      paymentStatusEl.classList.add("unpaid");
    }
  }

  /* ================= TOP (Tempo) ================= */

  if(data.use_top && data.due_date){
    const topSection = document.getElementById("top-section");
    const topInfo = document.getElementById("top-info");

    if(topSection) topSection.style.display = "block";

    if(topInfo)
      topInfo.textContent =
        `${data.top_days || 0} Hari (Jatuh Tempo: ${
          new Date(data.due_date).toLocaleDateString("id-ID")
        })`;
  }

  /* ================= ITEMS ================= */

  const tbody = document.getElementById("invoice-items");
  if(!tbody) return;

  tbody.innerHTML = "";

  let subtotal = 0;

  if(data.sparepart){
    try{
      const items = JSON.parse(data.sparepart);

      items.forEach((item, index)=>{
        const total = (item.harga || 0) * (item.qty || 0);
        subtotal += total;

        tbody.innerHTML += `
          <tr>
            <td>${index + 1}</td>
            <td>${item.nama}</td>
            <td>${item.qty}</td>
            <td>${rupiah(item.harga)}</td>
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

  /* ================= WATERMARK ================= */

  const wm = document.getElementById("watermark");

  if(wm){
    if(data.payment_status === "Lunas"){
      wm.textContent = "LUNAS";
      wm.style.color = "rgba(0,150,0,0.15)";
    }else{
      wm.textContent = "BELUM LUNAS";
      wm.style.color = "rgba(200,0,0,0.15)";
    }
  }

  /* ================= QR VERIFICATION ================= */

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

  /* ================= LOAD SIGNATURE ================= */
  await loadSignature();

});


/* ================= LOAD SIGNATURE (PUBLIC SAFE) ================= */
async function loadSignature(){

  if(!currentData?.approved_by) return;

  const { data, error } = await client
    .from("profiles")
    .select("signature_url, full_name")
    .eq("id", currentData.approved_by)
    .maybeSingle();

  if(error){
    console.log("Signature error:", error);
    return;
  }

  const sigBox = document.getElementById("ttdImg");
  const nameEl = document.getElementById("ttdName");

  if(data?.signature_url && sigBox){
    sigBox.style.backgroundImage = `url(${data.signature_url})`;
  }

  if(data?.full_name && nameEl){
    nameEl.innerText = data.full_name;
  }
}

/* ================= DOWNLOAD PDF ================= */
function downloadPDF(){

  if(!currentData) return;

  const element = document.querySelector(".invoice");

  document.body.classList.add("pdf-body");
  element.classList.add("pdf-mode");

  const opt = {
    margin: 0,
    filename: "Invoice_"+currentData.id+".pdf",
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { 
      scale: 3,
      backgroundColor:"#ffffff",
      useCORS:true
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(()=>{
    element.classList.remove("pdf-mode");
    document.body.classList.remove("pdf-body");
  });
}


/* ================= WHATSAPP ================= */
function sendWhatsApp(){

  if(!currentData) return;

  const url = window.location.href;

  const total =
    (currentData.total_sparepart || 0) +
    (currentData.transport || 0) +
    (currentData.jasa || 0);

  let msg =
`📄 *INVOICE SERVICE HP*%0A
Nama: ${currentData.nama}%0A
Status Service: ${currentData.status}%0A
Status Pembayaran: ${currentData.payment_status || "Belum Lunas"}%0A
Lihat Invoice:%0A${url}`;

  window.open(`https://wa.me/${currentData.phone}?text=${msg}`);
}
