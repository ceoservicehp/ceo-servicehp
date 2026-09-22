"use strict";

const client = window.supabaseClient;
let pageSize = 10;
let activeStatFilter = "all";
let activeShippingTab = "all";
let orders = [];
let filtered = [];
let page = 1;
let currentOrderId = null;
let currentUserRole = null;
let selectedOrderIds = new Set();
let currentDetailTerms = null;
let currentDetailWarranties = [];

const $ = id => document.getElementById(id);
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate = v => v ? new Date(v).toLocaleString("id-ID", { dateStyle:"medium", timeStyle:"short" }) : "-";

const fmtDateOnly = v => v ? new Date(v).toLocaleDateString("id-ID", { day:"2-digit", month:"2-digit", year:"numeric" }) : "-";

function orderCostTotal(order){
  return (order?.order_items || []).reduce((sum, item) => {
    const costSubtotal = Number(item?.cost_subtotal);
    if(Number.isFinite(costSubtotal) && costSubtotal >= 0){
      return sum + costSubtotal;
    }

    const unitCost = Number(item?.unit_cost || 0);
    const qty = Number(item?.quantity || 0);
    return sum + (unitCost * qty);
  }, 0);
}

function orderNetProfit(order){
  // Laba produk: nilai produk setelah diskon dikurangi snapshot harga modal.
  // Ongkir tidak dihitung sebagai laba.
  const productRevenue = Math.max(
    0,
    Number(order?.subtotal || 0) - Number(order?.discount || 0)
  );
  return productRevenue - orderCostTotal(order);
}


function formatWaNumber(value){
  let phone = String(value || "").replace(/\D/g, "");
  if(phone.startsWith("0")) phone = "62" + phone.slice(1);
  else if(phone.startsWith("8")) phone = "62" + phone;
  return phone;
}

function productInvoiceUrl(order){
  return `${window.location.origin}/nota-produk.html?id=${encodeURIComponent(order.id)}`;
}

function productTrackingUrl(order){
  // Halaman invoice produk yang sudah ada dipakai juga sebagai tautan pengecekan pesanan.
  return productInvoiceUrl(order);
}

function warrantyClaimText(order){
  const invoiceUrl = productInvoiceUrl(order);
  return `🛡️ *INFORMASI GARANSI & KLAIM*
Garansi mengikuti produk/unit serta ketentuan garansi yang tercantum pada invoice.

Apabila ingin mengajukan klaim garansi, mohon siapkan:
• Nomor pesanan / invoice
• Nama pembeli dan nomor WhatsApp
• IMEI/serial number unit apabila tersedia
• Foto/video yang memperlihatkan kendala
• Penjelasan singkat mengenai kendala yang dialami

Silakan balas pesan WhatsApp ini untuk pengajuan awal klaim. Admin akan melakukan verifikasi data, masa garansi, kondisi unit, serta ketentuan garansi sebelum klaim diproses.

📄 Detail pesanan/invoice:
${invoiceUrl}`;
}

function shippingWhatsAppText(order){
  const ship = latest(order?.order_shipments);
  const trackingUrl = productTrackingUrl(order);
  return `Halo ${order?.customer_name || ""} 👋

Terima kasih telah berbelanja di *CEO Part & Service*.

Kami ingin menginformasikan bahwa pesanan Anda saat ini *sedang dalam perjalanan*. 🚚📦

*INFORMASI PESANAN*
📦 No. Pesanan: ${order?.order_number || "-"}
📍 Status Pesanan: ${label(order?.order_status)}
${ship?.courier ? `🚚 Kurir/Ekspedisi: ${ship.courier}\n` : ""}${ship?.tracking_number ? `🧾 No. Resi/Kode Pengiriman: ${ship.tracking_number}\n` : ""}
Anda dapat melihat detail pesanan melalui tautan berikut:
${trackingUrl}

Mohon pastikan nomor WhatsApp tetap aktif agar kurir maupun admin dapat menghubungi Anda apabila diperlukan. Setelah pesanan diterima, kami sarankan untuk memeriksa kondisi paket dan unit terlebih dahulu.

${warrantyClaimText(order)}

Apabila ada pertanyaan mengenai pesanan, pengiriman, pembayaran, maupun garansi, silakan balas pesan ini. Kami akan membantu Anda.

Terima kasih atas kepercayaan Anda. 🙏
*CEO Part & Service*
_Cellular Engineering Officer_`;
}

function billingWhatsAppText(order){
  const invoiceUrl = productInvoiceUrl(order);
  const remaining = Number(order?.remaining_amount || 0);
  return `Halo ${order?.customer_name || ""} 👋

Terima kasih telah melakukan pembelian produk di *CEO Part & Service*.

Berikut kami sampaikan informasi tagihan pesanan Anda:

📄 *TAGIHAN / INVOICE PRODUK*
🧾 No. Pesanan: ${order?.order_number || "-"}
💰 Total Tagihan: ${rupiah(order?.total)}
✅ Sudah Dibayar: ${rupiah(order?.amount_paid)}
${remaining > 0 ? `⏳ Sisa Tagihan: ${rupiah(remaining)}` : "✅ Sisa Tagihan: Rp 0"}
📌 Status Pembayaran: ${label(order?.payment_status)}

Detail lengkap pesanan dan invoice dapat dilihat melalui tautan berikut:
${invoiceUrl}

${remaining > 0
  ? `Mohon melakukan pembayaran sisa tagihan sebesar *${rupiah(remaining)}* sesuai metode dan kesepakatan pembayaran dengan pihak CEO Part & Service. Setelah pembayaran dilakukan, silakan konfirmasikan melalui WhatsApp ini agar dapat kami verifikasi.`
  : `Pembayaran pesanan Anda telah *LUNAS*. Terima kasih atas pembayaran dan kepercayaan Anda kepada CEO Part & Service.`}

${warrantyClaimText(order)}

Jika terdapat ketidaksesuaian data tagihan atau Anda membutuhkan bantuan terkait pembayaran maupun klaim garansi, silakan balas pesan ini.

Terima kasih. 🙏
*CEO Part & Service*
_Cellular Engineering Officer_`;
}
function orderNetProfit(order){
  // Ongkir bukan laba produk. Total produk = subtotal - discount.
  return Math.max(0, Number(order?.subtotal || 0) - Number(order?.discount || 0) - orderCostTotal(order));
}


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
  const explicit=String(order?.shipping_type || "").toLowerCase();
  if(["pickup","instant","package","cod"].includes(explicit)) return explicit;
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


function ensureRefreshButtonInPrimaryHero(){
  let btn = $("refreshBtn");
  if(btn) return btn;

  const heading = [...document.querySelectorAll("h1")].find(el =>
    /kelola\s+order\s+hp/i.test((el.textContent || "").replace(/\s+/g," ").trim())
  );

  if(heading){
    const hero = heading.closest("section") || heading.parentElement;
    if(hero){
      let actions = hero.querySelector(".hero-actions, .page-hero-actions, .admin-hero-actions, .hero-buttons");
      if(!actions){
        actions = document.createElement("div");
        actions.className = "order-primary-hero-actions";
        const anchor = heading.parentElement || hero;
        anchor.appendChild(actions);
      }
      btn = document.createElement("button");
      btn.id = "refreshBtn";
      btn.type = "button";
      btn.className = "btn btn-light order-refresh-top";
      btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh Data';
      actions.appendChild(btn);
      return btn;
    }
  }

  // Fallback bila hero komponen belum tersedia: tetap sediakan tombol tanpa membuat hero kedua.
  const sectionHeading = document.querySelector(".section-heading");
  if(sectionHeading){
    btn = document.createElement("button");
    btn.id = "refreshBtn";
    btn.type = "button";
    btn.className = "btn soft order-refresh-top";
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh Data';
    sectionHeading.appendChild(btn);
  }
  return btn;
}

