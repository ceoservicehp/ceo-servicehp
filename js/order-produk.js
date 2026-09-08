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
  const shippingType = inferShippingType(o, ship);
  const mapLink = (o.latitude != null && o.longitude != null)
    ? `https://www.google.com/maps?q=${encodeURIComponent(o.latitude)},${encodeURIComponent(o.longitude)}`
    : null;

  const paymentAction = buildPaymentAction(o, pay);
  const shippingAction = buildShippingAction(o, ship);
  const statusAction = buildStatusAction(o, ship);
  const proofPending = !!(pay?.proof_url && pay.payment_status === "pending");

  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  $("detailContent").innerHTML = `
    <div class="detail-body">
      <section class="order-overview">
        <div class="overview-main">
          <span class="overview-label">Status Pesanan</span>
          <div class="overview-title-row">
            <span class="pill ${orderBadge(o.order_status)} overview-pill">${esc(label(o.order_status))}</span>
            <span class="overview-date"><i class="fa-regular fa-clock"></i> ${fmtDate(o.created_at)}</span>
          </div>
          <p>${items.length} jenis produk · ${totalQty} unit · ${esc(shippingLabel(o, ship))}</p>
        </div>
        <div class="overview-total">
          <span>Total Pesanan</span>
          <strong>${rupiah(o.total)}</strong>
          <small class="${Number(o.remaining_amount || 0) > 0 ? 'text-danger' : 'text-success'}">
            ${Number(o.remaining_amount || 0) > 0 ? `Sisa ${rupiah(o.remaining_amount)}` : 'Pembayaran lunas'}
          </small>
        </div>
      </section>

      ${proofPending ? `
      <div class="attention-banner">
        <div class="attention-icon"><i class="fa-solid fa-receipt"></i></div>
        <div>
          <strong>Bukti pembayaran menunggu verifikasi</strong>
          <span>Periksa bukti transfer pelanggan sebelum menyetujui pembayaran.</span>
        </div>
        <button class="btn primary" id="viewProofTopBtn"><i class="fa-solid fa-eye"></i> Lihat Bukti</button>
      </div>` : ''}

      <div class="detail-grid refined-grid">
        <section class="info-card">
          <div class="card-title"><span class="card-icon"><i class="fa-solid fa-user"></i></span><div><h3>Data Pembeli</h3><small>Informasi pelanggan</small></div></div>
          <div class="info-list">
            <div class="info-row"><span>Nama</span><strong>${esc(o.customer_name || '-')}</strong></div>
            <div class="info-row"><span>WhatsApp</span><strong>${esc(o.customer_whatsapp || '-')}</strong></div>
            <div class="info-row"><span>Email</span><strong>${esc(o.customer_email || '-')}</strong></div>
            <div class="info-row info-row-block"><span>Alamat</span><strong>${esc(o.customer_address || '-')}</strong></div>
          </div>
          <div class="card-actions compact-actions">
            ${o.customer_whatsapp ? `<a class="btn soft" target="_blank" rel="noopener" href="https://wa.me/${esc(String(o.customer_whatsapp).replace(/[^0-9]/g,''))}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
            ${mapLink ? `<a class="btn soft" target="_blank" rel="noopener" href="${mapLink}"><i class="fa-solid fa-location-dot"></i> Lokasi</a>` : ''}
          </div>
          ${o.customer_note ? `<div class="note-box"><b><i class="fa-regular fa-note-sticky"></i> Catatan pelanggan</b><br>${esc(o.customer_note)}</div>` : ''}
        </section>

        <section class="info-card">
          <div class="card-title"><span class="card-icon"><i class="fa-solid fa-truck-fast"></i></span><div><h3>Pengiriman</h3><small>Metode dan progres pengiriman</small></div></div>
          <div class="info-list">
            <div class="info-row"><span>Jenis</span><strong>${esc(shippingLabel(o, ship))}</strong></div>
            <div class="info-row"><span>Kurir / Ekspedisi</span><strong>${esc(ship?.courier || '-')}</strong></div>
            <div class="info-row"><span>Nomor Resi</span><strong>${esc(ship?.tracking_number || '-')}</strong></div>
            <div class="info-row"><span>Status</span><span class="pill ${ship?.shipping_status === 'terkirim' ? 'ok' : ship?.shipping_status === 'gagal' ? 'danger' : 'info'}">${esc(label(ship?.shipping_status || 'belum_dikirim'))}</span></div>
            <div class="info-row"><span>Ongkir</span><strong>${rupiah(o.shipping_fee)}</strong></div>
          </div>
          ${shippingType !== 'pickup' && !ship?.tracking_number ? `<div class="mini-hint"><i class="fa-solid fa-circle-info"></i> Resi dapat ditambahkan dari bagian Tindakan Admin.</div>` : ''}
        </section>

        <section class="info-card product-info-card">
          <div class="card-title"><span class="card-icon"><i class="fa-solid fa-mobile-screen-button"></i></span><div><h3>Produk Dipesan</h3><small>${items.length} jenis produk · ${totalQty} unit</small></div></div>
          <div class="ordered-items">
            ${items.map((i, idx) => `
              <article class="ordered-item">
                <div class="item-number">${idx + 1}</div>
                <div class="item-main">
                  <strong>${esc(i.product_name || '-')}</strong>
                  <span>${esc(i.variant_name || 'Varian standar')}</span>
                  <small>${esc(i.color || '-')} · RAM ${esc(i.ram || '-')} · Storage ${esc(i.storage || '-')}</small>
                </div>
                <div class="item-price">
                  <small>${Number(i.quantity || 0)} × ${rupiah(i.unit_price)}</small>
                  <strong>${rupiah(i.subtotal)}</strong>
                </div>
              </article>`).join("") || '<div class="notice">Item tidak ditemukan.</div>'}
          </div>
        </section>

        <section class="info-card payment-info-card">
          <div class="card-title"><span class="card-icon"><i class="fa-solid fa-credit-card"></i></span><div><h3>Pembayaran</h3><small>Status dan bukti pembayaran</small></div></div>
          <div class="payment-status-box ${paymentBadge(o.payment_status)}-box">
            <div><span>Status Pembayaran</span><strong>${esc(label(o.payment_status))}</strong></div>
            <i class="fa-solid ${o.payment_status === 'lunas' ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>
          </div>
          <div class="info-list">
            <div class="info-row"><span>Metode</span><strong>${esc(label(o.payment_method))}</strong></div>
            <div class="info-row"><span>Status Transaksi</span><strong>${esc(label(pay?.payment_status || 'pending'))}</strong></div>
            <div class="info-row"><span>Sudah Dibayar</span><strong>${rupiah(o.amount_paid)}</strong></div>
            <div class="info-row"><span>Sisa</span><strong class="${Number(o.remaining_amount || 0) > 0 ? 'text-danger' : 'text-success'}">${rupiah(o.remaining_amount)}</strong></div>
          </div>
          ${pay?.proof_url ? `<button class="btn primary full proof-button" id="viewProofBtn"><i class="fa-solid fa-receipt"></i> Lihat Bukti Pembayaran</button>` : '<div class="notice"><i class="fa-regular fa-image"></i> Belum ada bukti pembayaran.</div>'}
        </section>
      </div>

      <section class="cost-summary-card">
        <div class="cost-summary-header">
          <div>
            <span class="section-label"><i class="fa-solid fa-receipt"></i> RINGKASAN PEMBAYARAN</span>
            <h3>Rincian Biaya Pesanan</h3>
            <p>Rincian nilai produk, ongkir, pembayaran masuk, dan sisa tagihan.</p>
          </div>
          <div class="cost-payment-badge ${Number(o.remaining_amount || 0) > 0 ? 'unpaid' : 'paid'}">
            <i class="fa-solid ${Number(o.remaining_amount || 0) > 0 ? 'fa-clock' : 'fa-circle-check'}"></i>
            <span>${Number(o.remaining_amount || 0) > 0 ? 'Belum Lunas' : 'Lunas'}</span>
          </div>
        </div>

        <div class="cost-summary-grid">
          <div class="cost-breakdown">
            <div class="cost-breakdown-title">Rincian Pesanan</div>
            <div class="cost-row">
              <span><i class="fa-solid fa-box"></i> Subtotal Produk</span>
              <strong>${rupiah(o.subtotal)}</strong>
            </div>
            <div class="cost-row">
              <span><i class="fa-solid fa-tag"></i> Diskon</span>
              <strong class="${Number(o.discount || 0) > 0 ? 'discount-value' : ''}">${Number(o.discount || 0) > 0 ? `- ${rupiah(o.discount)}` : rupiah(0)}</strong>
            </div>
            <div class="cost-row">
              <span><i class="fa-solid fa-truck-fast"></i> Ongkir</span>
              <strong>${rupiah(o.shipping_fee)}</strong>
            </div>
            <div class="cost-calculation">
              <span>Subtotal - Diskon + Ongkir</span>
              <strong>${rupiah(o.total)}</strong>
            </div>
          </div>

          <div class="grand-total-panel">
            <div class="grand-total-top">
              <span>Total Pesanan</span>
              <strong>${rupiah(o.total)}</strong>
            </div>
            <div class="payment-progress-list">
              <div>
                <span>Sudah Dibayar</span>
                <strong class="text-success">${rupiah(o.amount_paid)}</strong>
              </div>
              <div class="payment-remaining ${Number(o.remaining_amount || 0) > 0 ? 'has-balance' : 'is-paid'}">
                <span>Sisa Pembayaran</span>
                <strong>${rupiah(o.remaining_amount)}</strong>
              </div>
            </div>
            <div class="payment-method-note">
              <i class="fa-solid fa-wallet"></i>
              <span>Metode: <b>${esc(label(o.payment_method))}</b></span>
            </div>
          </div>
        </div>
      </section>

      <section class="admin-box admin-box-refined">
        <div class="admin-heading">
          <div><span class="section-label"><i class="fa-solid fa-shield-halved"></i> PANEL ADMIN</span><h3>Tindakan Admin</h3><p>Verifikasi pembayaran, atur ongkir dan kurir, lalu perbarui status pesanan.</p></div>
        </div>
        <div class="admin-actions-grid">
          ${paymentAction}
          ${shippingAction}
          ${statusAction}
        </div>
      </section>
    </div>`;

  if(pay?.proof_url){
    const proofHandler = () => viewProof(pay.proof_url);
    if($("viewProofBtn")) $("viewProofBtn").onclick = proofHandler;
    if($("viewProofTopBtn")) $("viewProofTopBtn").onclick = proofHandler;
  }

  bindAdminActions(o, pay, ship);
  $("detailModal").classList.add("show");
  $("detailModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
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
  document.body.classList.remove("modal-open");
}
