"use strict";

const client = window.supabaseClient;
const PAGE_SIZE = 10;
let orders = [];
let filtered = [];
let page = 1;
let currentOrderId = null;

const $ = id => document.getElementById(id);
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate = v => v ? new Date(v).toLocaleString("id-ID", { dateStyle:"medium", timeStyle:"short" }) : "-";

const LABELS = {
  pickup:"Ambil di Toko", delivery:"Pengiriman",
  transfer:"Transfer Bank", cash:"Cash", cod:"COD", qris:"QRIS",
  belum_bayar:"Belum Bayar", dp:"DP", sebagian:"Sebagian", lunas:"Lunas", refund:"Refund",
  pending:"Pending", paid:"Dibayar", rejected:"Ditolak", refunded:"Refund",
  menunggu_diproses:"Menunggu Diproses", dikemas:"Dikemas", dikirim:"Dikirim",
  dalam_perjalanan:"Dalam Perjalanan", selesai:"Selesai", dibatalkan:"Dibatalkan", gagal_dikirim:"Gagal Dikirim",
  belum_dikirim:"Belum Dikirim", terkirim:"Terkirim", gagal:"Gagal"
};
const label = v => LABELS[v] || String(v || "-").replaceAll("_", " ");

function latest(arr){ return (arr || []).slice().sort((a,b)=>Number(b.id)-Number(a.id))[0] || null; }

function inferShippingType(order, shipment){
  if(order.shipping_method === "pickup") return "pickup";
  if(order.payment_method === "cod") return "cod";
  const courier = String(shipment?.courier || "").toLowerCase();
  if(/gojek|grab|instant|gosend|grabexpress/.test(courier)) return "instant";
  if(/jne|j&t|jnt|sicepat|anteraja|pos|tiki|ninja|lion|wahana/.test(courier)) return "package";
  return "delivery";
}

function shippingLabel(order, shipment){
  const t = inferShippingType(order, shipment);
  return ({pickup:"Ambil di Toko", instant:"Kurir Instan", package:"Kirim Paket", cod:"COD", delivery:"Pengiriman"})[t];
}

function paymentBadge(status){
  if(status === "lunas") return "ok";
  if(status === "sebagian" || status === "dp") return "info";
  if(status === "refund") return "muted";
  return "warn";
}

function orderBadge(status){
  if(status === "selesai") return "ok";
  if(status === "dibatalkan" || status === "gagal_dikirim") return "danger";
  if(status === "dikirim" || status === "dalam_perjalanan") return "info";
  return "warn";
}

document.addEventListener("DOMContentLoaded", () => {
  setup();
  loadOrders();
  $("year").textContent = new Date().getFullYear();
});

function setup(){
  $("refreshBtn").onclick = loadOrders;
  ["searchInput","paymentFilter","shippingFilter","statusFilter"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", () => { page = 1; applyFilters(); });
  });
  $("prevPage").onclick = () => { if(page > 1){ page--; render(); } };
  $("nextPage").onclick = () => { if(page < Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))){ page++; render(); } };
  $("closeModal").onclick = closeModal;
  $("detailModal").onclick = e => { if(e.target === $("detailModal")) closeModal(); };
  $("menuToggle").onclick = () => { $("topNav").classList.toggle("open"); $("navOverlay").classList.toggle("show"); };
  $("navOverlay").onclick = () => { $("topNav").classList.remove("open"); $("navOverlay").classList.remove("show"); };
}

async function loadOrders(){
  $("orderTableBody").innerHTML = '<tr><td colspan="8" class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat order...</td></tr>';
  const { data, error } = await client
    .from("orders")
    .select(`*,order_items(*),order_payments(*),order_shipments(*)`)
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    $("orderTableBody").innerHTML = `<tr><td colspan="8" class="empty error">Gagal memuat order: ${esc(error.message)}<br><small>Pastikan SQL Admin Order Tahap 2 sudah dijalankan.</small></td></tr>`;
    return;
  }
  orders = data || [];
  applyFilters();
  updateStats();
}