function setup(){
  const refreshBtn = ensureRefreshButtonInPrimaryHero();
  if(refreshBtn) refreshBtn.onclick = loadOrders;
  ["searchInput","orderDate","dateSort"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", () => { page = 1; clearOrderSelection(); applyFilters(); });
  });
  document.querySelectorAll(".shipping-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      activeShippingTab = tab.dataset.shippingTab || "all";
      document.querySelectorAll(".shipping-tab").forEach(t => t.classList.toggle("active", t === tab));
      page = 1; clearOrderSelection(); applyFilters();
    });
  });
  $("resetOrderFilters")?.addEventListener("click", () => {
    $("searchInput").value = "";
    $("orderDate").value = ""; $("dateSort").value = "newest";
    activeShippingTab = "all"; activeStatFilter = "all";
    document.querySelectorAll(".shipping-tab").forEach(t => t.classList.toggle("active", t.dataset.shippingTab === "all"));
    document.querySelectorAll(".stat-filter-card").forEach(t => t.classList.toggle("active", t.dataset.statFilter === "all"));
    page = 1; clearOrderSelection(); applyFilters();
  });

  $("prevPage").onclick = () => { if(page > 1){ page--; clearOrderSelection(); render(); } };
  $("nextPage").onclick = () => { if(page < Math.max(1, Math.ceil(filtered.length / pageSize))){ page++; clearOrderSelection(); render(); } };
  $("pageSizeSelect")?.addEventListener("change", e => {
    pageSize = Number(e.target.value) || 10;
    page = 1;
    clearOrderSelection();
    render();
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

  $("closeModal").onclick = closeModal;
  $("detailModal").onclick = e => { if(e.target === $("detailModal")) closeModal(); };
  $("menuToggle").onclick = () => { $("topNav").classList.toggle("open"); $("navOverlay").classList.toggle("show"); };
  $("navOverlay").onclick = () => { $("topNav").classList.remove("open"); $("navOverlay").classList.remove("show"); };
}

async function loadOrders(){
  $("orderTableBody").innerHTML = '<tr><td colspan="12" class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat order...</td></tr>';
  const { data, error } = await client
    .from("orders")
    .select(`*,order_items(*,order_item_units(*)),order_payments(*),order_shipments(*)`)
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    $("orderTableBody").innerHTML = `<tr><td colspan="11" class="empty error">Gagal memuat order: ${esc(error.message)}<br><small>Pastikan SQL Admin Order Tahap 2 sudah dijalankan.</small></td></tr>`;
    return;
  }
  orders = data || [];
  applyFilters();
  updateStats();
}

