"use strict";

const client = window.supabaseClient;
let currentData = null;
let currentShipment = null;
let currentPayment = null;

function $(id){ return document.getElementById(id); }
function rupiah(n){ return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
function getId(){ return new URLSearchParams(window.location.search).get("id"); }
function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}
function label(value){
  if(!value) return "-";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}
function formatDate(value){
  if(!value) return "-";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}
function latest(arr){
  return [...(arr || [])].sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
}
function shippingName(order, shipment){
  if(order.shipping_method === "pickup") return "Ambil di Toko";
  if(order.payment_method === "cod") return "COD";
  const courier = String(shipment?.courier || "").trim();
  if(/gojek|grab|gosend|grabexpress|instant/i.test(courier)) return courier ? `Kurir Instan (${courier})` : "Kurir Instan";
  return courier ? `Kirim Paket (${courier})` : "Pengiriman";
}
function setText(id, value){ const el = $(id); if(el) el.textContent = value ?? "-"; }

async function init(){
  const id = Number(getId());
  if(!id){ showError("ID order tidak valid."); return; }

  const { data, error } = await client
    .from("orders")
    .select(`
      *,
      order_items(*,order_item_units(*)),
      order_payments(*),
      order_shipments(*)
    `)
    .eq("id", id)
    .single();

  if(error || !data){
    console.error("Gagal load invoice produk:", error);
    showError("Invoice tidak dapat dimuat. Pastikan data order tersedia dan Anda memiliki akses.");
    return;
  }

  currentData = data;
  currentShipment = latest(data.order_shipments);
  currentPayment = latest(data.order_payments);

  renderInvoice(data);
  await loadSignature();
  renderQR();
}

function renderInvoice(data){
  const shipment = currentShipment;
  const items = data.order_items || [];

  setText("inv-number", data.order_number || `CEO-ORD-${String(data.id).padStart(6,"0")}`);
  setText("inv-date", formatDate(data.created_at));

  setText("c-name", data.customer_name || "-");
  setText("c-phone", data.customer_whatsapp || "-");
  setText("c-email", data.customer_email || "-");
  setText("c-address", data.customer_address || "-");
  setText("c-shipping", shippingName(data, shipment));
  setText("c-payment-method", label(data.payment_method));

  setText("order-status", label(data.order_status));
  setText("order-created", formatDate(data.created_at));
  setText("shipping-status", label(shipment?.shipping_status || (data.shipping_method === "pickup" ? "ambil_di_toko" : "belum_dikirim")));
  setText("shipping-courier", data.shipping_method === "pickup" ? "-" : (shipment?.courier || "-") );
  setText("shipping-tracking", shipment?.tracking_number || "-");

  const paymentStatusEl = $("payment-status");
  const paymentStatus = String(data.payment_status || "belum_bayar").toLowerCase();
  paymentStatusEl.textContent = label(paymentStatus);
  paymentStatusEl.classList.remove("paid", "unpaid", "partial");
  if(paymentStatus === "lunas") paymentStatusEl.classList.add("paid");
  else if(paymentStatus === "dp" || paymentStatus === "sebagian") paymentStatusEl.classList.add("partial");
  else paymentStatusEl.classList.add("unpaid");

  renderItems(items);
  renderSummary(data);
  renderUnits(items);
  renderPaymentState(data);

  $("invoice-loading").style.display = "none";
  $("invoice-content").style.display = "block";
}

function renderItems(items){
  const body = $("invoice-items");
  body.innerHTML = "";

  if(!items.length){
    body.innerHTML = `<tr><td colspan="5" class="empty-cell">Tidak ada detail produk.</td></tr>`;
    return;
  }

  body.innerHTML = items.map(item => {
    const variantBits = [item.variant_name, item.ram ? `RAM ${item.ram}` : "", item.storage, item.color]
      .filter(Boolean);
    const units = item.order_item_units || [];
    const unitHtml = units.length
      ? units.map((u,index) => `
          <div class="unit-line">
            <b>Unit ${index + 1}</b><br>
            IMEI 1: ${esc(u.imei1 || "-")}
            ${u.imei2 ? `<br>IMEI 2: ${esc(u.imei2)}` : ""}
            ${u.serial_number ? `<br>SN: ${esc(u.serial_number)}` : ""}
          </div>`).join("")
      : `<span class="muted-text">IMEI belum ditetapkan</span>`;

    return `
      <tr>
        <td>
          <strong>${esc(item.product_name || "Produk")}</strong>
          <div class="variant-text">${esc(variantBits.join(" · ") || "-")}</div>
        </td>
        <td>${unitHtml}</td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${rupiah(item.unit_price)}</td>
        <td><strong>${rupiah(item.subtotal)}</strong></td>
      </tr>
    `;
  }).join("");
}

