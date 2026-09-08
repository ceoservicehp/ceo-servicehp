"use strict";

const client = window.supabaseClient;
let allOrders = [];
let filteredOrders = [];
let currentTab = "sales";
let currentPage = 1;
let pageSize = 10;
let activeRange = "today";

const el = (id) => document.getElementById(id);
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const formatDate = (v, withTime = false) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return withTime ? d.toLocaleString("id-ID", {dateStyle:"medium", timeStyle:"short"}) : d.toLocaleDateString("id-ID", {day:"2-digit",month:"short",year:"numeric"});
};
const localDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const norm = (s) => String(s || "").toLowerCase();
const isCanceled = (o) => ["dibatalkan","gagal_dikirim"].includes(norm(o.order_status));
const isPaidPayment = (p) => norm(p.payment_status) === "paid";
const productRevenue = (o) => Math.max(0, Number(o.subtotal||0) - Number(o.discount||0));
const itemCost = (item) => Number(item?.products?.cost_price ?? item?.cost_price ?? 0) * Number(item.quantity||0);
const orderCost = (o) => (o.order_items||[]).reduce((a,i)=>a+itemCost(i),0);
const paidAmount = (o) => (o.order_payments||[]).filter(isPaidPayment).reduce((a,p)=>a+Number(p.amount||0),0);
const shippingFee = (o) => Number(o.shipping_fee || (o.order_shipments||[])[0]?.shipping_fee || 0);
const orderDebt = (o) => isCanceled(o) ? 0 : Math.max(0, Number(o.remaining_amount||0));

async function guardAdmin(){
  if (!client) throw new Error("Supabase client belum tersedia.");
  const {data:{session}} = await client.auth.getSession();
  if (!session?.user) { location.href = "login.html"; return false; }
  const {data:admin, error} = await client.from("admin_users").select("role,is_active").eq("user_id", session.user.id).maybeSingle();
  if (error) throw error;
  if (!admin || admin.is_active === false || !["superadmin","admin"].includes(admin.role)) {
    alert("Halaman keuangan penjualan hanya dapat diakses Admin / Superadmin.");
    location.href = "index.html";
    return false;
  }
  return true;
}

async function loadData(){
  showLoading();
  const {data, error} = await client.from("orders").select(`
    *,
    order_items(*, products(cost_price)),
    order_payments(*),
    order_shipments(*)
  `).order("created_at", {ascending:false});
  if (error) throw error;
  allOrders = data || [];
  applyActiveRange();
}

function dateInRange(value, start, end){
  if (!value) return false;
  const d = new Date(value); d.setHours(0,0,0,0);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}
function getRangeDates(type){
  const now = new Date();
  let start=null,end=null;
  if(type==="today"){ start=new Date(now); end=new Date(now); }
  if(type==="week"){
    const day = now.getDay() || 7;
    start = new Date(now); start.setDate(now.getDate()-day+1);
    end = new Date(start); end.setDate(start.getDate()+6);
  }
  if(type==="month"){ start=new Date(now.getFullYear(),now.getMonth(),1); end=new Date(now.getFullYear(),now.getMonth()+1,0); }
  [start,end].forEach(d=>d&&d.setHours(0,0,0,0));
  return {start,end};
}
function applyActiveRange(){
  const {start,end} = getRangeDates(activeRange);
  filteredOrders = activeRange === "all" ? [...allOrders] : allOrders.filter(o=>dateInRange(o.created_at,start,end));
  currentPage=1; refresh();
}
function applyCustomDate(){
  const s = el("startDate").value, e = el("endDate").value;
  if(!s || !e) return alert("Isi tanggal awal dan akhir.");
  const start = new Date(`${s}T00:00:00`), end = new Date(`${e}T23:59:59`);
  if(start>end) return alert("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
  activeRange="custom";
  document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));
  filteredOrders = allOrders.filter(o=>{ const d=new Date(o.created_at); return d>=start && d<=end; });
  currentPage=1; refresh();
}

