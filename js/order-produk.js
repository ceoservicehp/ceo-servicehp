"use strict";

const client = window.supabaseClient;
let pageSize = 10;
let activeStatFilter = "all";
let orders = [];
let filtered = [];
let page = 1;
let currentOrderId = null;
let currentUserRole = null;
let selectedOrderIds = new Set();

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

function sortNewest(arr){
  return (arr || []).slice().sort((a,b) => {
    const ad = new Date(a?.paid_at || a?.created_at || 0).getTime();
    const bd = new Date(b?.paid_at || b?.created_at || 0).getTime();
    if(ad !== bd) return bd - ad;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}

function countAssignedUnits(order){
  return (order?.order_items || []).reduce((sum,item)=>sum+(item?.order_item_units || []).length,0);
}

function countRequiredUnits(order){
  return (order?.order_items || []).reduce((sum,item)=>sum+Number(item?.quantity || 0),0);
}

function getOperationalReadiness(order){
  const ship = latest(order?.order_shipments);
  const shippingType = inferShippingType(order, ship);
  const requiredUnits = countRequiredUnits(order);
  const assignedUnits = countAssignedUnits(order);
  const imeiReady = requiredUnits === 0 || assignedUnits >= requiredUnits;
  const paymentReady = order?.payment_status === 'lunas';
  const shippingFeeReady = shippingType === 'pickup' || shippingType === 'cod' || Number(order?.shipping_fee || 0) > 0;
  const courierReady = shippingType === 'pickup' || !!String(ship?.courier || '').trim();
  const trackingReady = !['package'].includes(shippingType) || !!String(ship?.tracking_number || '').trim();
  return {shippingType, requiredUnits, assignedUnits, imeiReady, paymentReady, shippingFeeReady, courierReady, trackingReady};
}

function buildReadinessPanel(order){
  const r = getOperationalReadiness(order);
  const checks = [
    {ok:r.paymentReady, icon:'fa-wallet', label:'Pembayaran', text:r.paymentReady ? 'Lunas' : `Sisa ${rupiah(order.remaining_amount)}`},
    {ok:r.shippingFeeReady, icon:'fa-truck-fast', label:'Ongkir', text:r.shippingFeeReady ? (r.shippingType==='pickup' ? 'Pickup / Rp 0' : rupiah(order.shipping_fee)) : 'Belum ditetapkan'},
    {ok:r.imeiReady, icon:'fa-barcode', label:'IMEI / Unit', text:`${r.assignedUnits} / ${r.requiredUnits} unit`},
    {ok:r.courierReady, icon:'fa-box', label:'Kurir', text:r.courierReady ? (latest(order.order_shipments)?.courier || (r.shippingType==='pickup'?'Ambil di Toko':'Siap')) : 'Belum diisi'},
    {ok:r.trackingReady, icon:'fa-receipt', label:'Resi', text:r.trackingReady ? (latest(order.order_shipments)?.tracking_number || 'Tidak wajib') : 'Belum diisi'}
  ];
  const readyCount = checks.filter(x=>x.ok).length;
  return `<section class="readiness-card">
    <div class="readiness-head">
      <div><span class="section-label"><i class="fa-solid fa-list-check"></i> CHECKLIST OPERASIONAL</span><h3>Kesiapan Pesanan</h3><p>Gunakan checklist ini sebelum pesanan dikirim atau diselesaikan.</p></div>
      <div class="readiness-score ${readyCount===checks.length?'complete':''}"><strong>${readyCount}/${checks.length}</strong><span>siap</span></div>
    </div>
    <div class="readiness-grid">
      ${checks.map(c=>`<div class="readiness-item ${c.ok?'ok':'pending'}"><i class="fa-solid ${c.ok?'fa-circle-check':'fa-circle-exclamation'}"></i><div><span>${esc(c.label)}</span><strong>${esc(c.text)}</strong></div></div>`).join('')}
    </div>
  </section>`;
}

function buildPaymentHistory(order){
  const rows = sortNewest(order?.order_payments);
  if(!rows.length) return '<div class="notice">Belum ada riwayat pembayaran.</div>';
  return `<div class="payment-history-list">${rows.map((p,idx)=>`
    <article class="payment-history-item">
      <div class="payment-history-index">${idx+1}</div>
      <div class="payment-history-main">
        <div class="payment-history-title"><strong>${rupiah(p.amount)}</strong><span class="pill ${p.payment_status==='paid'?'ok':p.payment_status==='rejected'?'danger':'warn'}">${esc(label(p.payment_status))}</span></div>
        <span>${esc(label(p.payment_method || order.payment_method))} · ${fmtDate(p.paid_at || p.created_at)}</span>
        ${p.reference_number ? `<small>Referensi: ${esc(p.reference_number)}</small>` : ''}
        ${p.note ? `<small>Catatan: ${esc(p.note)}</small>` : ''}
      </div>
      ${p.proof_url ? `<button class="btn soft payment-history-proof" data-proof-path="${esc(p.proof_url)}"><i class="fa-solid fa-image"></i> Bukti</button>` : ''}
    </article>`).join('')}</div>`;
}

function buildActivityTimeline(order){
  const events=[];
  if(order?.created_at) events.push({date:order.created_at, icon:'fa-cart-plus', title:'Pesanan dibuat', text:order.order_number || `Order #${order.id}`});
  (order?.order_payments || []).forEach(p=>{
    if(p?.created_at) events.push({date:p.created_at, icon:'fa-receipt', title:'Pembayaran dicatat', text:`${rupiah(p.amount)} · ${label(p.payment_status)}`});
    if(p?.paid_at && p.payment_status==='paid') events.push({date:p.paid_at, icon:'fa-circle-check', title:'Pembayaran disetujui', text:rupiah(p.amount)});
  });
  (order?.order_shipments || []).forEach(sh=>{
    if(sh?.shipped_at) events.push({date:sh.shipped_at, icon:'fa-truck', title:'Pesanan dikirim', text:sh.courier || 'Pengiriman'});
    if(sh?.delivered_at) events.push({date:sh.delivered_at, icon:'fa-house-circle-check', title:'Pesanan diterima', text:sh.tracking_number || 'Terkirim'});
  });
  if(order?.updated_at && order.updated_at !== order.created_at) events.push({date:order.updated_at, icon:'fa-rotate', title:'Status terakhir diperbarui', text:label(order.order_status)});
  events.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return `<div class="activity-timeline">${events.slice(0,10).map(e=>`<div class="activity-item"><span class="activity-dot"><i class="fa-solid ${e.icon}"></i></span><div><strong>${esc(e.title)}</strong><span>${esc(e.text)}</span><small>${fmtDate(e.date)}</small></div></div>`).join('') || '<div class="notice">Belum ada aktivitas.</div>'}</div>`;
}

function buildQuickActions(order, ship){
  const wa = String(order?.customer_whatsapp || '').replace(/[^0-9]/g,'');
  const waText = encodeURIComponent(`Halo ${order?.customer_name || ''}, update pesanan ${order?.order_number || ''}: status ${label(order?.order_status)}. Pembayaran: ${label(order?.payment_status)}.${ship?.tracking_number ? ` Resi: ${ship.tracking_number}.` : ''} Terima kasih — CEO Part & Service.`);
  return `<section class="quick-actions-card">
    <div><span class="section-label"><i class="fa-solid fa-bolt"></i> AKSI CEPAT</span><h3>Shortcut Pesanan</h3></div>
    <div class="quick-actions-grid">
      <button class="btn soft quick-copy" data-copy="${esc(order?.order_number || '')}"><i class="fa-regular fa-copy"></i> Salin No. Order</button>
      ${wa ? `<a class="btn success" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${waText}"><i class="fa-brands fa-whatsapp"></i> Update WhatsApp</a>` : ''}
      ${order?.payment_status==='lunas' ? `<a class="btn primary" target="_blank" rel="noopener" href="nota-produk.html?id=${encodeURIComponent(order.id)}"><i class="fa-solid fa-file-invoice"></i> Buka Invoice</a>` : `<button class="btn soft" disabled><i class="fa-solid fa-lock"></i> Invoice setelah Lunas</button>`}
      ${ship?.tracking_number ? `<button class="btn soft quick-copy" data-copy="${esc(ship.tracking_number)}"><i class="fa-regular fa-copy"></i> Salin Resi</button>` : ''}
    </div>
  </section>`;
}

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


function getOrderPriority(order){
  const pay = latest(order.order_payments);
  const ship = latest(order.order_shipments);
  const shippingType = inferShippingType(order, ship);
  const proofPending = !!(pay?.proof_url && pay.payment_status === "pending");

  if(proofPending){
    return { key:"proof", label:"Perlu Verifikasi", className:"danger", icon:"fa-receipt" };
  }
  if(order.shipping_method === "delivery" && Number(order.shipping_fee || 0) <= 0 && shippingType !== "cod"){
    return { key:"shipping_fee", label:"Tentukan Ongkir", className:"warning", icon:"fa-truck-fast" };
  }
  if(order.payment_status === "lunas" && order.order_status === "menunggu_diproses"){
    return { key:"process", label:"Siap Diproses", className:"info", icon:"fa-circle-play" };
  }
  if(["dikemas","dikirim","dalam_perjalanan"].includes(order.order_status) && (ship?.shipping_status || "belum_dikirim") !== "terkirim"){
    return { key:"ship", label:"Perlu Dikirim", className:"purple", icon:"fa-box" };
  }
  if(order.order_status === "selesai"){
    return { key:"done", label:"Selesai", className:"success", icon:"fa-circle-check" };
  }
  if(order.order_status === "dibatalkan" || order.order_status === "gagal_dikirim"){
    return { key:"problem", label:"Perlu Dicek", className:"muted", icon:"fa-triangle-exclamation" };
  }
  return { key:"normal", label:"Pantau", className:"neutral", icon:"fa-eye" };
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

document.addEventListener("DOMContentLoaded", async () => {
  setup();
  await loadCurrentAdminRole();
  await loadOrders();
  $("year").textContent = new Date().getFullYear();
});

async function loadCurrentAdminRole(){
  try{
    const { data:{ session } } = await client.auth.getSession();
    if(!session) return;
    const { data, error } = await client
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if(error) throw error;
    currentUserRole = data?.is_active ? data.role : null;
    document.body.classList.toggle("can-bulk-delete", currentUserRole === "superadmin");
  }catch(err){
    console.error("Gagal membaca role admin:", err);
  }
}

function setup(){
  $("refreshBtn").onclick = loadOrders;
  ["searchInput","paymentFilter","shippingFilter","statusFilter"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", () => { page = 1; clearOrderSelection(); applyFilters(); });
  });
  $("prevPage").onclick = () => { if(page > 1){ page--; clearOrderSelection(); render(); } };
  $("nextPage").onclick = () => { if(page < Math.max(1, Math.ceil(filtered.length / pageSize))){ page++; clearOrderSelection(); render(); } };
  $("pageSizeSelect")?.addEventListener("change", e => {
    pageSize = Number(e.target.value) || 10;
    page = 1;
    clearOrderSelection();
    render();
  });

  document.querySelectorAll(".stat-filter-card").forEach(card => {
    const activate = () => {
      activeStatFilter = card.dataset.statFilter || "all";
      page = 1;
      clearOrderSelection();
      document.querySelectorAll(".stat-filter-card").forEach(c => c.classList.toggle("active", c === card));
      applyFilters();
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); activate(); } });
  });
  $("checkAllOrders")?.addEventListener("change", e => {
    document.querySelectorAll(".order-select").forEach(cb => {
      cb.checked = e.target.checked;
      const id = Number(cb.dataset.id);
      if(e.target.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
    });
    updateBulkSelectionUI();
  });
  $("deleteSelectedOrders")?.addEventListener("click", deleteSelectedOrders);

  $("closeModal").onclick = closeModal;
  $("detailModal").onclick = e => { if(e.target === $("detailModal")) closeModal(); };
  $("menuToggle").onclick = () => { $("topNav").classList.toggle("open"); $("navOverlay").classList.toggle("show"); };
  $("navOverlay").onclick = () => { $("topNav").classList.remove("open"); $("navOverlay").classList.remove("show"); };
}

async function loadOrders(){
  $("orderTableBody").innerHTML = '<tr><td colspan="10" class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat order...</td></tr>';
  const { data, error } = await client
    .from("orders")
    .select(`*,order_items(*,order_item_units(*)),order_payments(*),order_shipments(*)`)
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    $("orderTableBody").innerHTML = `<tr><td colspan="10" class="empty error">Gagal memuat order: ${esc(error.message)}<br><small>Pastikan SQL Admin Order Tahap 2 sudah dijalankan.</small></td></tr>`;
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
    const itemText = (o.order_items || []).map(i => `${i.product_name} ${i.variant_name || ""} ${i.color || ""} ${(i.order_item_units || []).map(u=>`${u.imei1 || ""} ${u.imei2 || ""} ${u.serial_number || ""}`).join(" ")}`).join(" ");
    const shipText = (o.order_shipments || []).map(sh => `${sh.courier || ""} ${sh.tracking_number || ""}`).join(" ");
    const hay = `${o.order_number || ""} ${o.customer_name || ""} ${o.customer_whatsapp || ""} ${itemText} ${shipText}`.toLowerCase();
    const ship = latest(o.order_shipments);
    const shippingType = inferShippingType(o, ship);
    const proofPending = (o.order_payments || []).some(p => p.proof_url && p.payment_status === "pending");
    const statMatch = activeStatFilter === "all" ||
      (activeStatFilter === "waiting" && o.order_status === "menunggu_diproses") ||
      (activeStatFilter === "proof" && proofPending) ||
      (activeStatFilter === "unpaid" && o.payment_status !== "lunas");

    return (!q || hay.includes(q)) &&
      (pf === "all" || o.payment_status === pf) &&
      (sf === "all" || shippingType === sf) &&
      (st === "all" || o.order_status === st) &&
      statMatch;
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
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if(page > pages) page = pages;
  const startIndex = (page - 1) * pageSize;
  const rows = filtered.slice(startIndex, startIndex + pageSize);

  const from = filtered.length ? startIndex + 1 : 0;
  const to = Math.min(startIndex + pageSize, filtered.length);
  $("pageInfo").textContent = filtered.length ? `${from}-${to} dari ${filtered.length} order` : "0 order";
  $("prevPage").disabled = page <= 1;
  $("nextPage").disabled = page >= pages;
  renderPageNumbers(pages);

  if(!rows.length){
    $("orderTableBody").innerHTML = '<tr><td colspan="10" class="empty">Tidak ada order yang sesuai.</td></tr>';
    return;
  }

  $("orderTableBody").innerHTML = rows.map(o => {
    const items = o.order_items || [];
    const item = items[0] || {};
    const pay = latest(o.order_payments);
    const ship = latest(o.order_shipments);
    const proofPending = !!(pay?.proof_url && pay.payment_status === "pending");
    const priority = getOrderPriority(o);
    const extraItems = Math.max(0, items.length - 1);
    const variantParts = [item.variant_name, item.color].filter(Boolean).join(" · ");

    return `<tr class="order-row priority-row-${priority.className}">
      <td class="selection-col"><input type="checkbox" class="order-select" data-id="${o.id}" ${selectedOrderIds.has(Number(o.id)) ? "checked" : ""} aria-label="Pilih ${esc(o.order_number || `order ${o.id}`)}"></td>
      <td>
        <div class="order-number-cell">
          <strong>${esc(o.order_number || `#${o.id}`)}</strong>
          <small><i class="fa-regular fa-clock"></i> ${fmtDate(o.created_at)}</small>
        </div>
      </td>
      <td>
        <div class="buyer-cell">
          <strong>${esc(o.customer_name)}</strong>
          <small><i class="fa-brands fa-whatsapp"></i> ${esc(o.customer_whatsapp)}</small>
        </div>
      </td>
      <td>
        <div class="product-cell">
          <strong>${esc(item.product_name || "-")}</strong>
          <small>${esc(variantParts || item.variant_name || "-")}${item.quantity ? ` · ${item.quantity} unit` : ""}</small>
          ${extraItems ? `<span class="more-items">+${extraItems} produk lain</span>` : ""}
        </div>
      </td>
      <td>
        <span class="pill shipping-pill"><i class="fa-solid fa-truck"></i> ${esc(shippingLabel(o, ship))}</span>
        ${ship?.courier ? `<small>${esc(ship.courier)}</small>` : ""}
      </td>
      <td>
        <span class="pill ${paymentBadge(o.payment_status)}">${esc(label(o.payment_status))}</span>
        ${proofPending ? '<small class="proof"><i class="fa-solid fa-receipt"></i> Bukti masuk</small>' : ""}
      </td>
      <td>
        <div class="total-cell">
          <strong>${rupiah(o.total)}</strong>
          ${Number(o.remaining_amount || 0) > 0 ? `<small>Sisa ${rupiah(o.remaining_amount)}</small>` : '<small class="paid-text">Lunas</small>'}
        </div>
      </td>
      <td>
        <span class="priority-badge ${priority.className}"><i class="fa-solid ${priority.icon}"></i> ${priority.label}</span>
      </td>
      <td><span class="pill ${orderBadge(o.order_status)}">${esc(label(o.order_status))}</span></td>
      <td><button class="btn primary detail-btn table-detail-btn" data-id="${o.id}" title="Buka detail order"><i class="fa-solid fa-eye"></i><span>Detail</span></button></td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".detail-btn").forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
  document.querySelectorAll(".order-select").forEach(cb => cb.addEventListener("change", () => {
    const id = Number(cb.dataset.id);
    if(cb.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
    updateBulkSelectionUI();
  }));
  updateBulkSelectionUI();
}

function renderPageNumbers(totalPages){
  const container = $("pageNumbers");
  if(!container) return;
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  const parts = [];
  if(start > 1){
    parts.push(`<button class="page-number" data-page="1">1</button>`);
    if(start > 2) parts.push('<span class="page-ellipsis">…</span>');
  }
  for(let n=start; n<=end; n++){
    parts.push(`<button class="page-number ${n === page ? "active" : ""}" data-page="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`);
  }
  if(end < totalPages){
    if(end < totalPages - 1) parts.push('<span class="page-ellipsis">…</span>');
    parts.push(`<button class="page-number" data-page="${totalPages}">${totalPages}</button>`);
  }
  container.innerHTML = parts.join("");
  container.querySelectorAll(".page-number").forEach(btn => {
    btn.onclick = () => { page = Number(btn.dataset.page); clearOrderSelection(); render(); };
  });
}

function getWorkflowState(o, pay, ship){
  const isPickup = o.shipping_method === "pickup";
  const proofPending = !!(pay?.proof_url && pay.payment_status === "pending");
  const paymentComplete = o.payment_status === "lunas";
  const paymentReviewed = pay?.payment_status === "paid" || paymentComplete;
  const shippingReady = isPickup || Number(o.shipping_fee || 0) > 0;
  const orderProcessing = ["dikemas","dikirim","dalam_perjalanan","selesai"].includes(o.order_status);
  const shipped = ["dikirim","dalam_perjalanan","selesai"].includes(o.order_status) || ["dikirim","dalam_perjalanan","terkirim"].includes(ship?.shipping_status);
  const finished = o.order_status === "selesai" || ship?.shipping_status === "terkirim";

  let currentStep = 1;
  let recommendation = "Periksa dan verifikasi pembayaran pelanggan.";
  let recommendationIcon = "fa-money-check-dollar";

  if(paymentReviewed || paymentComplete){
    currentStep = 2;
    recommendation = isPickup ? "Pembayaran sudah siap. Lanjutkan proses pesanan." : "Tentukan ongkir final dan kurir sebelum memproses pesanan.";
    recommendationIcon = isPickup ? "fa-box-open" : "fa-truck-fast";
  }
  if((paymentReviewed || paymentComplete) && shippingReady){
    currentStep = 3;
    recommendation = "Pesanan siap diproses. Ubah status menjadi Dikemas saat unit mulai disiapkan.";
    recommendationIcon = "fa-box";
  }
  if(orderProcessing){
    currentStep = 4;
    recommendation = isPickup ? "Pastikan barang diserahkan ke pelanggan lalu tandai pesanan Selesai." : "Lengkapi kurir/resi dan perbarui status pengiriman sampai Selesai.";
    recommendationIcon = "fa-route";
  }
  if(shipped){
    currentStep = 4;
    recommendation = "Pantau pengiriman. Setelah barang diterima, ubah status menjadi Selesai / Terkirim.";
    recommendationIcon = "fa-location-dot";
  }
  if(finished){
    currentStep = 5;
    recommendation = "Pesanan telah selesai. Tidak ada tindakan utama yang diperlukan.";
    recommendationIcon = "fa-circle-check";
  }

  return {isPickup, proofPending, paymentComplete, paymentReviewed, shippingReady, orderProcessing, shipped, finished, currentStep, recommendation, recommendationIcon};
}

function buildWorkflowPanel(o, pay, ship){
  const w = getWorkflowState(o, pay, ship);
  const steps = [
    {n:1, icon:"fa-credit-card", title:"Pembayaran", text:w.paymentReviewed || w.paymentComplete ? "Terverifikasi" : (w.proofPending ? "Perlu verifikasi" : "Menunggu pembayaran")},
    {n:2, icon:w.isPickup ? "fa-store" : "fa-truck-fast", title:w.isPickup ? "Ambil di Toko" : "Ongkir & Kurir", text:w.isPickup ? "Tidak perlu ongkir" : (w.shippingReady ? "Sudah ditentukan" : "Belum ditentukan")},
    {n:3, icon:"fa-box", title:"Proses Pesanan", text:w.orderProcessing ? "Sedang diproses" : "Belum diproses"},
    {n:4, icon:"fa-route", title:w.isPickup ? "Serah Terima" : "Pengiriman", text:w.finished ? "Selesai" : (w.shipped ? "Dalam proses" : "Belum dikirim")}
  ];

  return `<div class="workflow-wrap">
    <div class="workflow-head">
      <div>
        <span class="section-label"><i class="fa-solid fa-diagram-project"></i> ALUR KERJA ADMIN</span>
        <h3>Proses Pesanan</h3>
        <p>Ikuti urutan berikut agar pembayaran, ongkir, proses, dan pengiriman tidak terlewat.</p>
      </div>
      <span class="workflow-current ${w.finished ? 'done' : ''}">${w.finished ? 'Selesai' : `Tahap ${Math.min(w.currentStep,4)} dari 4`}</span>
    </div>
    <div class="workflow-steps">
      ${steps.map(step => {
        const done = w.finished || step.n < w.currentStep || (step.n===1 && (w.paymentReviewed||w.paymentComplete)) || (step.n===2 && w.shippingReady) || (step.n===3 && w.orderProcessing) || (step.n===4 && w.finished);
        const active = !w.finished && step.n === Math.min(w.currentStep,4);
        return `<div class="workflow-step ${done ? 'done' : ''} ${active ? 'active' : ''}">
          <div class="workflow-step-number">${done ? '<i class="fa-solid fa-check"></i>' : step.n}</div>
          <div class="workflow-step-copy"><strong><i class="fa-solid ${step.icon}"></i> ${step.title}</strong><span>${step.text}</span></div>
        </div>`;
      }).join('')}
    </div>
    <div class="workflow-recommendation ${w.finished ? 'done' : ''}">
      <span class="workflow-recommendation-icon"><i class="fa-solid ${w.recommendationIcon}"></i></span>
      <div><small>${w.finished ? 'STATUS' : 'TINDAKAN BERIKUTNYA'}</small><strong>${w.recommendation}</strong></div>
    </div>
  </div>`;
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
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const assignedUnits = countAssignedUnits(o);
  const paymentHistory = buildPaymentHistory(o);
  const mapLink = (o.latitude != null && o.longitude != null)
    ? `https://www.google.com/maps?q=${encodeURIComponent(o.latitude)},${encodeURIComponent(o.longitude)}`
    : null;
  const wa = String(o.customer_whatsapp || '').replace(/[^0-9]/g,'');
  const waText = encodeURIComponent(`Halo ${o.customer_name || ''}, update pesanan ${o.order_number || ''}: status ${label(o.order_status)}. Pembayaran: ${label(o.payment_status)}.${ship?.tracking_number ? ` Resi: ${ship.tracking_number}.` : ''} Terima kasih — CEO Part & Service.`);

  const productHtml = items.map((i, idx) => {
    const units = (i.order_item_units || []).slice().sort((a,b)=>Number(a.id)-Number(b.id));
    const unitText = units.length
      ? units.map((u,n)=>`<span class="unit-inline"><b>Unit ${n+1}</b> · IMEI ${esc(u.imei1 || '-')} ${u.imei2 ? `· IMEI 2 ${esc(u.imei2)}` : ''} ${u.serial_number ? `· SN ${esc(u.serial_number)}` : ''}</span>`).join('')
      : '<span class="unit-inline empty-unit">IMEI belum ditetapkan</span>';
    return `<article class="simple-product-row">
      <div class="item-number">${idx+1}</div>
      <div class="simple-product-main">
        <strong>${esc(i.product_name || '-')}</strong>
        <span>${esc([i.variant_name, i.color, i.ram ? `RAM ${i.ram}` : '', i.storage ? `Storage ${i.storage}` : ''].filter(Boolean).join(' · ') || 'Varian standar')}</span>
        <div class="unit-inline-list">${unitText}</div>
      </div>
      <div class="simple-product-price"><small>${Number(i.quantity || 0)} × ${rupiah(i.unit_price)}</small><strong>${rupiah(i.subtotal)}</strong></div>
    </article>`;
  }).join('') || '<div class="notice">Item tidak ditemukan.</div>';

  $("detailContent").innerHTML = `
    <div class="detail-body simple-order-detail">
      <section class="simple-order-head">
        <div>
          <div class="simple-status-row">
            <span class="pill ${orderBadge(o.order_status)}">${esc(label(o.order_status))}</span>
            <span class="pill ${paymentBadge(o.payment_status)}">${esc(label(o.payment_status))}</span>
          </div>
          <p>${esc(o.customer_name || '-')} · ${fmtDate(o.created_at)} · ${items.length} produk / ${totalQty} unit</p>
        </div>
        <div class="simple-head-total"><span>Total</span><strong>${rupiah(o.total)}</strong></div>
      </section>

      <div class="simple-quick-actions">
        ${wa ? `<a class="btn success" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${waText}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
        ${o.payment_status === 'lunas' ? `<a class="btn primary" target="_blank" rel="noopener" href="nota-produk.html?id=${encodeURIComponent(o.id)}"><i class="fa-solid fa-file-invoice"></i> Invoice</a>` : `<button class="btn soft" disabled><i class="fa-solid fa-lock"></i> Invoice setelah Lunas</button>`}
        <button class="btn soft quick-copy" data-copy="${esc(o.order_number || '')}"><i class="fa-regular fa-copy"></i> Salin Order</button>
        ${mapLink ? `<a class="btn soft" target="_blank" rel="noopener" href="${mapLink}"><i class="fa-solid fa-location-dot"></i> Lokasi</a>` : ''}
      </div>

      <section class="simple-section-card">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-user"></i></span><div><h3>Data Pesanan</h3><small>Informasi pelanggan dan metode transaksi</small></div></div>
        <div class="simple-info-grid">
          <div><span>Nama</span><strong>${esc(o.customer_name || '-')}</strong></div>
          <div><span>WhatsApp</span><strong>${esc(o.customer_whatsapp || '-')}</strong></div>
          <div><span>Email</span><strong>${esc(o.customer_email || '-')}</strong></div>
          <div><span>Pengiriman</span><strong>${esc(shippingLabel(o, ship))}</strong></div>
          <div><span>Pembayaran</span><strong>${esc(label(o.payment_method))}</strong></div>
          <div><span>Tanggal Order</span><strong>${fmtDate(o.created_at)}</strong></div>
          <div class="span-2"><span>Alamat</span><strong>${esc(o.customer_address || '-')}</strong></div>
        </div>
        ${o.customer_note ? `<div class="note-box"><b>Catatan pelanggan</b><br>${esc(o.customer_note)}</div>` : ''}
      </section>

      <section class="simple-section-card">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-mobile-screen-button"></i></span><div><h3>Produk yang Dibeli</h3><small>${totalQty} unit · IMEI terisi ${assignedUnits}/${totalQty}</small></div></div>
        <div class="simple-products">${productHtml}</div>
        <details class="simple-collapse imei-collapse">
          <summary><span><i class="fa-solid fa-barcode"></i> Kelola IMEI / Unit Fisik</span><small>${assignedUnits}/${totalQty} unit terisi</small></summary>
          <div class="collapse-body imei-products">${items.map(i => buildUnitManager(i)).join('') || '<div class="notice">Item tidak ditemukan.</div>'}</div>
        </details>
      </section>

      <section class="simple-section-card">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-wallet"></i></span><div><h3>Pembayaran & Biaya</h3><small>Cek total, bukti, dan pembayaran masuk</small></div></div>
        <div class="simple-money-grid">
          <div><span>Subtotal Produk</span><strong>${rupiah(o.subtotal)}</strong></div>
          <div><span>Diskon</span><strong>${Number(o.discount || 0) ? `- ${rupiah(o.discount)}` : rupiah(0)}</strong></div>
          <div><span>Ongkir</span><strong>${rupiah(o.shipping_fee)}</strong></div>
          <div class="money-total"><span>Total Pesanan</span><strong>${rupiah(o.total)}</strong></div>
          <div><span>Sudah Dibayar</span><strong class="text-success">${rupiah(o.amount_paid)}</strong></div>
          <div class="${Number(o.remaining_amount || 0) > 0 ? 'has-balance' : 'is-paid'}"><span>Sisa Tagihan</span><strong>${rupiah(o.remaining_amount)}</strong></div>
        </div>
        ${buildSimplePaymentAction(o, pay)}
        <details class="simple-collapse payment-history-collapse">
          <summary><span><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Pembayaran</span><small>${(o.order_payments || []).length} transaksi</small></summary>
          <div class="collapse-body">${paymentHistory}</div>
        </details>
      </section>

      ${shippingType !== 'pickup' ? `
      <section class="simple-section-card">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-truck-fast"></i></span><div><h3>Pengiriman</h3><small>${esc(shippingLabel(o, ship))}</small></div></div>
        <div class="simple-form-grid">
          <label>Kurir / Ekspedisi<input id="shippingCourier" value="${esc(ship?.courier || '')}" placeholder="Gojek, Grab, JNE, J&T, dll."></label>
          <label>Ongkir Final<input id="shippingFee" inputmode="numeric" value="${Number(o.shipping_fee || 0)}"></label>
          ${shippingType === 'package' || ship?.tracking_number ? `<label class="span-2">Nomor Resi / Kode Pengiriman<input id="trackingNumber" value="${esc(ship?.tracking_number || '')}" placeholder="Isi jika tersedia"></label>` : `<input type="hidden" id="trackingNumber" value="${esc(ship?.tracking_number || '')}">`}
        </div>
      </section>` : `<input type="hidden" id="trackingNumber" value="${esc(ship?.tracking_number || '')}">`}

      <section class="simple-section-card status-save-card">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-route"></i></span><div><h3>Status Pesanan</h3><small>Cukup ubah yang diperlukan lalu simpan</small></div></div>
        <div class="simple-form-grid">
          <label>Status Pesanan<select id="adminOrderStatus">${["menunggu_diproses","dikemas","dikirim","dalam_perjalanan","selesai","dibatalkan","gagal_dikirim"].map(v=>`<option value="${v}" ${o.order_status===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select></label>
          <label>Status Pengiriman Otomatis<input id="autoShippingStatusPreview" value="${esc(label(autoShippingStatus(o.order_status)))}" readonly></label>
          <label class="span-2">Catatan Admin<textarea id="adminNote" rows="3" placeholder="Opsional">${esc(o.admin_note || '')}</textarea></label>
        </div>
        <div class="single-save-row"><button class="btn primary save-order-changes" id="saveOrderChangesBtn"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan</button></div>
      </section>
    </div>`;

  if(pay?.proof_url){
    document.querySelectorAll('.view-current-proof').forEach(btn => btn.onclick = () => viewProof(pay.proof_url));
  }
  document.querySelectorAll('.payment-history-proof').forEach(btn => btn.addEventListener('click', () => viewProof(btn.dataset.proofPath)));
  document.querySelectorAll('.quick-copy').forEach(btn => btn.addEventListener('click', async () => {
    const value = btn.dataset.copy || '';
    if(!value) return;
    try{ await navigator.clipboard.writeText(value); const old=btn.innerHTML; btn.innerHTML='<i class="fa-solid fa-check"></i> Tersalin'; setTimeout(()=>btn.innerHTML=old,1200); }
    catch{ prompt('Salin data berikut:', value); }
  }));

  bindUnitActions(o);
  bindSimpleAdminActions(o, pay, ship, shippingType);
  $("detailModal").classList.add("show");
  $("detailModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function buildSimplePaymentAction(o, pay){
  if(!pay){
    return `<div class="simple-payment-action"><div class="notice">Data pembayaran belum ditemukan.</div></div>`;
  }
  if(pay.payment_status === 'paid'){
    return `<div class="simple-payment-action payment-ok"><div><i class="fa-solid fa-circle-check"></i><span><b>Pembayaran terakhir terverifikasi</b><small>${rupiah(pay.amount)} · ${fmtDate(pay.paid_at || pay.created_at)}</small></span></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-image"></i> Lihat Bukti</button>' : ''}</div>`;
  }
  if(pay.payment_status === 'rejected'){
    return `<div class="simple-payment-action payment-rejected"><div><i class="fa-solid fa-circle-xmark"></i><span><b>Pembayaran terakhir ditolak</b><small>${esc(pay.note || 'Bukti/pembayaran ditolak.')}</small></span></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-image"></i> Lihat Bukti</button>' : ''}</div>`;
  }
  const canApprove = o.payment_method !== 'transfer' || !!pay.proof_url;
  return `<div class="simple-payment-review">
    <div class="review-head"><div><b>Bukti pembayaran menunggu verifikasi</b><small>Periksa bukti dan nominal sebelum diterima.</small></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-eye"></i> Lihat Bukti</button>' : ''}</div>
    <div class="review-fields">
      <label>Nominal diterima<input id="paymentAmount" inputmode="numeric" value="${Number(pay.amount || o.remaining_amount || o.total || 0)}"></label>
      <label>Catatan<input id="paymentNote" value="" placeholder="Opsional"></label>
    </div>
    <div class="review-actions"><button class="btn success" id="approvePaymentBtn" ${canApprove ? '' : 'disabled'}><i class="fa-solid fa-check"></i> Terima Pembayaran</button><button class="btn danger" id="rejectPaymentBtn"><i class="fa-solid fa-xmark"></i> Tolak</button></div>
    ${!canApprove ? '<small class="helper">Transfer belum dapat disetujui karena bukti belum tersedia.</small>' : ''}
  </div>`;
}

function bindSimpleAdminActions(o, pay, ship, shippingType){
  const approveBtn = $("approvePaymentBtn");
  const rejectBtn = $("rejectPaymentBtn");
  const saveBtn = $("saveOrderChangesBtn");
  const statusSelect = $("adminOrderStatus");

  if(statusSelect){
    statusSelect.addEventListener('change', () => {
      const preview=$("autoShippingStatusPreview");
      if(preview) preview.value = label(autoShippingStatus(statusSelect.value));
    });
  }

  if(approveBtn) approveBtn.onclick = async () => {
    const amount = numericValue('paymentAmount');
    if(amount <= 0) return alert('Nominal pembayaran harus lebih dari 0.');
    if(!confirm(`Terima pembayaran ${rupiah(amount)} untuk ${o.order_number}?`)) return;
    setBusy(approveBtn,true,'Memproses...');
    const { error } = await client.rpc('admin_review_product_payment',{p_order_id:o.id,p_payment_id:pay.id,p_action:'approve',p_amount:amount,p_note:$("paymentNote")?.value.trim() || null});
    if(error){ console.error(error); alert('Gagal verifikasi pembayaran: '+error.message); setBusy(approveBtn,false); return; }
    await reloadAndReopen(o.id);
  };

  if(rejectBtn) rejectBtn.onclick = async () => {
    const note=$("paymentNote")?.value.trim() || 'Bukti/pembayaran ditolak admin.';
    if(!confirm(`Tolak pembayaran untuk ${o.order_number}?`)) return;
    setBusy(rejectBtn,true,'Memproses...');
    const { error } = await client.rpc('admin_review_product_payment',{p_order_id:o.id,p_payment_id:pay.id,p_action:'reject',p_amount:null,p_note:note});
    if(error){ console.error(error); alert('Gagal menolak pembayaran: '+error.message); setBusy(rejectBtn,false); return; }
    await reloadAndReopen(o.id);
  };

  if(saveBtn) saveBtn.onclick = async () => {
    const orderStatus = $("adminOrderStatus").value;
    const readiness = getOperationalReadiness(o);
    if(['dikirim','dalam_perjalanan','selesai'].includes(orderStatus) && !readiness.imeiReady){
      alert(`Lengkapi IMEI / unit fisik terlebih dahulu. Saat ini ${readiness.assignedUnits} dari ${readiness.requiredUnits} unit sudah ditetapkan.`);
      return;
    }
    if(orderStatus === 'selesai' && !confirm(`Tandai ${o.order_number} sebagai SELESAI?`)) return;
    if(orderStatus === 'dibatalkan' && !confirm(`Batalkan ${o.order_number}?`)) return;

    setBusy(saveBtn,true,'Menyimpan...');
    let courier = ship?.courier || null;
    let tracking = $("trackingNumber")?.value.trim() || null;
    if(shippingType !== 'pickup'){
      const fee = numericValue('shippingFee');
      courier = $("shippingCourier")?.value.trim() || null;
      const { error:shipError } = await client.rpc('admin_set_product_shipping_fee',{p_order_id:o.id,p_shipping_fee:fee,p_courier:courier});
      if(shipError){ console.error(shipError); alert('Gagal menyimpan ongkir/kurir: '+shipError.message); setBusy(saveBtn,false); return; }
    }
    const { error } = await client.rpc('admin_update_product_order_status',{
      p_order_id:o.id,
      p_order_status:orderStatus,
      p_shipping_status:autoShippingStatus(orderStatus),
      p_tracking_number:tracking,
      p_courier:courier,
      p_admin_note:$("adminNote")?.value.trim() || null
    });
    if(error){ console.error(error); alert('Gagal menyimpan perubahan: '+error.message); setBusy(saveBtn,false); return; }
    alert('Perubahan order berhasil disimpan ✅');
    await reloadAndReopen(o.id);
  };
}

function buildUnitManager(item){
  const qty = Number(item.quantity || 0);
  const units = [...(item.order_item_units || [])].sort((a,b)=>Number(a.id)-Number(b.id));
  const slots = Array.from({length: qty}, (_,idx) => units[idx] || null);
  return `<article class="imei-product-block">
    <div class="imei-product-head">
      <div><strong>${esc(item.product_name || '-')}</strong><span>${esc(item.variant_name || 'Varian standar')} · ${esc(item.color || '-')} · RAM ${esc(item.ram || '-')} · ${esc(item.storage || '-')}</span></div>
      <span class="unit-progress ${units.length >= qty && qty > 0 ? 'complete' : ''}">${Math.min(units.length,qty)}/${qty} terisi</span>
    </div>
    <div class="unit-slots">
      ${slots.map((u,idx)=>`<div class="unit-slot ${u ? 'filled' : ''}" data-item-id="${item.id}" data-unit-id="${u?.id || ''}">
        <div class="unit-slot-title"><span>Unit ${idx+1}</span>${u ? '<span class="unit-ready"><i class="fa-solid fa-circle-check"></i> Tersimpan</span>' : '<span class="unit-empty">Belum ditetapkan</span>'}</div>
        <div class="unit-fields">
          <label>IMEI 1<input class="unit-imei1" inputmode="numeric" maxlength="20" value="${esc(u?.imei1 || '')}" placeholder="Contoh: 356789..." /></label>
          <label>IMEI 2 <small>(opsional)</small><input class="unit-imei2" inputmode="numeric" maxlength="20" value="${esc(u?.imei2 || '')}" placeholder="Dual SIM bila ada" /></label>
          <label>Serial Number <small>(opsional)</small><input class="unit-serial" value="${esc(u?.serial_number || '')}" placeholder="SN perangkat" /></label>
        </div>
        <label class="unit-note-label">Catatan unit <small>(opsional)</small><input class="unit-note" value="${esc(u?.note || '')}" placeholder="Warna fisik, kondisi segel, dll." /></label>
        <div class="unit-slot-actions">
          <button class="btn primary save-unit-btn"><i class="fa-solid fa-floppy-disk"></i> ${u ? 'Perbarui Unit' : 'Simpan Unit'}</button>
          ${u ? '<button class="btn danger delete-unit-btn"><i class="fa-solid fa-trash"></i> Hapus</button>' : ''}
        </div>
      </div>`).join('')}
    </div>
  </article>`;
}

function normalizeDeviceCode(value){ return String(value || '').trim().replace(/\s+/g,''); }

function bindUnitActions(order){
  document.querySelectorAll('.save-unit-btn').forEach(btn => btn.onclick = async () => {
    const slot = btn.closest('.unit-slot');
    const itemId = Number(slot.dataset.itemId);
    const unitId = slot.dataset.unitId ? Number(slot.dataset.unitId) : null;
    const imei1 = normalizeDeviceCode(slot.querySelector('.unit-imei1')?.value);
    const imei2 = normalizeDeviceCode(slot.querySelector('.unit-imei2')?.value);
    const serial = normalizeDeviceCode(slot.querySelector('.unit-serial')?.value);
    const note = slot.querySelector('.unit-note')?.value.trim() || null;
    if(!imei1) return alert('IMEI 1 wajib diisi untuk menetapkan unit HP.');
    if(!/^\d{14,17}$/.test(imei1)) return alert('IMEI 1 harus berupa 14–17 digit angka.');
    if(imei2 && !/^\d{14,17}$/.test(imei2)) return alert('IMEI 2 harus berupa 14–17 digit angka.');
    if(imei2 && imei1 === imei2) return alert('IMEI 1 dan IMEI 2 tidak boleh sama.');
    setBusy(btn,true,'Menyimpan...');
    const { error } = await client.rpc('admin_save_product_order_unit', {
      p_order_item_id:itemId, p_unit_id:unitId, p_imei1:imei1, p_imei2:imei2 || null,
      p_serial_number:serial || null, p_note:note
    });
    if(error){ console.error(error); alert('Gagal menyimpan unit: ' + error.message); setBusy(btn,false); return; }
    alert('Unit / IMEI berhasil disimpan ✅');
    await reloadAndReopen(order.id);
  });
  document.querySelectorAll('.delete-unit-btn').forEach(btn => btn.onclick = async () => {
    const slot = btn.closest('.unit-slot');
    const unitId = Number(slot.dataset.unitId);
    if(!unitId || !confirm('Hapus penetapan IMEI/unit ini?')) return;
    setBusy(btn,true,'Menghapus...');
    const { error } = await client.rpc('admin_delete_product_order_unit',{p_unit_id:unitId});
    if(error){ console.error(error); alert('Gagal menghapus unit: ' + error.message); setBusy(btn,false); return; }
    await reloadAndReopen(order.id);
  });
}

function buildPaymentAction(o, pay){
  if(!pay) return `<div class="action-card workflow-action-card" data-workflow-step="1"><span class="action-step-label">TAHAP 1</span><h4>Pembayaran</h4><div class="notice">Data pembayaran belum ditemukan.</div></div>`;

  if(pay.payment_status === "paid"){
    return `<div class="action-card workflow-action-card completed-action" data-workflow-step="1"><span class="action-step-label">TAHAP 1 · SELESAI</span><h4><i class="fa-solid fa-circle-check"></i> Pembayaran Terverifikasi</h4><p>Nominal pembayaran ini: <b>${rupiah(pay.amount)}</b><br>Waktu: ${fmtDate(pay.paid_at)}</p></div>`;
  }

  if(pay.payment_status === "rejected"){
    return `<div class="action-card workflow-action-card" data-workflow-step="1"><span class="action-step-label">TAHAP 1</span><h4><i class="fa-solid fa-circle-xmark"></i> Pembayaran Ditolak</h4><p>${esc(pay.note || "Bukti/pembayaran ditolak.")}</p></div>`;
  }

  const canApproveTransfer = o.payment_method !== "transfer" || !!pay.proof_url;
  return `<div class="action-card workflow-action-card" data-workflow-step="1">
    <span class="action-step-label">TAHAP 1</span>
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
    return `<div class="action-card workflow-action-card completed-action" data-workflow-step="2"><span class="action-step-label">TAHAP 2 · TIDAK DIPERLUKAN</span><h4><i class="fa-solid fa-store"></i> Ambil di Toko</h4><p>Ongkir tetap <b>Rp 0</b>. Tidak perlu konfirmasi ongkir.</p></div>`;
  }

  return `<div class="action-card workflow-action-card" data-workflow-step="2">
    <span class="action-step-label">TAHAP 2</span>
    <h4><i class="fa-solid fa-truck-fast"></i> Ongkir & Kurir</h4>
    <label>Nama kurir / ekspedisi</label>
    <input id="shippingCourier" value="${esc(ship?.courier || "")}" placeholder="Gojek, Grab, JNE, J&T, dll.">
    <label>Ongkir final</label>
    <input id="shippingFee" inputmode="numeric" value="${Number(o.shipping_fee || 0)}">
    <button class="btn primary full" id="saveShippingBtn"><i class="fa-solid fa-floppy-disk"></i> Simpan Ongkir</button>
    <small class="helper">Total dan sisa pembayaran dihitung ulang otomatis.</small>
  </div>`;
}

function autoShippingStatus(orderStatus){
  return ({
    menunggu_diproses:"belum_dikirim",
    dikemas:"dikemas",
    dikirim:"dikirim",
    dalam_perjalanan:"dalam_perjalanan",
    selesai:"terkirim",
    dibatalkan:"gagal",
    gagal_dikirim:"gagal"
  })[orderStatus] || "belum_dikirim";
}

function buildStatusAction(o, ship){
  const currentAuto = autoShippingStatus(o.order_status);
  return `<div class="action-card workflow-action-card" data-workflow-step="3">
    <span class="action-step-label">TAHAP 3 & 4</span>
    <h4><i class="fa-solid fa-route"></i> Proses & Pengiriman</h4>
    <label>Status pesanan</label>
    <select id="adminOrderStatus">
      ${["menunggu_diproses","dikemas","dikirim","dalam_perjalanan","selesai","dibatalkan","gagal_dikirim"].map(v=>`<option value="${v}" ${o.order_status===v?"selected":""}>${esc(label(v))}</option>`).join("")}
    </select>
    <div class="auto-status-box">
      <span><i class="fa-solid fa-wand-magic-sparkles"></i> Status pengiriman otomatis</span>
      <strong id="autoShippingStatusPreview">${esc(label(currentAuto))}</strong>
    </div>
    <label>Nomor resi / kode pengiriman</label>
    <input id="trackingNumber" value="${esc(ship?.tracking_number || "")}" placeholder="Opsional — isi jika tersedia">
    <label>Catatan admin</label>
    <textarea id="adminNote" rows="2" placeholder="Opsional">${esc(o.admin_note || "")}</textarea>
    <button class="btn primary full" id="saveStatusBtn"><i class="fa-solid fa-floppy-disk"></i> Simpan & Sinkronkan Status</button>
    <small class="helper">Cukup pilih status pesanan. Status pengiriman akan mengikuti otomatis agar tidak terjadi kombinasi status yang berbeda.</small>
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
  const orderStatusSelect = $("adminOrderStatus");

  if(orderStatusSelect){
    const refreshAutoStatus = () => {
      const preview = $("autoShippingStatusPreview");
      if(preview) preview.textContent = label(autoShippingStatus(orderStatusSelect.value));
    };
    orderStatusSelect.addEventListener("change", refreshAutoStatus);
    refreshAutoStatus();
  }

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
    const readiness = getOperationalReadiness(o);
    if(["dikirim","dalam_perjalanan","selesai"].includes(orderStatus) && !readiness.imeiReady){
      alert(`Lengkapi IMEI / unit fisik terlebih dahulu. Saat ini ${readiness.assignedUnits} dari ${readiness.requiredUnits} unit sudah ditetapkan.`);
      return;
    }
    const shippingStatus = autoShippingStatus(orderStatus);
    const tracking = $("trackingNumber").value.trim() || null;
    const courier = $("shippingCourier")?.value.trim() || ship?.courier || null;
    const adminNote = $("adminNote").value.trim() || null;

    if(orderStatus === "selesai" && !confirm(`Tandai ${o.order_number} sebagai SELESAI? Status pengiriman juga akan menjadi Terkirim.`)) return;
    if(orderStatus === "dibatalkan" && !confirm(`Batalkan ${o.order_number}? Status pengiriman akan ditutup sebagai Gagal.`)) return;

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
    alert(`Status berhasil diperbarui ✅\nPesanan: ${label(orderStatus)}\nPengiriman: ${label(shippingStatus)}`);
    await reloadAndReopen(o.id);
  };
}

function updateBulkSelectionUI(){
  const count = selectedOrderIds.size;
  const countEl = $("selectedOrderCount");
  const deleteBtn = $("deleteSelectedOrders");
  const checkAll = $("checkAllOrders");
  if(countEl) countEl.textContent = `${count} order dipilih`;
  if(deleteBtn) deleteBtn.disabled = currentUserRole !== 'superadmin' || count === 0;
  const visibleChecks = [...document.querySelectorAll('.order-select')];
  if(checkAll){
    checkAll.checked = visibleChecks.length > 0 && visibleChecks.every(cb=>cb.checked);
    checkAll.indeterminate = visibleChecks.some(cb=>cb.checked) && !checkAll.checked;
  }
}

function clearOrderSelection(){
  selectedOrderIds.clear();
  const checkAll=$("checkAllOrders");
  if(checkAll){ checkAll.checked=false; checkAll.indeterminate=false; }
  updateBulkSelectionUI();
}

async function deleteSelectedOrders(){
  if(currentUserRole !== 'superadmin'){
    alert('Hanya superadmin yang dapat menghapus order.');
    return;
  }
  const ids=[...selectedOrderIds].filter(Number.isFinite);
  if(!ids.length) return;
  const names=orders.filter(o=>ids.includes(Number(o.id))).map(o=>o.order_number || `#${o.id}`).slice(0,5);
  const extra=ids.length>5 ? `\n... dan ${ids.length-5} order lainnya` : '';
  const ok=confirm(`Hapus permanen ${ids.length} order terpilih?\n\n${names.join('\n')}${extra}\n\nData item, pembayaran, pengiriman, IMEI, garansi, dan klaim yang terkait akan ikut dihapus. Tindakan ini tidak dapat dibatalkan.`);
  if(!ok) return;
  const btn=$("deleteSelectedOrders");
  setBusy(btn,true,'Menghapus...');
  const { data, error } = await client.rpc('admin_delete_product_orders',{p_order_ids:ids});
  if(error){ console.error(error); alert('Gagal menghapus order: '+error.message+'\n\nPastikan SQL bulk-delete-order-produk.sql sudah dijalankan.'); setBusy(btn,false); return; }
  alert(`${Number(data || ids.length)} order berhasil dihapus.`);
  clearOrderSelection();
  await loadOrders();
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
