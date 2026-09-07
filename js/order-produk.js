"use strict";
const client = window.supabaseClient;
const PAGE_SIZE = 10;
let orders = [], filtered = [], page = 1;
const $ = id => document.getElementById(id);
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate = v => v ? new Date(v).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}) : "-";
const label = v => ({pickup:"Ambil di Toko",instant:"Kurir Instan",package:"Kirim Paket",cod:"COD",transfer:"Transfer Bank",cash:"Cash",belum_bayar:"Belum Bayar",lunas:"Lunas",menunggu_diproses:"Menunggu Diproses",dikemas:"Dikemas",dikirim:"Dikirim",dalam_perjalanan:"Dalam Perjalanan",selesai:"Selesai",gagal_dikirim:"Gagal Dikirim"}[v] || String(v||"-").replaceAll("_"," "));
document.addEventListener("DOMContentLoaded",()=>{ setup(); loadOrders(); $("year").textContent=new Date().getFullYear(); });
function setup(){
  $("refreshBtn").onclick=loadOrders; ["searchInput","paymentFilter","shippingFilter","statusFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",()=>{page=1;applyFilters();}));
  $("prevPage").onclick=()=>{if(page>1){page--;render();}}; $("nextPage").onclick=()=>{if(page<Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))){page++;render();}};
  $("closeModal").onclick=closeModal; $("detailModal").onclick=e=>{if(e.target===$("detailModal"))closeModal();};
  $("menuToggle").onclick=()=>{$("topNav").classList.toggle("open");$("navOverlay").classList.toggle("show");}; $("navOverlay").onclick=()=>{$("topNav").classList.remove("open");$("navOverlay").classList.remove("show");};
}
async function loadOrders(){
  $("orderTableBody").innerHTML='<tr><td colspan="8" class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat order...</td></tr>';
  const {data,error}=await client.from("orders").select(`*,order_items(*),order_payments(*),order_shipments(*)`).order("created_at",{ascending:false});
  if(error){console.error(error);$("orderTableBody").innerHTML=`<tr><td colspan="8" class="empty error">Gagal memuat order: ${esc(error.message)}<br><small>Pastikan SQL akses admin sudah dijalankan.</small></td></tr>`;return;}
  orders=data||[]; applyFilters(); updateStats();
}
function applyFilters(){
 const q=$("searchInput").value.trim().toLowerCase(), pf=$("paymentFilter").value, sf=$("shippingFilter").value, st=$("statusFilter").value;
 filtered=orders.filter(o=>{const item=(o.order_items||[]).map(i=>`${i.product_name} ${i.variant_name||""} ${i.color||""}`).join(" ");const hay=`${o.order_number} ${o.customer_name} ${o.customer_whatsapp} ${item}`.toLowerCase();return(!q||hay.includes(q))&&(pf==="all"||o.payment_status===pf)&&(sf==="all"||o.shipping_method===sf)&&(st==="all"||o.order_status===st);}); render();
}
function updateStats(){ $("statTotal").textContent=orders.length; $("statWaiting").textContent=orders.filter(o=>o.order_status==="menunggu_diproses").length; $("statProof").textContent=orders.filter(o=>(o.order_payments||[]).some(p=>p.proof_url)).length; $("statUnpaid").textContent=orders.filter(o=>o.payment_status!=="lunas").length; }
function render(){
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); if(page>pages)page=pages; const rows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE); $("pageInfo").textContent=`${page} / ${pages}`; $("prevPage").disabled=page<=1; $("nextPage").disabled=page>=pages;
 if(!rows.length){$("orderTableBody").innerHTML='<tr><td colspan="8" class="empty">Tidak ada order yang sesuai.</td></tr>';return;}
 $("orderTableBody").innerHTML=rows.map(o=>{const item=(o.order_items||[])[0]||{};const proof=(o.order_payments||[]).some(p=>p.proof_url);return `<tr><td><strong>${esc(o.order_number||`#${o.id}`)}</strong><small>${fmtDate(o.created_at)}</small></td><td><strong>${esc(o.customer_name)}</strong><small>${esc(o.customer_whatsapp)}</small></td><td>${esc(item.product_name||"-")}<small>${esc(item.variant_name||"")}${item.quantity?` ×${item.quantity}`:""}</small></td><td><span class="pill">${esc(label(o.shipping_method))}</span></td><td><span class="pill ${o.payment_status==='lunas'?'ok':'warn'}">${esc(label(o.payment_status))}</span>${proof?'<small class="proof"><i class="fa-solid fa-receipt"></i> Bukti masuk</small>':''}</td><td><strong>${rupiah(o.total)}</strong></td><td><span class="pill">${esc(label(o.order_status))}</span></td><td><button class="btn primary detail-btn" data-id="${o.id}"><i class="fa-solid fa-eye"></i> Detail</button></td></tr>`;}).join("");
 document.querySelectorAll(".detail-btn").forEach(b=>b.onclick=()=>openDetail(Number(b.dataset.id)));
}
async function openDetail(id){const o=orders.find(x=>x.id===id);if(!o)return;$("detailOrderNumber").textContent=o.order_number||`Order #${o.id}`;const items=o.order_items||[],pay=(o.order_payments||[]).slice().sort((a,b)=>b.id-a.id)[0],ship=(o.order_shipments||[]).slice().sort((a,b)=>b.id-a.id)[0];
 let proof='<div class="notice">Belum ada bukti transfer.</div>'; if(pay?.proof_url){proof=`<button class="btn primary" id="viewProofBtn"><i class="fa-solid fa-receipt"></i> Lihat Bukti Transfer</button>`;}
 const mapLink=(o.latitude!=null&&o.longitude!=null)?`https://www.google.com/maps?q=${encodeURIComponent(o.latitude)},${encodeURIComponent(o.longitude)}`:null;
 $("detailContent").innerHTML=`<div class="detail-grid"><section><h3><i class="fa-solid fa-user"></i> Pembeli</h3><p><b>${esc(o.customer_name)}</b><br>${esc(o.customer_whatsapp)}<br>${esc(o.customer_email||"-")}<br>${esc(o.customer_address||"-")}</p>${mapLink?`<a class="btn" target="_blank" rel="noopener" href="${mapLink}"><i class="fa-solid fa-location-dot"></i> Buka Titik Lokasi</a>`:""}</section><section><h3><i class="fa-solid fa-mobile-screen"></i> Produk</h3>${items.map(i=>`<div class="item"><b>${esc(i.product_name)}</b><span>${esc(i.variant_name||"-")} · ${esc(i.color||"-")} · RAM ${esc(i.ram||"-")} · ${esc(i.storage||"-")}</span><span>${i.quantity} × ${rupiah(i.unit_price)} = <b>${rupiah(i.subtotal)}</b></span></div>`).join("")}</section><section><h3><i class="fa-solid fa-truck"></i> Pengiriman</h3><p>Metode: <b>${esc(label(o.shipping_method))}</b><br>Kurir: ${esc(ship?.courier||"-")}<br>Resi: ${esc(ship?.tracking_number||"-")}<br>Ongkir: <b>${rupiah(o.shipping_fee)}</b></p></section><section><h3><i class="fa-solid fa-credit-card"></i> Pembayaran</h3><p>Metode: <b>${esc(label(o.payment_method))}</b><br>Status: <b>${esc(label(o.payment_status))}</b><br>Dibayar: ${rupiah(o.amount_paid)}<br>Sisa: ${rupiah(o.remaining_amount)}</p>${proof}</section></div><section class="summary"><div><span>Subtotal</span><b>${rupiah(o.subtotal)}</b></div><div><span>Ongkir</span><b>${rupiah(o.shipping_fee)}</b></div><div class="grand"><span>Total</span><b>${rupiah(o.total)}</b></div></section><section class="admin-box"><h3><i class="fa-solid fa-screwdriver-wrench"></i> Tindakan Admin</h3><p>Versi awal ini sudah menampilkan seluruh order dan bukti pembayaran. Tombol verifikasi pembayaran serta konfirmasi ongkir akan diaktifkan setelah nilai CHECK constraint database dikunci agar tidak terjadi error status seperti sebelumnya.</p></section>`;
 if(pay?.proof_url)$("viewProofBtn").onclick=()=>viewProof(pay.proof_url); $("detailModal").classList.add("show");$("detailModal").setAttribute("aria-hidden","false");}
async function viewProof(path){const {data,error}=await client.storage.from("bukti-pembayaran-produk").createSignedUrl(path,300);if(error){alert("Gagal membuka bukti: "+error.message);return;}window.open(data.signedUrl,"_blank","noopener");}
function closeModal(){$("detailModal").classList.remove("show");$("detailModal").setAttribute("aria-hidden","true");}