function updateSummary(){
  const valid = filteredOrders.filter(o=>!isCanceled(o));
  const revenue = valid.reduce((a,o)=>a+productRevenue(o),0);
  const cost = valid.reduce((a,o)=>a+orderCost(o),0);
  const paid = valid.reduce((a,o)=>a+paidAmount(o),0);
  const debt = valid.reduce((a,o)=>a+orderDebt(o),0);
  const shipping = valid.reduce((a,o)=>a+shippingFee(o),0);
  el("sumRevenue").textContent=rupiah(revenue);
  el("sumCost").textContent=rupiah(cost);
  el("sumProfit").textContent=rupiah(revenue-cost);
  el("sumPaid").textContent=rupiah(paid);
  el("sumDebt").textContent=rupiah(debt);
  el("sumShipping").textContent=rupiah(shipping);
}

function statusBadge(text, kind="") { return `<span class="badge ${kind}">${escapeHtml(text||"-")}</span>`; }
function orderStatusKind(s){ s=norm(s); if(s==="selesai")return"success"; if(["dibatalkan","gagal_dikirim"].includes(s))return"danger"; return"warn"; }
function payKind(s){ s=norm(s); if(s==="lunas")return"success"; if(s==="belum_bayar")return"danger"; return"warn"; }
function productNames(o){ return (o.order_items||[]).map(i=>i.product_name||"-").join(", "); }
function variantText(i){ return [i.variant_name,i.ram,i.storage,i.color].filter(Boolean).join(" · ") || "-"; }
function escapeHtml(s){ return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

function getVisibleRows(){
  const q = norm(el("searchInput").value.trim());
  let rows = filteredOrders;
  if(currentTab==="debts") rows = rows.filter(o=>!isCanceled(o) && orderDebt(o)>0);
  if(q) rows = rows.filter(o=>norm([o.order_number,o.customer_name,o.customer_whatsapp,productNames(o)].join(" ")).includes(q));
  return rows;
}

function renderTable(){
  const rows=getVisibleRows();
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
  if(currentPage>totalPages) currentPage=totalPages;
  const slice=rows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  if(currentTab==="sales") renderSales(slice);
  if(currentTab==="payments") renderPayments(slice);
  if(currentTab==="debts") renderDebts(slice);
  renderPagination(rows.length,totalPages);
}
function renderSales(rows){
  el("tableHead").innerHTML=`<tr><th>Order</th><th>Pembeli / Produk</th><th>Tanggal</th><th>Omzet Produk</th><th>Modal</th><th>Laba</th><th>Ongkir</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr>`;
  el("tableBody").innerHTML=rows.length?rows.map(o=>{
    const rev=isCanceled(o)?0:productRevenue(o), cost=isCanceled(o)?0:orderCost(o), profit=rev-cost;
    return `<tr>
      <td><b>${escapeHtml(o.order_number||`#${o.id}`)}</b><br><span class="muted">#${o.id}</span></td>
      <td><b>${escapeHtml(o.customer_name)}</b><br><span class="muted">${escapeHtml(productNames(o)||"-")}</span></td>
      <td>${formatDate(o.created_at,true)}</td>
      <td class="money">${rupiah(rev)}</td><td class="money">${rupiah(cost)}</td><td class="money ${profit>=0?'positive':'danger'}">${rupiah(profit)}</td>
      <td class="money">${rupiah(shippingFee(o))}</td><td class="money">${rupiah(paidAmount(o))}</td><td class="money ${orderDebt(o)>0?'danger':''}">${rupiah(orderDebt(o))}</td>
      <td>${statusBadge(o.payment_status,payKind(o.payment_status))}<br><div style="height:4px"></div>${statusBadge(o.order_status,orderStatusKind(o.order_status))}</td>
      <td><button class="link-btn" data-detail="${o.id}">Detail</button></td>
    </tr>`;
  }).join(""):`<tr><td colspan="11" class="state-box">Tidak ada data penjualan.</td></tr>`;
}
function renderPayments(rows){
  const paymentRows=[];
  rows.forEach(o=>(o.order_payments||[]).forEach(p=>paymentRows.push({o,p})));
  paymentRows.sort((a,b)=>new Date(b.p.paid_at||b.p.created_at)-new Date(a.p.paid_at||a.p.created_at));
  el("tableHead").innerHTML=`<tr><th>Order</th><th>Pembeli</th><th>Tanggal Pembayaran</th><th>Metode</th><th>Nominal</th><th>Status</th><th>Referensi</th><th>Aksi</th></tr>`;
  el("tableBody").innerHTML=paymentRows.length?paymentRows.map(({o,p})=>`<tr>
    <td><b>${escapeHtml(o.order_number||`#${o.id}`)}</b></td><td>${escapeHtml(o.customer_name)}</td><td>${formatDate(p.paid_at||p.created_at,true)}</td>
    <td>${escapeHtml(p.payment_method||o.payment_method||"-")}</td><td class="money ${isPaidPayment(p)?'positive':''}">${rupiah(p.amount)}</td>
    <td>${statusBadge(p.payment_status,isPaidPayment(p)?'success':norm(p.payment_status)==='rejected'?'danger':'warn')}</td><td>${escapeHtml(p.reference_number||"-")}</td>
    <td><button class="link-btn" data-detail="${o.id}">Detail</button></td></tr>`).join(""):`<tr><td colspan="8" class="state-box">Tidak ada riwayat pembayaran pada order terpilih.</td></tr>`;
}
function renderDebts(rows){
  el("tableHead").innerHTML=`<tr><th>Order</th><th>Pembeli</th><th>Produk</th><th>Total Tagihan</th><th>Sudah Dibayar</th><th>Piutang</th><th>Status Bayar</th><th>Tanggal</th><th>Aksi</th></tr>`;
  el("tableBody").innerHTML=rows.length?rows.map(o=>`<tr><td><b>${escapeHtml(o.order_number||`#${o.id}`)}</b></td><td>${escapeHtml(o.customer_name)}</td><td>${escapeHtml(productNames(o)||"-")}</td>
    <td class="money">${rupiah(o.total)}</td><td class="money positive">${rupiah(paidAmount(o))}</td><td class="money danger">${rupiah(orderDebt(o))}</td>
    <td>${statusBadge(o.payment_status,payKind(o.payment_status))}</td><td>${formatDate(o.created_at)}</td><td><button class="link-btn" data-detail="${o.id}">Detail</button></td></tr>`).join(""):`<tr><td colspan="9" class="state-box">Tidak ada piutang pada periode ini.</td></tr>`;
}

function renderPagination(total,totalPages){
  el("pagination").classList.remove("hidden");
  el("prevPage").disabled=currentPage<=1; el("nextPage").disabled=currentPage>=totalPages;
  const box=el("pageNumbers"); box.innerHTML="";
  let start=Math.max(1,currentPage-2), end=Math.min(totalPages,start+4); start=Math.max(1,end-4);
  for(let i=start;i<=end;i++){const b=document.createElement("button");b.textContent=i;b.className=i===currentPage?"active":"";b.onclick=()=>{currentPage=i;renderTable()};box.appendChild(b)}
  const from=total?((currentPage-1)*pageSize+1):0, to=Math.min(currentPage*pageSize,total);
  el("pageInfo").textContent=`${from}-${to} dari ${total}`;
}

function refresh(){ updateSummary(); renderTable(); showReady(); }
function showLoading(){ el("loadingState").classList.remove("hidden"); el("errorState").classList.add("hidden"); el("tableWrap").classList.add("hidden"); el("pagination").classList.add("hidden"); }
function showReady(){ el("loadingState").classList.add("hidden"); el("errorState").classList.add("hidden"); el("tableWrap").classList.remove("hidden"); }
function showError(msg){ el("loadingState").classList.add("hidden"); el("tableWrap").classList.add("hidden"); el("pagination").classList.add("hidden"); el("errorState").textContent=msg; el("errorState").classList.remove("hidden"); }

function openDetail(id){
  const o=allOrders.find(x=>String(x.id)===String(id)); if(!o)return;
  el("modalTitle").textContent=o.order_number||`Order #${o.id}`;
  const rev=isCanceled(o)?0:productRevenue(o), cost=isCanceled(o)?0:orderCost(o), profit=rev-cost;
  const itemRows=(o.order_items||[]).map(i=>`<tr><td>${escapeHtml(i.product_name)}</td><td>${escapeHtml(variantText(i))}</td><td>${i.quantity}</td><td>${rupiah(i.unit_price)}</td><td>${rupiah(itemCost(i))}</td><td>${rupiah(Number(i.unit_price||0)*Number(i.quantity||0)-itemCost(i))}</td></tr>`).join("");
  el("modalBody").innerHTML=`
    <div class="detail-grid">
      <div class="detail-box"><h4>Data Pembeli</h4><div class="kv"><span>Nama</span><b>${escapeHtml(o.customer_name)}</b></div><div class="kv"><span>WhatsApp</span><b>${escapeHtml(o.customer_whatsapp)}</b></div><div class="kv"><span>Email</span><b>${escapeHtml(o.customer_email||"-")}</b></div><div class="kv"><span>Alamat</span><b>${escapeHtml(o.customer_address||"-")}</b></div></div>
      <div class="detail-box"><h4>Ringkasan Finansial</h4><div class="kv"><span>Omzet produk</span><b>${rupiah(rev)}</b></div><div class="kv"><span>Modal</span><b>${rupiah(cost)}</b></div><div class="kv"><span>Laba kotor</span><b>${rupiah(profit)}</b></div><div class="kv"><span>Ongkir</span><b>${rupiah(shippingFee(o))}</b></div><div class="kv"><span>Dibayar</span><b>${rupiah(paidAmount(o))}</b></div><div class="kv"><span>Sisa</span><b>${rupiah(orderDebt(o))}</b></div></div>
    </div>
    <table class="detail-table"><thead><tr><th>Produk</th><th>Varian</th><th>Qty</th><th>Harga Jual</th><th>Modal</th><th>Laba Item</th></tr></thead><tbody>${itemRows||'<tr><td colspan="6">Tidak ada item.</td></tr>'}</tbody></table>`;
  el("detailModal").classList.remove("hidden"); el("detailModal").setAttribute("aria-hidden","false");
}
function closeModal(){ el("detailModal").classList.add("hidden"); el("detailModal").setAttribute("aria-hidden","true"); }

function exportExcel(){
  if(typeof XLSX==="undefined") return alert("Library Excel belum termuat.");
  const rows=getVisibleRows();
  const sales=rows.map(o=>({
    "No Order":o.order_number||o.id,"Tanggal":formatDate(o.created_at,true),"Pembeli":o.customer_name,"WhatsApp":o.customer_whatsapp,
    "Produk":productNames(o),"Omzet Produk":isCanceled(o)?0:productRevenue(o),"Modal Produk":isCanceled(o)?0:orderCost(o),"Laba Kotor":isCanceled(o)?0:productRevenue(o)-orderCost(o),
    "Ongkir":shippingFee(o),"Total Tagihan":Number(o.total||0),"Dibayar":paidAmount(o),"Piutang":orderDebt(o),"Status Bayar":o.payment_status,"Status Order":o.order_status
  }));
  const payments=[]; rows.forEach(o=>(o.order_payments||[]).forEach(p=>payments.push({"No Order":o.order_number||o.id,"Pembeli":o.customer_name,"Tanggal Pembayaran":formatDate(p.paid_at||p.created_at,true),"Metode":p.payment_method,"Nominal":Number(p.amount||0),"Status":p.payment_status,"Referensi":p.reference_number||""})));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sales),"Penjualan"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(payments),"Pembayaran");
  XLSX.writeFile(wb,`Keuangan_Penjualan_HP_${localDate()}.xlsx`);
}

function bindEvents(){
  document.querySelectorAll(".filter-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");activeRange=btn.dataset.range;el("startDate").value="";el("endDate").value="";applyActiveRange()}));
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");currentTab=btn.dataset.tab;currentPage=1;renderTable()}));
  el("btnApplyDate").addEventListener("click",applyCustomDate); el("btnReset").addEventListener("click",()=>{activeRange="today";document.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b.dataset.range==="today"));el("startDate").value="";el("endDate").value="";applyActiveRange()});
  el("searchInput").addEventListener("input",()=>{currentPage=1;renderTable()}); el("pageSize").addEventListener("change",()=>{pageSize=Number(el("pageSize").value);currentPage=1;renderTable()});
  el("prevPage").addEventListener("click",()=>{if(currentPage>1){currentPage--;renderTable()}}); el("nextPage").addEventListener("click",()=>{currentPage++;renderTable()});
  el("btnExport").addEventListener("click",exportExcel); document.addEventListener("click",e=>{const d=e.target.closest("[data-detail]");if(d)openDetail(d.dataset.detail);if(e.target.closest("[data-close-modal]"))closeModal()});
}

(async function init(){
  bindEvents();
  try{ const ok=await guardAdmin(); if(!ok)return; await loadData(); }
  catch(err){ console.error(err); showError("Gagal memuat data keuangan produk: "+(err.message||err)); }
})();