function applyFilters(){
  const q = $("searchInput").value.trim().toLowerCase();
  const pf = $("paymentFilter").value;
  const sf = $("shippingFilter").value;
  const st = $("statusFilter").value;

  filtered = orders.filter(o => {
    const itemText = (o.order_items || []).map(i => `${i.product_name} ${i.variant_name || ""} ${i.color || ""}`).join(" ");
    const hay = `${o.order_number || ""} ${o.customer_name || ""} ${o.customer_whatsapp || ""} ${itemText}`.toLowerCase();
    const ship = latest(o.order_shipments);
    const shippingType = inferShippingType(o, ship);
    return (!q || hay.includes(q)) &&
      (pf === "all" || o.payment_status === pf) &&
      (sf === "all" || shippingType === sf) &&
      (st === "all" || o.order_status === st);
  });
  render();
}

function updateStats(){
  $("statTotal").textContent = orders.length;
  $("statWaiting").textContent = orders.filter(o => o.order_status === "menunggu_diproses").length;
  $("statProof").textContent = orders.filter(o => (o.order_payments || []).some(p => p.proof_url && p.payment_status === "pending")).length;
  $("statUnpaid").textContent = orders.filter(o => o.payment_status !== "lunas").length;
}

function render(){
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(page > pages) page = pages;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $("pageInfo").textContent = `${page} / ${pages}`;
  $("prevPage").disabled = page <= 1;
  $("nextPage").disabled = page >= pages;

  if(!rows.length){
    $("orderTableBody").innerHTML = '<tr><td colspan="8" class="empty">Tidak ada order yang sesuai.</td></tr>';
    return;
  }

  $("orderTableBody").innerHTML = rows.map(o => {
    const item = (o.order_items || [])[0] || {};
    const pay = latest(o.order_payments);
    const ship = latest(o.order_shipments);
    const proofPending = !!(pay?.proof_url && pay.payment_status === "pending");
    return `<tr>
      <td><strong>${esc(o.order_number || `#${o.id}`)}</strong><small>${fmtDate(o.created_at)}</small></td>
      <td><strong>${esc(o.customer_name)}</strong><small>${esc(o.customer_whatsapp)}</small></td>
      <td>${esc(item.product_name || "-")}<small>${esc(item.variant_name || "")}${item.quantity ? ` ×${item.quantity}` : ""}</small></td>
      <td><span class="pill">${esc(shippingLabel(o, ship))}</span>${ship?.courier ? `<small>${esc(ship.courier)}</small>` : ""}</td>
      <td><span class="pill ${paymentBadge(o.payment_status)}">${esc(label(o.payment_status))}</span>${proofPending ? '<small class="proof"><i class="fa-solid fa-receipt"></i> Perlu verifikasi</small>' : ""}</td>
      <td><strong>${rupiah(o.total)}</strong>${o.remaining_amount > 0 ? `<small>Sisa ${rupiah(o.remaining_amount)}</small>` : ""}</td>
      <td><span class="pill ${orderBadge(o.order_status)}">${esc(label(o.order_status))}</span></td>
      <td><button class="btn primary detail-btn" data-id="${o.id}"><i class="fa-solid fa-eye"></i> Detail</button></td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".detail-btn").forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
}

async function openDetail(id){
  const o = orders.find(x => Number(x.id) === Number(id));
  if(!o) return;
  currentOrderId = o.id;
  $("detailOrderNumber").textContent = o.order_number || `Order #${o.id}`;

  const items = o.order_items || [];
  const pay = latest(o.order_payments);
  const ship = latest(o.order_shipments);
  const mapLink = (o.latitude != null && o.longitude != null)
    ? `https://www.google.com/maps?q=${encodeURIComponent(o.latitude)},${encodeURIComponent(o.longitude)}`
    : null;

  const paymentAction = buildPaymentAction(o, pay);
  const shippingAction = buildShippingAction(o, ship);
  const statusAction = buildStatusAction(o, ship);

  $("detailContent").innerHTML = `
    <div class="detail-grid">
      <section>
        <h3><i class="fa-solid fa-user"></i> Pembeli</h3>
        <p><b>${esc(o.customer_name)}</b><br>${esc(o.customer_whatsapp)}<br>${esc(o.customer_email || "-")}<br>${esc(o.customer_address || "-")}</p>
        ${mapLink ? `<a class="btn" target="_blank" rel="noopener" href="${mapLink}"><i class="fa-solid fa-location-dot"></i> Buka Titik Lokasi</a>` : ""}
        ${o.customer_note ? `<div class="note-box"><b>Catatan pelanggan</b><br>${esc(o.customer_note)}</div>` : ""}
      </section>

      <section>
        <h3><i class="fa-solid fa-mobile-screen"></i> Produk</h3>
        ${items.map(i => `<div class="item"><b>${esc(i.product_name)}</b><span>${esc(i.variant_name || "-")} · ${esc(i.color || "-")} · RAM ${esc(i.ram || "-")} · ${esc(i.storage || "-")}</span><span>${i.quantity} × ${rupiah(i.unit_price)} = <b>${rupiah(i.subtotal)}</b></span></div>`).join("") || '<div class="notice">Item tidak ditemukan.</div>'}
      </section>

      <section>
        <h3><i class="fa-solid fa-truck"></i> Pengiriman</h3>
        <p>Jenis: <b>${esc(shippingLabel(o, ship))}</b><br>Metode DB: ${esc(label(o.shipping_method))}<br>Kurir: ${esc(ship?.courier || "-")}<br>Resi: ${esc(ship?.tracking_number || "-")}<br>Status: <b>${esc(label(ship?.shipping_status || "belum_dikirim"))}</b><br>Ongkir: <b>${rupiah(o.shipping_fee)}</b></p>
      </section>

      <section>
        <h3><i class="fa-solid fa-credit-card"></i> Pembayaran</h3>
        <p>Metode: <b>${esc(label(o.payment_method))}</b><br>Status Order: <b>${esc(label(o.payment_status))}</b><br>Status Bukti: <b>${esc(label(pay?.payment_status || "pending"))}</b><br>Dibayar: ${rupiah(o.amount_paid)}<br>Sisa: ${rupiah(o.remaining_amount)}</p>
        ${pay?.proof_url ? `<button class="btn primary" id="viewProofBtn"><i class="fa-solid fa-receipt"></i> Lihat Bukti Transfer</button>` : '<div class="notice">Belum ada bukti transfer.</div>'}
      </section>
    </div>

    <section class="summary">
      <div><span>Subtotal</span><b>${rupiah(o.subtotal)}</b></div>
      <div><span>Diskon</span><b>- ${rupiah(o.discount)}</b></div>
      <div><span>Ongkir</span><b>${rupiah(o.shipping_fee)}</b></div>
      <div class="grand"><span>Total</span><b>${rupiah(o.total)}</b></div>
      <div><span>Dibayar</span><b>${rupiah(o.amount_paid)}</b></div>
      <div><span>Sisa</span><b>${rupiah(o.remaining_amount)}</b></div>
    </section>

    <section class="admin-box">
      <h3><i class="fa-solid fa-screwdriver-wrench"></i> Tindakan Admin</h3>
      <div class="admin-actions-grid">
        ${paymentAction}
        ${shippingAction}
        ${statusAction}
      </div>
    </section>`;

  if(pay?.proof_url) $("viewProofBtn").onclick = () => viewProof(pay.proof_url);
  bindAdminActions(o, pay, ship);
  $("detailModal").classList.add("show");
  $("detailModal").setAttribute("aria-hidden", "false");
}

function buildPaymentAction(o, pay){
  if(!pay) return `<div class="action-card"><h4>Pembayaran</h4><div class="notice">Data pembayaran belum ditemukan.</div></div>`;

  if(pay.payment_status === "paid"){
    return `<div class="action-card"><h4><i class="fa-solid fa-circle-check"></i> Pembayaran Terverifikasi</h4><p>Nominal pembayaran ini: <b>${rupiah(pay.amount)}</b><br>Waktu: ${fmtDate(pay.paid_at)}</p></div>`;
  }

  if(pay.payment_status === "rejected"){
    return `<div class="action-card"><h4><i class="fa-solid fa-circle-xmark"></i> Pembayaran Ditolak</h4><p>${esc(pay.note || "Bukti/pembayaran ditolak.")}</p></div>`;
  }

  const canApproveTransfer = o.payment_method !== "transfer" || !!pay.proof_url;
  return `<div class="action-card">
    <h4><i class="fa-solid fa-money-check-dollar"></i> Verifikasi Pembayaran</h4>
    <label>Nominal yang diterima</label>
    <input id="paymentAmount" inputmode="numeric" value="${Number(o.remaining_amount || o.total || 0)}">
    <label>Catatan admin</label>
    <textarea id="paymentNote" rows="2" placeholder="Opsional"></textarea>
    <div class="action-row">
      <button class="btn success" id="approvePaymentBtn" ${canApproveTransfer ? "" : "disabled"}><i class="fa-solid fa-check"></i> Setujui</button>
      <button class="btn danger" id="rejectPaymentBtn"><i class="fa-solid fa-xmark"></i> Tolak</button>
    </div>
    ${!canApproveTransfer ? '<small class="helper">Transfer belum dapat disetujui karena bukti belum ada.</small>' : ""}
  </div>`;
}

function buildShippingAction(o, ship){
  if(o.shipping_method === "pickup"){
    return `<div class="action-card"><h4><i class="fa-solid fa-store"></i> Ambil di Toko</h4><p>Ongkir tetap <b>Rp 0</b>. Tidak perlu konfirmasi ongkir.</p></div>`;
  }

  return `<div class="action-card">
    <h4><i class="fa-solid fa-truck-fast"></i> Ongkir & Kurir</h4>
    <label>Nama kurir / ekspedisi</label>
    <input id="shippingCourier" value="${esc(ship?.courier || "")}" placeholder="Gojek, Grab, JNE, J&T, dll.">
    <label>Ongkir final</label>
    <input id="shippingFee" inputmode="numeric" value="${Number(o.shipping_fee || 0)}">
    <button class="btn primary full" id="saveShippingBtn"><i class="fa-solid fa-floppy-disk"></i> Simpan Ongkir</button>
    <small class="helper">Total dan sisa pembayaran dihitung ulang otomatis.</small>
  </div>`;
}

function buildStatusAction(o, ship){
  return `<div class="action-card">
    <h4><i class="fa-solid fa-route"></i> Status Order</h4>
    <label>Status order</label>
    <select id="adminOrderStatus">
      ${["menunggu_diproses","dikemas","dikirim","dalam_perjalanan","selesai","dibatalkan","gagal_dikirim"].map(v=>`<option value="${v}" ${o.order_status===v?"selected":""}>${esc(label(v))}</option>`).join("")}
    </select>
    <label>Status pengiriman</label>
    <select id="adminShippingStatus">
      ${["belum_dikirim","dikemas","dikirim","dalam_perjalanan","terkirim","gagal"].map(v=>`<option value="${v}" ${(ship?.shipping_status||"belum_dikirim")===v?"selected":""}>${esc(label(v))}</option>`).join("")}
    </select>
    <label>Nomor resi</label>
    <input id="trackingNumber" value="${esc(ship?.tracking_number || "")}" placeholder="Opsional">
    <label>Catatan admin</label>
    <textarea id="adminNote" rows="2" placeholder="Opsional">${esc(o.admin_note || "")}</textarea>
    <button class="btn primary full" id="saveStatusBtn"><i class="fa-solid fa-floppy-disk"></i> Simpan Status</button>
  </div>`;
}

function numericValue(id){
  return Number(String($(id)?.value || "0").replace(/[^0-9]/g, "")) || 0;
}

function setBusy(button, busy, text){
  if(!button) return;
  if(busy){
    button.dataset.oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(text)}`;
  } else {
    button.disabled = false;
    if(button.dataset.oldHtml) button.innerHTML = button.dataset.oldHtml;
  }
}

function bindAdminActions(o, pay, ship){
  const approveBtn = $("approvePaymentBtn");
  const rejectBtn = $("rejectPaymentBtn");
  const shippingBtn = $("saveShippingBtn");
  const statusBtn = $("saveStatusBtn");

  if(approveBtn) approveBtn.onclick = async () => {
    const amount = numericValue("paymentAmount");
    if(amount <= 0) return alert("Nominal pembayaran harus lebih dari 0.");
    if(!confirm(`Setujui pembayaran sebesar ${rupiah(amount)} untuk ${o.order_number}?`)) return;
    setBusy(approveBtn, true, "Memproses...");
    const { error } = await client.rpc("admin_review_product_payment", {
      p_order_id:o.id,
      p_payment_id:pay.id,
      p_action:"approve",
      p_amount:amount,
      p_note:$("paymentNote")?.value.trim() || null
    });
    if(error){ console.error(error); alert("Gagal verifikasi pembayaran: " + error.message); setBusy(approveBtn,false); return; }
    alert("Pembayaran berhasil diverifikasi ✅");
    await reloadAndReopen(o.id);
  };

  if(rejectBtn) rejectBtn.onclick = async () => {
    const note = $("paymentNote")?.value.trim() || "Bukti/pembayaran ditolak admin.";
    if(!confirm(`Tolak pembayaran untuk ${o.order_number}?`)) return;
    setBusy(rejectBtn, true, "Memproses...");
    const { error } = await client.rpc("admin_review_product_payment", {
      p_order_id:o.id,
      p_payment_id:pay.id,
      p_action:"reject",
      p_amount:null,
      p_note:note
    });
    if(error){ console.error(error); alert("Gagal menolak pembayaran: " + error.message); setBusy(rejectBtn,false); return; }
    alert("Pembayaran ditolak.");
    await reloadAndReopen(o.id);
  };

  if(shippingBtn) shippingBtn.onclick = async () => {
    const fee = numericValue("shippingFee");
    const courier = $("shippingCourier")?.value.trim() || null;
    if(!confirm(`Simpan ongkir ${rupiah(fee)} untuk ${o.order_number}?`)) return;
    setBusy(shippingBtn, true, "Menyimpan...");
    const { error } = await client.rpc("admin_set_product_shipping_fee", {
      p_order_id:o.id,
      p_shipping_fee:fee,
      p_courier:courier
    });
    if(error){ console.error(error); alert("Gagal menyimpan ongkir: " + error.message); setBusy(shippingBtn,false); return; }
    alert("Ongkir dan total berhasil diperbarui ✅");
    await reloadAndReopen(o.id);
  };

  if(statusBtn) statusBtn.onclick = async () => {
    const orderStatus = $("adminOrderStatus").value;
    const shippingStatus = $("adminShippingStatus").value;
    const tracking = $("trackingNumber").value.trim() || null;
    const courier = $("shippingCourier")?.value.trim() || ship?.courier || null;
    const adminNote = $("adminNote").value.trim() || null;
    setBusy(statusBtn, true, "Menyimpan...");
    const { error } = await client.rpc("admin_update_product_order_status", {
      p_order_id:o.id,
      p_order_status:orderStatus,
      p_shipping_status:shippingStatus,
      p_tracking_number:tracking,
      p_courier:courier,
      p_admin_note:adminNote
    });
    if(error){ console.error(error); alert("Gagal menyimpan status: " + error.message); setBusy(statusBtn,false); return; }
    alert("Status order berhasil diperbarui ✅");
    await reloadAndReopen(o.id);
  };
}

async function reloadAndReopen(orderId){
  closeModal();
  await loadOrders();
  openDetail(orderId);
}

async function viewProof(path){
  const { data, error } = await client.storage.from("bukti-pembayaran-produk").createSignedUrl(path, 300);
  if(error){ alert("Gagal membuka bukti: " + error.message); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

function closeModal(){
  currentOrderId = null;
  $("detailModal").classList.remove("show");
  $("detailModal").setAttribute("aria-hidden", "true");
}