function renderSummary(data){
  const subtotal = Number(data.subtotal || 0);
  const discount = Number(data.discount || 0);
  const shipping = Number(data.shipping_fee || 0);
  const total = Number(data.total || Math.max(subtotal - discount, 0) + shipping);
  const paid = Number(data.amount_paid || 0);
  const remaining = Number(data.remaining_amount ?? Math.max(total - paid, 0));

  setText("sub-total", rupiah(subtotal));
  setText("discount-total", discount > 0 ? `- ${rupiah(discount)}` : rupiah(0));
  setText("shipping-total", rupiah(shipping));
  setText("paid-total", rupiah(paid));
  setText("grand-total", rupiah(total));

  const remainingRow = $("row-remaining");
  const remainingEl = $("remaining-total");
  if(remaining > 0){
    remainingRow.style.display = "flex";
    remainingRow.querySelector("span").textContent = "Kurang Bayar";
    remainingEl.textContent = "- " + rupiah(remaining);
  }else if(paid > total){
    remainingRow.style.display = "flex";
    remainingRow.querySelector("span").textContent = "Kembalian";
    remainingEl.textContent = rupiah(paid - total);
  }else{
    remainingRow.style.display = "none";
  }

  if(discount === 0) $("row-discount").style.display = "none";
  if(shipping === 0 && data.shipping_method === "pickup") $("row-shipping").style.display = "none";
  if(paid === 0) $("row-paid").style.display = "none";
}

function renderUnits(items){
  const units = [];
  let expected = 0;

  items.forEach(item => {
    expected += Number(item.quantity || 0);
    (item.order_item_units || []).forEach((unit,index) => {
      units.push({ item, unit, index });
    });
  });

  const box = $("unitInfoBox");
  const content = $("unitInfoContent");

  if(!expected){
    box.style.display = "none";
    return;
  }

  box.style.display = "block";

  const rows = units.map(({item,unit,index}) => `
    <div class="unit-card">
      <div>
        <strong>${esc(item.product_name || "Produk")} — Unit ${index + 1}</strong>
        <span>${esc(item.variant_name || "-")}${item.color ? ` · ${esc(item.color)}` : ""}</span>
      </div>
      <div class="unit-code">
        <span>IMEI 1 <b>${esc(unit.imei1 || "-")}</b></span>
        ${unit.imei2 ? `<span>IMEI 2 <b>${esc(unit.imei2)}</b></span>` : ""}
        ${unit.serial_number ? `<span>Serial <b>${esc(unit.serial_number)}</b></span>` : ""}
      </div>
    </div>
  `).join("");

  const missing = Math.max(expected - units.length, 0);
  content.innerHTML = `
    ${rows || `<p class="muted-text">IMEI / unit fisik belum ditetapkan oleh admin.</p>`}
    ${missing > 0 ? `<div class="unit-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${missing} unit belum memiliki data IMEI/serial.</div>` : ""}
  `;
}

function renderPaymentState(data){
  const paymentStatus = String(data.payment_status || "belum_bayar").toLowerCase();
  const isPaid = paymentStatus === "lunas";
  const isTransfer = String(data.payment_method || "").toLowerCase() === "transfer";

  const pdfBtn = $("downloadPdfBtn");
  const rekeningBtn = $("rekeningBtn");

  pdfBtn.style.display = isPaid ? "inline-flex" : "none";
  rekeningBtn.style.display = (!isPaid && isTransfer) ? "inline-flex" : "none";

  const wm = $("watermark");
  const stamp = $("digital-stamp");
  wm.className = "watermark";
  stamp.className = "digital-stamp";

  if(isPaid){
    wm.textContent = "LUNAS";
    wm.classList.add("wm-paid");
    stamp.textContent = "✔ LUNAS";
    stamp.classList.add("stamp-paid");
  }else if(paymentStatus === "sebagian" || paymentStatus === "dp"){
    wm.textContent = "SEBAGIAN";
    wm.classList.add("wm-partial");
    stamp.textContent = "PEMBAYARAN SEBAGIAN";
    stamp.classList.add("stamp-partial");
  }else{
    wm.textContent = "BELUM LUNAS";
    wm.classList.add("wm-unpaid");
    stamp.textContent = "BELUM LUNAS";
    stamp.classList.add("stamp-unpaid");
  }
}

function renderQR(){
  const qr = $("qr");
  if(!qr || !window.QRCode) return;
  qr.innerHTML = "";
  const invoiceUrl = `${window.location.origin}/nota-produk.html?id=${encodeURIComponent(currentData.id)}`;
  QRCode.toCanvas(document.createElement("canvas"), invoiceUrl, { width: 130, margin: 1 }, (err, canvas) => {
    if(!err) qr.appendChild(canvas);
  });
}

async function loadSignature(){
  const sigBox = $("ttdImg");
  const nameEl = $("ttdName");
  if(!sigBox || !nameEl) return;

  // Gunakan admin yang terakhir memverifikasi pembayaran bila tersedia.
  const paidPayments = [...(currentData?.order_payments || [])]
    .filter(p => p.payment_status === "paid" && p.created_by)
    .sort((a,b) => new Date(b.paid_at || b.created_at || 0) - new Date(a.paid_at || a.created_at || 0));

  const adminId = paidPayments[0]?.created_by || null;
  if(!adminId) return;

  const { data, error } = await client
    .from("profiles")
    .select("signature_url, full_name")
    .eq("id", adminId)
    .maybeSingle();

  if(error || !data){
    console.log("Signature invoice produk:", error?.message || "Profile tidak ditemukan");
    return;
  }

  if(data.full_name) nameEl.textContent = data.full_name;
  if(!data.signature_url) return;

  let imageUrl = data.signature_url;
  if(!imageUrl.startsWith("http")){
    const { data: publicUrlData } = client.storage.from("signature_url").getPublicUrl(imageUrl);
    imageUrl = publicUrlData?.publicUrl || "";
  }

  if(imageUrl){
    sigBox.style.backgroundImage = `url("${imageUrl}")`;
    sigBox.style.backgroundSize = "contain";
    sigBox.style.backgroundRepeat = "no-repeat";
    sigBox.style.backgroundPosition = "center";
  }
}

function showError(message){
  const loading = $("invoice-loading");
  loading.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${esc(message)}`;
  loading.classList.add("error");
}