function applyFilters(){
  const q = $("searchInput").value.trim().toLowerCase();
  const sf = activeShippingTab;
  const orderDate = $("orderDate")?.value || "";
  const dateSort = $("dateSort")?.value || "newest";

  filtered = orders.filter(o => {
    // Pencarian sengaja hanya No. Order, Nama, dan WhatsApp agar filter tetap sederhana.
    const hay = `${o.order_number || ""} ${o.customer_name || ""} ${o.customer_whatsapp || ""}`.toLowerCase();
    const ship = latest(o.order_shipments);
    const shippingType = inferShippingType(o, ship);
    const proofPending = (o.order_payments || []).some(p => p.proof_url && p.payment_status === "pending");
    const statMatch = activeStatFilter === "all" ||
      (activeStatFilter === "waiting" && o.order_status === "menunggu_diproses") ||
      (activeStatFilter === "proof" && proofPending) ||
      (activeStatFilter === "unpaid" && o.payment_status !== "lunas");

    return (!q || hay.includes(q)) &&
      (sf === "all" || shippingType === sf) &&
      (!orderDate || String(o.created_at || "").slice(0,10) === orderDate) &&
      statMatch;
  });

  filtered.sort((a,b) => {
    const ad = new Date(a?.created_at || 0).getTime();
    const bd = new Date(b?.created_at || 0).getTime();
    return dateSort === "oldest" ? ad - bd : bd - ad;
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
    $("orderTableBody").innerHTML = '<tr><td colspan="12" class="empty">Tidak ada order yang sesuai.</td></tr>';
    return;
  }

  $("orderTableBody").innerHTML = rows.map((o, rowIndex) => {
    const items = o.order_items || [];
    const item = items[0] || {};
    const extraItems = Math.max(0, items.length - 1);
    const variantParts = [item.variant_name, item.color].filter(Boolean).join(" · ");
    const modal = orderCostTotal(o);
    const laba = orderNetProfit(o);

    return `<tr class="order-row">
      <td class="select-col"><input class="order-checkbox order-select" type="checkbox" data-id="${o.id}" aria-label="Pilih order ${esc(o.order_number || o.id)}" ${selectedOrderIds.has(Number(o.id)) ? "checked" : ""}></td>
      <td class="table-number">${(page - 1) * pageSize + rowIndex + 1}</td>
      <td><div class="buyer-cell"><strong>${esc(o.customer_name || "-")}</strong></div></td>
      <td><div class="product-cell"><strong>${esc(item.product_name || "-")}</strong><small>${esc(variantParts || item.variant_name || "-")}${item.quantity ? ` · ${item.quantity} unit` : ""}</small>${extraItems ? `<span class="more-items">+${extraItems} produk lain</span>` : ""}</div></td>
      <td><div class="address-cell">${esc(o.customer_address || "-")}</div></td>
      <td>${o.customer_whatsapp ? `<a class="phone-link wa-shipping-link" target="_blank" rel="noopener" title="Kirim informasi pesanan dalam perjalanan" href="https://wa.me/${esc(formatWaNumber(o.customer_whatsapp))}?text=${encodeURIComponent(shippingWhatsAppText(o))}"><i class="fa-brands fa-whatsapp"></i><span>${esc(o.customer_whatsapp)}</span></a>` : "-"}</td>
      <td>${fmtDateOnly(o.created_at)}</td>
      <td><span class="pill ${orderBadge(o.order_status)}">${esc(label(o.order_status))}</span></td>
      <td><strong>${rupiah(modal)}</strong></td>
      <td><strong>${rupiah(o.total)}</strong></td>
      <td><strong class="${laba >= 0 ? "text-success" : ""}">${rupiah(laba)}</strong></td>
      <td><button class="btn primary detail-btn table-detail-btn" data-id="${o.id}" title="Buka detail order"><i class="fa-solid fa-eye"></i><span>Detail</span></button></td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".order-select").forEach(cb => cb.onchange = () => {
    const id = Number(cb.dataset.id);
    if(cb.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
    updateBulkSelectionUI();
  });
  updateBulkSelectionUI();
  document.querySelectorAll(".detail-btn").forEach(b => b.onclick = () => openDetail(Number(b.dataset.id)));
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

async function loadOrderFinanceSettings(orderId){
  const { data, error } = await client.rpc('admin_get_product_order_finance_settings',{p_order_id:orderId});
  if(error){
    console.warn('Gagal memuat pengaturan tagihan:', error);
    return null;
  }
  return data || null;
}

async function loadOrderWarranties(orderId){
  const { data, error } = await client.rpc('admin_get_product_order_warranties',{p_order_id:orderId});
  if(error){
    console.warn('Gagal memuat garansi:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

function isoDate(v){
  if(!v) return '';
  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return String(v).slice(0,10);
  return d.toISOString().slice(0,10);
}

function addDurationDate(start, value, unit){
  if(!start || !value) return '';
  const d = new Date(start + 'T00:00:00');
  const n = Number(value || 0);
  if(unit === 'hari') d.setDate(d.getDate()+n);
  else if(unit === 'bulan') d.setMonth(d.getMonth()+n);
  else if(unit === 'tahun') d.setFullYear(d.getFullYear()+n);
  return d.toISOString().slice(0,10);
}

function warrantyStatus(w){
  if(!w?.is_active) return {label:'Nonaktif', cls:'danger'};
  const today = new Date(); today.setHours(0,0,0,0);
  const start = w.warranty_start ? new Date(w.warranty_start+'T00:00:00') : null;
  const end = w.warranty_end ? new Date(w.warranty_end+'T23:59:59') : null;
  if(start && today < start) return {label:'Belum Mulai', cls:'warn'};
  if(end && today > end) return {label:'Habis', cls:'danger'};
  return {label:'Aktif', cls:'ok'};
}

function buildWarrantyManager(order){
  const units=[];
  (order.order_items || []).forEach(item => {
    (item.order_item_units || []).forEach((u,idx)=>units.push({
      ...u,
      item_name:item.product_name || '-',
      variant_name:item.variant_name || '',
      unit_label:`${item.product_name || 'Produk'} · Unit ${idx+1}`
    }));
  });
  if(!units.length){
    return `<div class="notice">Isi IMEI / unit fisik terlebih dahulu sebelum mengatur garansi.</div>`;
  }

  const activeCount=currentDetailWarranties.filter(w=>warrantyStatus(w).label==='Aktif').length;
  const expiredCount=currentDetailWarranties.filter(w=>warrantyStatus(w).label==='Habis').length;

  return `<div class="warranty-summary-v12">
    <div><span>Total Unit</span><strong>${units.length}</strong></div>
    <div><span>Garansi Aktif</span><strong>${activeCount}</strong></div>
    <div><span>Garansi Habis</span><strong>${expiredCount}</strong></div>
  </div>
  <div class="warranty-help-v12"><i class="fa-solid fa-circle-info"></i><span>Preset CEO: <b>Tukar Unit 1 Bulan</b> + <b>Service 1 Tahun</b>. Tanggal mulai dapat disesuaikan sebelum disimpan.</span></div>
  <div class="warranty-unit-list">${units.map(u=>{
    const rows=currentDetailWarranties
      .filter(w=>Number(w.order_item_unit_id)===Number(u.id))
      .sort((a,b)=>String(b.warranty_start||'').localeCompare(String(a.warranty_start||'')));
    const hasSwap=rows.some(w=>String(w.warranty_type||'').toLowerCase()==='tukar unit' && w.is_active!==false);
    const hasService=rows.some(w=>String(w.warranty_type||'').toLowerCase()==='service' && w.is_active!==false);
    return `<article class="warranty-unit-card" data-unit-id="${u.id}">
      <div class="warranty-unit-head">
        <div><strong>${esc(u.unit_label)}</strong><span>IMEI ${esc(u.imei1 || '-')} ${u.serial_number ? `· SN ${esc(u.serial_number)}` : ''}</span></div>
        <div class="warranty-unit-actions">
          ${(!hasSwap || !hasService) ? `<button class="btn success warranty-standard-btn" type="button" data-missing-swap="${hasSwap?'0':'1'}" data-missing-service="${hasService?'0':'1'}"><i class="fa-solid fa-wand-magic-sparkles"></i> Garansi Standar</button>` : ''}
          <button class="btn soft add-warranty-btn" type="button"><i class="fa-solid fa-plus"></i> Tambah Manual</button>
        </div>
      </div>
      <div class="warranty-history-label"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Garansi</div>
      <div class="warranty-list">${rows.length ? rows.map(w=>buildWarrantyRow(w)).join('') : '<div class="warranty-empty">Belum ada garansi untuk unit ini.</div>'}</div>
      <div class="warranty-editor" hidden></div>
    </article>`;
  }).join('')}</div>`;
}

function buildWarrantyRow(w){
  const st=warrantyStatus(w);
  const dur=w.duration_value ? `${w.duration_value} ${labelDurationUnit(w.duration_unit)}` : 'Durasi manual';
  return `<div class="warranty-row" data-warranty-id="${w.id}">
    <div class="warranty-row-main">
      <div class="warranty-row-title"><strong>${esc(w.warranty_type || 'Garansi')}</strong><span class="pill ${st.cls}">${st.label}</span></div>
      <div class="warranty-period"><span><i class="fa-regular fa-calendar"></i> Mulai <b>${esc(isoDate(w.warranty_start) || '-')}</b></span><span><i class="fa-regular fa-calendar-check"></i> Berakhir <b>${esc(isoDate(w.warranty_end) || '-')}</b></span><span><i class="fa-regular fa-hourglass-half"></i> ${esc(dur)}</span></div>
      ${w.warranty_note ? `<small>${esc(w.warranty_note)}</small>` : ''}
    </div>
    <button class="btn soft edit-warranty-btn" type="button"><i class="fa-solid fa-pen"></i> Edit</button>
  </div>`;
}

function labelDurationUnit(u){ return ({hari:'Hari',bulan:'Bulan',tahun:'Tahun'})[u] || u || '-'; }

function warrantyEditorHtml(unitId, w=null){
  const start=isoDate(w?.warranty_start) || new Date().toISOString().slice(0,10);
  const durationValue=Number(w?.duration_value || 1);
  const durationUnit=w?.duration_unit || 'bulan';
  const end=isoDate(w?.warranty_end) || addDurationDate(start,durationValue,durationUnit);
  return `<div class="warranty-editor-form" data-unit-id="${unitId}" data-warranty-id="${w?.id || ''}">
    <div class="simple-form-grid warranty-grid">
      <label>Jenis Garansi<select class="warranty-type">
        ${['Tukar Unit','Service','Distributor','Toko','Lainnya'].map(v=>`<option value="${v}" ${w?.warranty_type===v?'selected':''}>${v}</option>`).join('')}
      </select></label>
      <label>Durasi<div class="duration-inline"><input class="warranty-duration" type="number" min="1" value="${durationValue}"><select class="warranty-duration-unit"><option value="hari" ${durationUnit==='hari'?'selected':''}>Hari</option><option value="bulan" ${durationUnit==='bulan'?'selected':''}>Bulan</option><option value="tahun" ${durationUnit==='tahun'?'selected':''}>Tahun</option></select></div></label>
      <label>Tanggal Mulai<input class="warranty-start" type="date" value="${start}"></label>
      <label>Tanggal Berakhir<input class="warranty-end" type="date" value="${end}" readonly></label>
      <label class="span-2">Catatan Garansi<textarea class="warranty-note" rows="2" placeholder="Contoh: tidak berlaku untuk pecah, cairan, atau segel rusak">${esc(w?.warranty_note || '')}</textarea></label>
      <label class="warranty-active-label"><input class="warranty-active" type="checkbox" ${w?.is_active===false?'':'checked'}> Garansi aktif</label>
    </div>
    <div class="warranty-editor-actions"><button class="btn primary save-warranty-btn" type="button"><i class="fa-solid fa-floppy-disk"></i> Simpan Garansi</button><button class="btn soft cancel-warranty-btn" type="button">Batal</button></div>
  </div>`;
}

function buildPaymentTerms(order){
  const t=currentDetailTerms || {};
  const useTempo=!!t.use_tempo;
  const currentMethod=order.payment_method || 'transfer';
  return `<div class="billing-control-card">
    <div class="billing-control-head">
      <div><b>Pengaturan Pembayaran</b><small>Atur metode pembayaran dan tempo bila diperlukan.</small></div>
      <span class="pill ${order.payment_status==='lunas'?'ok':useTempo?'warn':'info'}">${order.payment_status==='lunas'?'Lunas':useTempo?'Tempo Aktif':'Pembayaran Berjalan'}</span>
    </div>
    <div class="payment-admin-grid">
      <label>Metode Pembayaran
        <select id="adminPaymentMethod">
          <option value="transfer" ${currentMethod==='transfer'?'selected':''}>Transfer Bank</option>
          <option value="cash" ${currentMethod==='cash'?'selected':''}>Cash / Tunai</option>
        </select>
      </label>
      <label class="billing-check tempo-toggle"><input id="useTempo" type="checkbox" ${useTempo?'checked':''}> Gunakan pembayaran tempo</label>
      <label class="tempo-field">Tempo (hari)<input id="tempoDays" type="number" min="0" value="${Number(t.tempo_days || 0)}" ${useTempo?'':'disabled'}></label>
      <label class="tempo-field">Jatuh Tempo<input id="dueDate" type="date" value="${esc(isoDate(t.due_date))}" ${useTempo?'':'disabled'}></label>
      <label class="span-2">Catatan Pembayaran<textarea id="billingNote" rows="2" placeholder="Opsional — contoh: pelunasan tanggal 30 sesuai kesepakatan">${esc(t.note || '')}</textarea></label>
    </div>
    <div class="billing-actions"><button id="saveBillingBtn" class="btn soft" type="button"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan Pembayaran</button></div>
  </div>`;
}

function buildManualPaymentForm(order){
  const remaining=Number(order.remaining_amount || 0);
  if(order.payment_status==='lunas' || remaining<=0){
    return `<div class="payment-complete-banner"><i class="fa-solid fa-circle-check"></i><div><strong>Pembayaran Lunas</strong><small>Seluruh tagihan pesanan ini sudah dibayar.</small></div></div>`;
  }
  return `<div class="manual-payment-card">
    <div class="manual-payment-head"><div><b>Catat Pembayaran</b><small>Gunakan saat pembeli membayar DP, cicilan, atau pelunasan.</small></div><strong>${rupiah(remaining)} <small>sisa</small></strong></div>
    <div class="manual-payment-grid">
      <label>Metode<select id="manualPaymentMethod"><option value="transfer" ${order.payment_method==='transfer'?'selected':''}>Transfer Bank</option><option value="cash" ${order.payment_method==='cash'?'selected':''}>Cash / Tunai</option></select></label>
      <label>Nominal Dibayar<input id="manualPaymentAmount" inputmode="numeric" value="${remaining}"></label>
      <label>Referensi<input id="manualPaymentReference" placeholder="Opsional"></label>
      <label>Catatan<input id="manualPaymentNote" placeholder="Contoh: DP / pelunasan"></label>
    </div>
    <div class="payment-quick-amounts">
      <button type="button" class="quick-pay-amount" data-pay-percent="50">50% Sisa</button>
      <button type="button" class="quick-pay-amount" data-pay-full="1">Bayar Lunas</button>
    </div>
    <div class="billing-actions"><button id="addManualPaymentBtn" class="btn success" type="button"><i class="fa-solid fa-circle-plus"></i> Simpan Pembayaran</button></div>
  </div>`;
}

async function openDetail(id){
  const o = orders.find(x => Number(x.id) === Number(id));
  if(!o) return;

  currentOrderId = o.id;
  $("detailOrderNumber").textContent = o.order_number || `Order #${o.id}`;
  $("detailContent").innerHTML = '<div class="detail-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat detail...</div>';
  $("detailModal").classList.add("show");
  $("detailModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const [terms,warranties] = await Promise.all([loadOrderFinanceSettings(o.id),loadOrderWarranties(o.id)]);
  currentDetailTerms=terms;
  currentDetailWarranties=warranties;

  const items = o.order_items || [];
  const pay = latest(o.order_payments);
  const ship = latest(o.order_shipments);
  const shippingType = inferShippingType(o, ship);
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const assignedUnits = countAssignedUnits(o);
  const paymentHistory = buildPaymentHistory(o);
  const mapLink = (o.latitude != null && o.longitude != null) ? `https://www.google.com/maps?q=${encodeURIComponent(o.latitude)},${encodeURIComponent(o.longitude)}` : null;
  const wa = formatWaNumber(o.customer_whatsapp);
  const billingWaText = encodeURIComponent(billingWhatsAppText(o));

  const canManageOrderItems = ['admin','superadmin'].includes(currentUserRole);
  const productHtml = items.map((i, idx) => {
    const units = (i.order_item_units || []).slice().sort((a,b)=>Number(a.id)-Number(b.id));
    const unitText = units.length ? units.map((u,n)=>`<span class="unit-inline"><b>Unit ${n+1}</b> · IMEI ${esc(u.imei1 || '-')} ${u.imei2 ? `· IMEI 2 ${esc(u.imei2)}` : ''} ${u.serial_number ? `· SN ${esc(u.serial_number)}` : ''}</span>`).join('') : '<span class="unit-inline empty-unit">IMEI belum ditetapkan</span>';
    return `<article class="simple-product-row product-manage-row">
      ${canManageOrderItems ? `<label class="product-select-box" title="Pilih produk"><input type="checkbox" class="detail-product-check" value="${Number(i.id)}"><span></span></label>` : ''}
      <div class="item-number">${idx+1}</div>
      <div class="simple-product-main"><strong>${esc(i.product_name || '-')}</strong><span>${esc([i.variant_name, i.color, i.ram ? `RAM ${i.ram}` : '', i.storage ? `Storage ${i.storage}` : ''].filter(Boolean).join(' · ') || 'Varian standar')}</span><div class="unit-inline-list">${unitText}</div></div>
      <div class="simple-product-price"><small>${Number(i.quantity || 0)} × ${rupiah(i.unit_price)}</small><strong>${rupiah(i.subtotal)}</strong></div>
    </article>`;
  }).join('') || '<div class="notice">Item tidak ditemukan.</div>';

  const productManageBar = canManageOrderItems && items.length ? `<div class="product-manage-bar">
    <div><strong>Kelola Produk Order</strong><small>Pilih item yang salah lalu hapus dari pesanan.</small></div>
    <div class="product-manage-actions">
      <label class="select-all-products"><input type="checkbox" id="selectAllDetailProducts"> Pilih Semua</label>
      <button class="btn danger" id="deleteSelectedProductsBtn" type="button" disabled><i class="fa-solid fa-trash"></i> Hapus Produk Terpilih</button>
    </div>
  </div>` : '';

  $("detailContent").innerHTML = `
    <div class="detail-body simple-order-detail">
      <section class="simple-order-head"><div><div class="simple-status-row"><span class="pill ${orderBadge(o.order_status)}">${esc(label(o.order_status))}</span><span class="pill ${paymentBadge(o.payment_status)}">${esc(label(o.payment_status))}</span>${currentDetailTerms?.use_tempo?'<span class="pill warn">Tempo</span>':''}</div><p>${esc(o.customer_name || '-')} · ${fmtDate(o.created_at)} · ${items.length} produk / ${totalQty} unit</p></div><div class="simple-head-total"><span>Total</span><strong>${rupiah(o.total)}</strong></div></section>
      <div class="simple-quick-actions">${wa ? `<a class="btn success" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${billingWaText}"><i class="fa-brands fa-whatsapp"></i> Kirim Tagihan</a>` : ''}<a class="btn primary" target="_blank" rel="noopener" href="nota-produk.html?id=${encodeURIComponent(o.id)}"><i class="fa-solid fa-file-invoice"></i> Lihat Invoice</a><button class="btn soft quick-copy" data-copy="${esc(o.order_number || '')}"><i class="fa-regular fa-copy"></i> Salin Order</button>${mapLink ? `<a class="btn soft" target="_blank" rel="noopener" href="${mapLink}"><i class="fa-solid fa-location-dot"></i> Lokasi</a>` : ''}</div>

      <section class="simple-section-card"><div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-user"></i></span><div><h3>Data Pesanan</h3><small>Informasi pelanggan dan metode transaksi</small></div></div><div class="simple-info-grid"><div><span>Nama</span><strong>${esc(o.customer_name || '-')}</strong></div><div><span>WhatsApp</span>${wa ? `<a class="detail-wa-billing" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${billingWaText}"><i class="fa-brands fa-whatsapp"></i><strong>${esc(o.customer_whatsapp || "-")}</strong><small>Klik untuk kirim tagihan + link invoice</small></a>` : `<strong>-</strong>`}</div><div><span>Email</span><strong>${esc(o.customer_email || '-')}</strong></div><div><span>Pengiriman</span><strong>${esc(shippingLabel(o, ship))}</strong></div><div><span>Pembayaran</span><strong>${esc(label(o.payment_method))}</strong></div><div><span>Tanggal Order</span><strong>${fmtDate(o.created_at)}</strong></div><div class="span-2"><span>Alamat</span><strong>${esc(o.customer_address || '-')}</strong></div></div>${o.customer_note ? `<div class="note-box"><b>Catatan pelanggan</b><br>${esc(o.customer_note)}</div>` : ''}</section>

      <section class="simple-section-card"><div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-mobile-screen-button"></i></span><div><h3>Produk yang Dibeli</h3><small>${totalQty} unit · IMEI terisi ${assignedUnits}/${totalQty}</small></div></div>${productManageBar}<div class="simple-products">${productHtml}</div><details class="simple-collapse imei-collapse"><summary><span><i class="fa-solid fa-barcode"></i> Kelola IMEI / Unit Fisik</span><small>${assignedUnits}/${totalQty} unit terisi</small></summary><div class="collapse-body imei-products">${items.map(i => buildUnitManager(i)).join('') || '<div class="notice">Item tidak ditemukan.</div>'}</div></details></section>

      <section class="simple-section-card payment-section-v11"><div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-wallet"></i></span><div><h3>Pembayaran & Tagihan</h3><small>Kelola tagihan, pembayaran sebagian, pelunasan, dan tempo</small></div></div><div class="finance-highlight-grid"><div class="finance-highlight"><span>Harga Modal Produk</span><strong>${rupiah(orderCostTotal(o))}</strong><small>Total modal unit terjual</small></div><div class="finance-highlight total-card"><span>Total Tagihan</span><strong>${rupiah(o.total)}</strong><small>Produk + ongkir − diskon</small></div><div class="finance-highlight profit"><span>Laba Bersih Produk</span><strong>${rupiah(orderNetProfit(o))}</strong><small>Penjualan produk − modal</small></div></div><div class="payment-balance-strip ${Number(o.remaining_amount||0)>0?'unpaid':'paid'}"><div><span>Sudah Dibayar</span><strong>${rupiah(o.amount_paid)}</strong></div><div><span>Sisa Tagihan</span><strong>${rupiah(o.remaining_amount)}</strong></div><span class="pill ${paymentBadge(o.payment_status)}">${esc(label(o.payment_status))}</span></div><div class="simple-money-grid compact-money-grid"><div><span>Subtotal Produk</span><strong>${rupiah(o.subtotal)}</strong></div><div><span>Diskon</span><strong>${Number(o.discount || 0) ? `- ${rupiah(o.discount)}` : rupiah(0)}</strong></div><div><span>Ongkir</span><strong>${rupiah(o.shipping_fee)}</strong></div><div class="money-total"><span>Total Pesanan</span><strong>${rupiah(o.total)}</strong></div><div><span>Sudah Dibayar</span><strong class="text-success">${rupiah(o.amount_paid)}</strong></div><div class="${Number(o.remaining_amount || 0) > 0 ? 'has-balance' : 'is-paid'}"><span>Sisa Tagihan</span><strong>${rupiah(o.remaining_amount)}</strong></div></div>${buildSimplePaymentAction(o, pay)}${buildPaymentTerms(o)}${buildManualPaymentForm(o)}<details class="simple-collapse payment-history-collapse"><summary><span><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Pembayaran</span><small>${(o.order_payments || []).length} transaksi</small></summary><div class="collapse-body">${paymentHistory}</div></details></section>

      <section class="simple-section-card"><div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-shield-halved"></i></span><div><h3>Garansi Produk</h3><small>Satu unit dapat memiliki beberapa jenis garansi</small></div></div>${buildWarrantyManager(o)}</section>

      <section class="simple-section-card shipping-status-card-v13">
        <div class="simple-section-title"><span class="card-icon"><i class="fa-solid fa-truck-fast"></i></span><div><h3>Pengiriman & Status Pesanan</h3><small>Metode, ongkir, kurir/resi, dan progres order dalam satu bagian</small></div></div>
        <div class="shipping-summary-v13"><div><span>Metode</span><strong id="shippingTypePreview">${esc(shippingLabel(o, ship))}</strong></div><div><span>Ongkir</span><strong id="shippingFeePreview">${rupiah(o.shipping_fee)}</strong></div><div><span>Status</span><strong id="orderStatusPreview">${esc(label(o.order_status))}</strong></div></div>
        <div class="simple-form-grid shipping-form-v13">
          <label>Metode Pengiriman<select id="adminShippingType"><option value="pickup" ${shippingType==='pickup'?'selected':''}>Ambil di Toko</option><option value="instant" ${shippingType==='instant'?'selected':''}>Kurir Instan</option><option value="package" ${shippingType==='package'?'selected':''}>Kirim Paket</option><option value="cod" ${shippingType==='cod'?'selected':''}>COD Lokal</option></select></label>
          <label class="shipping-fee-wrap">Biaya Pengiriman<input id="shippingFee" inputmode="numeric" value="${Number(o.shipping_fee || 0)}"></label>
          <label class="shipping-courier-wrap">Kurir / Ekspedisi<input id="shippingCourier" value="${esc(ship?.courier || '')}" placeholder="Gojek, Grab, Maxim, JNE, J&T, dll."></label>
          <label class="shipping-tracking-wrap">Nomor Resi / Referensi<input id="trackingNumber" value="${esc(ship?.tracking_number || '')}" placeholder="Isi bila tersedia"></label>
          <label>Status Pesanan<select id="adminOrderStatus">${["menunggu_diproses","dikemas","dikirim","dalam_perjalanan","selesai","dibatalkan"].map(v=>`<option value="${v}" ${o.order_status===v?'selected':''}>${v==='menunggu_diproses'?'Menunggu':esc(label(v))}</option>`).join('')}</select></label>
          <label class="span-2">Catatan Admin / Pengiriman<textarea id="adminNote" rows="2" placeholder="Opsional">${esc(o.admin_note || '')}</textarea></label>
        </div>
        <div class="shipping-hint-v13" id="shippingHintV13"></div>
        <div class="status-flow-v13">${["menunggu_diproses","dikemas","dikirim","dalam_perjalanan","selesai"].map((v,i)=>`<div class="status-flow-step"><span>${i+1}</span><small>${v==='menunggu_diproses'?'Menunggu':label(v)}</small></div>`).join('')}</div>
        <div class="single-save-row"><button class="btn soft close-order-detail" id="closeOrderDetailBtn" type="button"><i class="fa-solid fa-xmark"></i> Tutup</button><button class="btn primary save-order-changes" id="saveOrderChangesBtn" type="button"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan</button></div>
      </section>
    </div>`;

  if(pay?.proof_url) document.querySelectorAll('.view-current-proof').forEach(btn => btn.onclick = () => viewProof(pay.proof_url));
  document.querySelectorAll('.payment-history-proof').forEach(btn => btn.addEventListener('click', () => viewProof(btn.dataset.proofPath)));
  document.querySelectorAll('.quick-copy').forEach(btn => btn.addEventListener('click', async () => { const value=btn.dataset.copy||''; if(!value)return; try{await navigator.clipboard.writeText(value);const old=btn.innerHTML;btn.innerHTML='<i class="fa-solid fa-check"></i> Tersalin';setTimeout(()=>btn.innerHTML=old,1200);}catch{prompt('Salin data berikut:',value);} }));
  bindProductItemActions(o);
  bindUnitActions(o);
  bindWarrantyActions(o);
  bindSimpleAdminActions(o, pay, ship, shippingType);
}

function buildSimplePaymentAction(o, pay){
  if(!pay) return `<div class="simple-payment-action"><div class="notice">Belum ada pembayaran dari pembeli. Admin tetap dapat mencatat pembayaran manual di bawah.</div></div>`;
  if(pay.payment_status === 'paid') return `<div class="simple-payment-action payment-ok"><div><i class="fa-solid fa-circle-check"></i><span><b>Pembayaran terakhir terverifikasi</b><small>${rupiah(pay.amount)} · ${fmtDate(pay.paid_at || pay.created_at)}</small></span></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-image"></i> Lihat Bukti</button>' : ''}</div>`;
  if(pay.payment_status === 'rejected') return `<div class="simple-payment-action payment-rejected"><div><i class="fa-solid fa-circle-xmark"></i><span><b>Pembayaran terakhir ditolak</b><small>${esc(pay.note || 'Bukti/pembayaran ditolak.')}</small></span></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-image"></i> Lihat Bukti</button>' : ''}</div>`;
  const canApprove = o.payment_method !== 'transfer' || !!pay.proof_url;
  return `<div class="simple-payment-review"><div class="review-head"><div><b>Bukti pembayaran menunggu verifikasi</b><small>Nominal boleh disesuaikan dengan jumlah yang benar-benar diterima.</small></div>${pay.proof_url ? '<button class="btn soft view-current-proof"><i class="fa-solid fa-eye"></i> Lihat Bukti</button>' : ''}</div><div class="review-fields"><label>Nominal diterima<input id="paymentAmount" inputmode="numeric" value="${Number(pay.amount || o.remaining_amount || o.total || 0)}"></label><label>Catatan<input id="paymentNote" value="" placeholder="Opsional"></label></div><div class="review-actions"><button class="btn success" id="approvePaymentBtn" ${canApprove ? '' : 'disabled'}><i class="fa-solid fa-check"></i> Terima Pembayaran</button><button class="btn danger" id="rejectPaymentBtn"><i class="fa-solid fa-xmark"></i> Tolak</button></div>${!canApprove ? '<small class="helper">Transfer belum dapat disetujui karena bukti belum tersedia.</small>' : ''}</div>`;
}

function bindBillingFields(){
  const use=$('useTempo'), days=$('tempoDays'), due=$('dueDate');
  if(!use) return;
  const sync=()=>{ days.disabled=!use.checked; due.disabled=!use.checked; };
  use.addEventListener('change',sync); sync();
  days?.addEventListener('input',()=>{ if(use.checked && Number(days.value)>0) due.value=addDurationDate(new Date().toISOString().slice(0,10),Number(days.value),'hari'); });
}

function bindWarrantyActions(order){
  document.querySelectorAll('.warranty-standard-btn').forEach(btn=>btn.onclick=async()=>{
    const card=btn.closest('.warranty-unit-card');
    const unitId=Number(card.dataset.unitId);
    const addSwap=btn.dataset.missingSwap==='1';
    const addService=btn.dataset.missingService==='1';
    const startDate=new Date().toISOString().slice(0,10);
    const items=[];
    if(addSwap) items.push({type:'Tukar Unit',value:1,unit:'bulan',note:'Garansi tukar unit CEO Part & Service'});
    if(addService) items.push({type:'Service',value:1,unit:'tahun',note:'Garansi service CEO Part & Service'});
    if(!items.length) return;
    if(!confirm(`Terapkan garansi standar untuk unit ini?\n\n${items.map(x=>`• ${x.type} ${x.value} ${labelDurationUnit(x.unit)}`).join('\n')}\n\nTanggal mulai: ${startDate}`)) return;
    setBusy(btn,true,'Menyimpan...');
    for(const item of items){
      const {error}=await client.rpc('admin_save_product_warranty_v2',{
        p_unit_id:unitId,p_warranty_id:null,p_type:item.type,p_duration_value:item.value,
        p_duration_unit:item.unit,p_start:startDate,p_note:item.note,p_is_active:true
      });
      if(error){
        console.error(error);
        alert('Gagal menyimpan garansi standar: '+error.message);
        setBusy(btn,false);
        return;
      }
    }
    alert('Garansi standar berhasil dibuat ✅');
    await reloadAndReopen(order.id);
  });

  document.querySelectorAll('.add-warranty-btn').forEach(btn=>btn.onclick=()=>{
    const card=btn.closest('.warranty-unit-card'); const ed=card.querySelector('.warranty-editor'); ed.hidden=false; ed.innerHTML=warrantyEditorHtml(Number(card.dataset.unitId)); bindWarrantyEditor(ed,order);
  });
  document.querySelectorAll('.edit-warranty-btn').forEach(btn=>btn.onclick=()=>{
    const row=btn.closest('.warranty-row'); const card=btn.closest('.warranty-unit-card'); const w=currentDetailWarranties.find(x=>Number(x.id)===Number(row.dataset.warrantyId)); const ed=card.querySelector('.warranty-editor'); ed.hidden=false; ed.innerHTML=warrantyEditorHtml(Number(card.dataset.unitId),w); bindWarrantyEditor(ed,order);
  });
}

function bindWarrantyEditor(ed,order){
  const form=ed.querySelector('.warranty-editor-form');
  const start=form.querySelector('.warranty-start'), val=form.querySelector('.warranty-duration'), unit=form.querySelector('.warranty-duration-unit'), end=form.querySelector('.warranty-end');
  const recalc=()=>{ end.value=addDurationDate(start.value,Number(val.value||0),unit.value); };
  [start,val,unit].forEach(x=>x?.addEventListener('change',recalc)); val?.addEventListener('input',recalc);
  form.querySelector('.cancel-warranty-btn').onclick=()=>{ ed.hidden=true; ed.innerHTML=''; };
  form.querySelector('.save-warranty-btn').onclick=async e=>{
    const btn=e.currentTarget; const duration=Number(val.value||0); if(duration<=0)return alert('Durasi garansi harus lebih dari 0.'); if(!start.value)return alert('Tanggal mulai garansi wajib diisi.');
    setBusy(btn,true,'Menyimpan...');
    const {error}=await client.rpc('admin_save_product_warranty_v2',{p_unit_id:Number(form.dataset.unitId),p_warranty_id:form.dataset.warrantyId?Number(form.dataset.warrantyId):null,p_type:form.querySelector('.warranty-type').value,p_duration_value:duration,p_duration_unit:unit.value,p_start:start.value,p_note:form.querySelector('.warranty-note').value.trim()||null,p_is_active:form.querySelector('.warranty-active').checked});
    if(error){console.error(error);alert('Gagal menyimpan garansi: '+error.message);setBusy(btn,false);return;}
    alert('Garansi berhasil disimpan ✅'); await reloadAndReopen(order.id);
  };
}

function bindSimpleAdminActions(o, pay, ship, shippingType){
  const approveBtn = $("approvePaymentBtn"), rejectBtn = $("rejectPaymentBtn"), saveBtn = $("saveOrderChangesBtn"), closeDetailBtn = $("closeOrderDetailBtn"), statusSelect = $("adminOrderStatus"), saveBillingBtn=$("saveBillingBtn"), addManualBtn=$("addManualPaymentBtn");
  if(closeDetailBtn) closeDetailBtn.onclick = closeModal;
  bindBillingFields();
  const shippingTypeSelect=$("adminShippingType");
  const refreshShippingV13=()=>{
    const type=shippingTypeSelect?.value || shippingType;
    const feeWrap=document.querySelector('.shipping-fee-wrap'), courierWrap=document.querySelector('.shipping-courier-wrap'), trackingWrap=document.querySelector('.shipping-tracking-wrap'), hint=$("shippingHintV13");
    if(feeWrap) feeWrap.style.display=type==='pickup'?'none':'';
    if(courierWrap) courierWrap.style.display=type==='pickup'?'none':'';
    if(trackingWrap) trackingWrap.style.display=type==='package'?'':'none';
    if(type==='pickup' && $("shippingFee")) $("shippingFee").value=0;
    const labels={pickup:'Ambil di Toko',instant:'Kurir Instan',package:'Kirim Paket',cod:'COD Lokal'};
    if($("shippingTypePreview")) $("shippingTypePreview").textContent=labels[type]||'Pengiriman';
    if(hint){
      const h={pickup:'Ambil di Toko: ongkir, kurir, dan resi tidak diperlukan.',instant:'Kurir Instan: isi Gojek, Grab, Maxim, Shopee, atau jasa instan lainnya dan ongkir aktual.',package:'Kirim Paket: isi ekspedisi dan nomor resi saat paket sudah dikirim.',cod:'COD Lokal: area maksimal 5 km. Isi ongkir dan kurir/petugas bila diperlukan.'};
      hint.innerHTML='<i class="fa-solid fa-circle-info"></i> '+h[type];
    }
  };
  if(shippingTypeSelect) shippingTypeSelect.onchange=refreshShippingV13;
  if($("shippingFee")) $("shippingFee").oninput=()=>{if($("shippingFeePreview"))$("shippingFeePreview").textContent=rupiah(numericValue("shippingFee"));};
  refreshShippingV13();
  document.querySelectorAll('.quick-pay-amount').forEach(btn=>btn.onclick=()=>{
    const input=$('manualPaymentAmount'); if(!input) return;
    const remaining=Number(o.remaining_amount||0);
    input.value = btn.dataset.payFull ? remaining : Math.max(1, Math.round(remaining * (Number(btn.dataset.payPercent||100)/100)));
  });
  if(statusSelect) statusSelect.addEventListener('change',()=>{const preview=$("autoShippingStatusPreview");if(preview)preview.value=label(autoShippingStatus(statusSelect.value));});

  if(approveBtn) approveBtn.onclick = async () => { const amount=numericValue('paymentAmount'); if(amount<=0)return alert('Nominal pembayaran harus lebih dari 0.'); if(amount>Number(o.remaining_amount||o.total||0))return alert('Nominal tidak boleh melebihi sisa tagihan.'); if(!confirm(`Terima pembayaran ${rupiah(amount)} untuk ${o.order_number}?`))return; setBusy(approveBtn,true,'Memproses...'); const {error}=await client.rpc('admin_review_product_payment',{p_order_id:o.id,p_payment_id:pay.id,p_action:'approve',p_amount:amount,p_note:$("paymentNote")?.value.trim()||null}); if(error){console.error(error);alert('Gagal verifikasi pembayaran: '+error.message);setBusy(approveBtn,false);return;} await reloadAndReopen(o.id); };
  if(rejectBtn) rejectBtn.onclick = async () => { const note=$("paymentNote")?.value.trim()||'Bukti/pembayaran ditolak admin.'; if(!confirm(`Tolak pembayaran untuk ${o.order_number}?`))return; setBusy(rejectBtn,true,'Memproses...'); const {error}=await client.rpc('admin_review_product_payment',{p_order_id:o.id,p_payment_id:pay.id,p_action:'reject',p_amount:null,p_note:note}); if(error){console.error(error);alert('Gagal menolak pembayaran: '+error.message);setBusy(rejectBtn,false);return;} await reloadAndReopen(o.id); };

  if(saveBillingBtn) saveBillingBtn.onclick=async()=>{ const useTempo=$('useTempo').checked; const tempoDays=Number($('tempoDays').value||0); let due=$('dueDate').value||null; const method=$('adminPaymentMethod').value; if(useTempo && !due && tempoDays>0){due=addDurationDate(new Date().toISOString().slice(0,10),tempoDays,'hari');} if(useTempo && !due)return alert('Isi jumlah hari tempo atau tanggal jatuh tempo.'); setBusy(saveBillingBtn,true,'Menyimpan...'); const {error:methodError}=await client.rpc('admin_set_product_payment_method',{p_order_id:o.id,p_payment_method:method}); if(methodError){console.error(methodError);alert('Gagal menyimpan metode pembayaran: '+methodError.message+'\n\nPastikan SQL V11 sudah dijalankan.');setBusy(saveBillingBtn,false);return;} const {error}=await client.rpc('admin_save_product_order_terms',{p_order_id:o.id,p_use_tempo:useTempo,p_tempo_days:useTempo?tempoDays:0,p_due_date:useTempo?due:null,p_note:$('billingNote').value.trim()||null}); if(error){console.error(error);alert('Gagal menyimpan aturan tagihan: '+error.message);setBusy(saveBillingBtn,false);return;} alert('Pengaturan pembayaran berhasil disimpan ✅'); await reloadAndReopen(o.id); };

  if(addManualBtn) addManualBtn.onclick=async()=>{ const amount=numericValue('manualPaymentAmount'); if(amount<=0)return alert('Nominal pembayaran harus lebih dari 0.'); if(amount>Number(o.remaining_amount||0))return alert(`Nominal melebihi sisa tagihan ${rupiah(o.remaining_amount)}.`); if(!confirm(`Catat pembayaran tambahan ${rupiah(amount)}?`))return; setBusy(addManualBtn,true,'Mencatat...'); const {error}=await client.rpc('admin_add_product_payment',{p_order_id:o.id,p_payment_method:$('manualPaymentMethod').value,p_amount:amount,p_reference_number:$('manualPaymentReference').value.trim()||null,p_note:$('manualPaymentNote').value.trim()||null}); if(error){console.error(error);alert('Gagal mencatat pembayaran: '+error.message);setBusy(addManualBtn,false);return;} alert('Pembayaran tambahan berhasil dicatat ✅'); await reloadAndReopen(o.id); };

  if(saveBtn) saveBtn.onclick = async () => {
    const orderStatus=$("adminOrderStatus").value;
    const type=$("adminShippingType")?.value || shippingType;
    const readiness=getOperationalReadiness(o);
    if(['dikirim','dalam_perjalanan','selesai'].includes(orderStatus)&&!readiness.imeiReady){alert(`Lengkapi IMEI / unit fisik terlebih dahulu. Saat ini ${readiness.assignedUnits} dari ${readiness.requiredUnits} unit sudah ditetapkan.`);return;}
    const fee=type==='pickup'?0:numericValue('shippingFee');
    const courier=type==='pickup'?null:($("shippingCourier")?.value.trim()||null);
    const tracking=type==='package'?($("trackingNumber")?.value.trim()||null):null;
    if(type!=='pickup' && ['dikirim','dalam_perjalanan'].includes(orderStatus) && !courier)return alert('Isi kurir / ekspedisi terlebih dahulu.');
    if(type==='package' && ['dikirim','dalam_perjalanan','selesai'].includes(orderStatus) && !tracking)return alert('Nomor resi wajib diisi untuk Kirim Paket yang sudah dikirim.');
    if(orderStatus==='selesai' && o.payment_status!=='lunas' && !confirm('Pembayaran belum Lunas. Tetap tandai pesanan sebagai Selesai?'))return;
    if(orderStatus==='selesai'&&!confirm(`Tandai ${o.order_number} sebagai SELESAI?`))return;
    if(orderStatus==='dibatalkan'&&!confirm(`Batalkan ${o.order_number}?`))return;
    setBusy(saveBtn,true,'Menyimpan...');
    const {error:typeError}=await client.rpc('admin_set_product_shipping_type_v13',{p_order_id:o.id,p_shipping_type:type});
    if(typeError){console.error(typeError);alert('Gagal menyimpan metode pengiriman: '+typeError.message+'\n\nPastikan SQL V13 sudah dijalankan.');setBusy(saveBtn,false);return;}
    if(type!=='pickup'){
      const {error:shipError}=await client.rpc('admin_set_product_shipping_fee',{p_order_id:o.id,p_shipping_fee:fee,p_courier:courier});
      if(shipError){console.error(shipError);alert('Gagal menyimpan ongkir/kurir: '+shipError.message);setBusy(saveBtn,false);return;}
    }
    const {error}=await client.rpc('admin_update_product_order_status',{p_order_id:o.id,p_order_status:orderStatus,p_shipping_status:autoShippingStatus(orderStatus),p_tracking_number:tracking,p_courier:courier,p_admin_note:$("adminNote")?.value.trim()||null});
    if(error){console.error(error);alert('Gagal menyimpan perubahan: '+error.message);setBusy(saveBtn,false);return;}
    alert('Pengiriman dan status pesanan berhasil disimpan ✅');
    await reloadAndReopen(o.id);
  };
}


function bindProductItemActions(order){
  const checks = [...document.querySelectorAll('.detail-product-check')];
  const selectAll = $('selectAllDetailProducts');
  const deleteBtn = $('deleteSelectedProductsBtn');
  if(!checks.length || !deleteBtn) return;

  const sync = () => {
    const selected = checks.filter(c => c.checked);
    deleteBtn.disabled = selected.length === 0;
    deleteBtn.innerHTML = selected.length
      ? `<i class="fa-solid fa-trash"></i> Hapus ${selected.length} Produk`
      : '<i class="fa-solid fa-trash"></i> Hapus Produk Terpilih';
    if(selectAll){
      selectAll.checked = selected.length === checks.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < checks.length;
    }
  };

  checks.forEach(c => c.addEventListener('change', sync));
  if(selectAll) selectAll.addEventListener('change', () => {
    checks.forEach(c => c.checked = selectAll.checked);
    sync();
  });

  deleteBtn.onclick = async () => {
    if(!['admin','superadmin'].includes(currentUserRole)){
      alert('Hanya Admin atau Superadmin yang dapat menghapus produk dari order.');
      return;
    }
    const ids = checks.filter(c => c.checked).map(c => Number(c.value)).filter(Boolean);
    if(!ids.length) return;
    if(ids.length >= (order.order_items || []).length){
      alert('Order harus memiliki minimal 1 produk. Sisakan satu produk atau batalkan order jika transaksi tidak dilanjutkan.');
      return;
    }

    const selectedNames = (order.order_items || [])
      .filter(i => ids.includes(Number(i.id)))
      .map(i => `• ${i.product_name || 'Produk'}${i.variant_name ? ` — ${i.variant_name}` : ''}`);

    const ok = confirm(
      `Hapus ${ids.length} produk dari ${order.order_number || 'order ini'}?\n\n` +
      selectedNames.join('\n') +
      `\n\nIMEI/unit yang terkait dengan item tersebut juga dapat ikut terhapus. ` +
      `Subtotal, total tagihan, sisa pembayaran, harga modal, dan laba akan dihitung ulang.`
    );
    if(!ok) return;

    setBusy(deleteBtn, true, 'Menghapus...');
    const { data, error } = await client.rpc('admin_delete_product_order_items', {
      p_order_id: Number(order.id),
      p_item_ids: ids
    });
    if(error){
      console.error(error);
      alert('Gagal menghapus produk: ' + error.message + '\n\nPastikan SQL V10 sudah dijalankan di Supabase.');
      setBusy(deleteBtn, false);
      return;
    }

    alert('Produk berhasil dihapus dan total order sudah dihitung ulang ✅');
    await reloadAndReopen(order.id);
  };

  sync();
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