function showRekening(){
  const rekening = "5855369360";
  const html = `
    <div id="rekeningModal" class="rekening-modal">
      <div class="rekening-box">
        <h3>Informasi Pembayaran</h3>
        <p class="bank-name">BANK BCA</p>
        <div class="rekening-number">${rekening}</div>
        <p>a.n <strong>IKMAL FALAHI</strong></p>
        <button class="copy-btn" onclick="copyRekening('${rekening}')">
          <i class="fa-solid fa-copy"></i> Copy Nomor Rekening
        </button>
        <button class="close-btn" onclick="closeRekeningModal()">Tutup</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

function copyRekening(rekening){
  navigator.clipboard.writeText(rekening).then(() => alert("Nomor rekening berhasil disalin"));
}

function closeRekeningModal(){
  $("rekeningModal")?.remove();
}

async function downloadPDF(){
  if(!currentData) return;

  const invoice = $("invoice-area");
  const pdfBtn = $("downloadPdfBtn");
  const originalText = pdfBtn.innerHTML;

  try{
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat PDF...`;

    document.body.classList.add("pdf-body");
    await new Promise(resolve => setTimeout(resolve, 120));

    const canvas = await html2canvas(invoice, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.96);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 6;
    const usableWidth = pageWidth - (margin * 2);
    const imgHeight = canvas.height * usableWidth / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while(heightLeft > 0){
      pdf.addPage();
      position = margin - (imgHeight - heightLeft);
      pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    const fileName = `${currentData.order_number || `CEO-ORD-${currentData.id}`}.pdf`;
    pdf.save(fileName);
  }catch(error){
    console.error("Gagal membuat PDF:", error);
    alert("Gagal membuat PDF invoice. Silakan coba kembali.");
  }finally{
    document.body.classList.remove("pdf-body");
    pdfBtn.disabled = false;
    pdfBtn.innerHTML = originalText;
  }
}

window.showRekening = showRekening;
window.copyRekening = copyRekening;
window.closeRekeningModal = closeRekeningModal;
window.downloadPDF = downloadPDF;

document.addEventListener("DOMContentLoaded", init);
