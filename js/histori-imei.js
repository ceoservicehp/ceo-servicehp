"use strict";

const client = window.supabaseClient;
let currentPage = 1;
let pageSize = 20;
let totalRows = 0;
let currentRows = [];
let debounceTimer = null;

const $ = (id) => document.getElementById(id);

function rupiah(v){ return "Rp " + Number(v || 0).toLocaleString("id-ID"); }
function dateID(v){ if(!v) return "-"; const d = new Date(v); return isNaN(d) ? "-" : d.toLocaleDateString("id-ID", {day:"2-digit",month:"short",year:"numeric"}); }
function escapeHtml(v){ return String(v ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function labelStatus(s){ return ({menunggu_diproses:"Menunggu Diproses",dikemas:"Dikemas",dikirim:"Dikirim",dalam_perjalanan:"Dalam Perjalanan",selesai:"Selesai",dibatalkan:"Dibatalkan",gagal_dikirim:"Gagal Dikirim"})[s] || s || "-"; }
function badgeClass(s){ if(s === "selesai") return "done"; if(["dibatalkan","gagal_dikirim"].includes(s)) return "cancel"; return "progress"; }
function unitPrice(row){ return Number(row.unit_price || 0); }
function productText(row){
  const bits = [row.variant_name, row.ram && `RAM ${row.ram}`, row.storage && `${row.storage}`, row.color].filter(Boolean);
  return `<div class="product-name">${escapeHtml(row.product_name || "-")}</div><div class="muted">${escapeHtml(bits.join(" · ") || "Tanpa varian")}</div>`;
}
function imeiText(row){
  const lines=[];
  if(row.imei1) lines.push(`<div class="imei-line"><b>IMEI 1</b> ${escapeHtml(row.imei1)}</div>`);
  if(row.imei2) lines.push(`<div class="imei-line"><b>IMEI 2</b> ${escapeHtml(row.imei2)}</div>`);
  if(row.serial_number) lines.push(`<div class="imei-line"><b>SN</b> ${escapeHtml(row.serial_number)}</div>`);
  return lines.join("") || '<span class="muted">-</span>';
}

async function ensureAdmin(){
  const { data:{ session } } = await client.auth.getSession();
  if(!session){ location.href = "login.html"; return false; }
  const { data, error } = await client.from("admin_users").select("role,is_active").eq("user_id", session.user.id).maybeSingle();
  if(error || !data || !data.is_active || !["admin","superadmin"].includes(data.role)){
    alert("Halaman ini hanya untuk Admin / Superadmin.");
    location.href = "index.html"; return false;
  }
  return true;
}

async function loadData(){
  const q = $("searchInput").value.trim();
  const status = $("statusFilter").value;
  pageSize = Number($("pageSize").value || 20);
  $("tableBody").innerHTML = `<tr><td colspan="9" style="text-align:center;padding:35px">Memuat data...</td></tr>`;
  $("emptyState").classList.add("hidden");

  const { data, error } = await client.rpc("admin_search_product_units", {
    p_query: q || null,
    p_status: status || null,
    p_limit: pageSize,
    p_offset: (currentPage - 1) * pageSize
  });

  if(error){
    console.error(error);
    $("tableBody").innerHTML = `<tr><td colspan="9" style="text-align:center;color:#d9534f;padding:30px">Gagal memuat histori unit.<br>${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  currentRows = data || [];
  totalRows = currentRows.length ? Number(currentRows[0].total_count || 0) : 0;
  renderTable(); renderPagination(); renderStats();
}

function renderTable(){
  const body = $("tableBody");
  if(!currentRows.length){ body.innerHTML=""; $("emptyState").classList.remove("hidden"); $("resultInfo").textContent="Tidak ada unit yang cocok."; return; }
  $("emptyState").classList.add("hidden");
  $("resultInfo").textContent = `Menampilkan ${((currentPage-1)*pageSize)+1}–${Math.min(currentPage*pageSize,totalRows)} dari ${totalRows} unit.`;
  body.innerHTML = currentRows.map((r,i)=>`
    <tr>
      <td>${(currentPage-1)*pageSize+i+1}</td>
      <td><div class="order-no">${escapeHtml(r.order_number || `ORD-${r.order_id}`)}</div><div class="muted">ID #${escapeHtml(r.order_id)}</div></td>
      <td><div class="product-name">${escapeHtml(r.customer_name || "-")}</div><div class="muted">${escapeHtml(r.customer_whatsapp || "-")}</div></td>
      <td>${productText(r)}</td>
      <td><div class="imei-list">${imeiText(r)}</div></td>
      <td>${dateID(r.created_at)}</td>
      <td><b>${rupiah(unitPrice(r))}</b></td>
      <td><span class="badge ${badgeClass(r.order_status)}">${escapeHtml(labelStatus(r.order_status))}</span><div class="muted">${escapeHtml((r.payment_status || "-").replaceAll("_"," "))}</div></td>
      <td><button class="action-btn" data-detail="${r.unit_id}" title="Detail"><i class="fa-solid fa-eye"></i></button></td>
    </tr>`).join("");
  body.querySelectorAll("[data-detail]").forEach(btn=>btn.addEventListener("click",()=>openDetail(btn.dataset.detail)));
}

function renderStats(){
  $("statUnits").textContent = totalRows.toLocaleString("id-ID");
  const imei = currentRows.reduce((n,r)=>n+(r.imei1?1:0)+(r.imei2?1:0),0);
  const done = currentRows.filter(r=>r.order_status==="selesai").length;
  const sales = currentRows.reduce((n,r)=>n+unitPrice(r),0);
  $("statImei").textContent = imei.toLocaleString("id-ID") + (totalRows>currentRows.length ? "*" : "");
  $("statDone").textContent = done.toLocaleString("id-ID") + (totalRows>currentRows.length ? "*" : "");
  $("statSales").textContent = rupiah(sales) + (totalRows>currentRows.length ? "*" : "");
}

function renderPagination(){
  const pages = Math.max(1, Math.ceil(totalRows/pageSize));
  $("prevBtn").disabled = currentPage<=1;
  $("nextBtn").disabled = currentPage>=pages;
  const holder=$("pageNumbers"); holder.innerHTML="";
  let start=Math.max(1,currentPage-2), end=Math.min(pages,start+4); start=Math.max(1,end-4);
  for(let p=start;p<=end;p++){
    const b=document.createElement("button"); b.className="page-num"+(p===currentPage?" active":""); b.textContent=p;
    b.onclick=()=>{currentPage=p;loadData();}; holder.appendChild(b);
  }
}

function detailItem(label,value,wide=false){ return `<div class="detail-item ${wide?'wide':''}"><label>${escapeHtml(label)}</label><strong>${value || "-"}</strong></div>`; }
function openDetail(unitId){
  const r=currentRows.find(x=>String(x.unit_id)===String(unitId)); if(!r) return;
  $("modalTitle").textContent = r.product_name || "Detail Unit";
  $("modalSub").textContent = `${r.order_number || `ORD-${r.order_id}`} · ${r.customer_name || "-"}`;
  $("modalContent").innerHTML = [
    detailItem("Nomor Order", escapeHtml(r.order_number || `ORD-${r.order_id}`)),
    detailItem("Tanggal Penjualan", dateID(r.created_at)),
    detailItem("Pembeli", escapeHtml(r.customer_name || "-")),
    detailItem("WhatsApp", escapeHtml(r.customer_whatsapp || "-")),
    detailItem("Produk", escapeHtml(r.product_name || "-"), true),
    detailItem("Varian", escapeHtml(r.variant_name || "-")),
    detailItem("RAM / Storage", escapeHtml([r.ram,r.storage].filter(Boolean).join(" / ") || "-")),
    detailItem("Warna", escapeHtml(r.color || "-")),
    detailItem("Harga Jual / Unit", rupiah(r.unit_price)),
    detailItem("IMEI 1", `<span style="font-family:monospace">${escapeHtml(r.imei1 || "-")}</span>`),
    detailItem("IMEI 2", `<span style="font-family:monospace">${escapeHtml(r.imei2 || "-")}</span>`),
    detailItem("Serial Number", `<span style="font-family:monospace">${escapeHtml(r.serial_number || "-")}</span>`),
    detailItem("Status Order", `<span class="badge ${badgeClass(r.order_status)}">${escapeHtml(labelStatus(r.order_status))}</span>`),
    detailItem("Status Pembayaran", escapeHtml((r.payment_status || "-").replaceAll("_"," "))),
    detailItem("Catatan Unit", escapeHtml(r.unit_note || "-"), true)
  ].join("");
  $("invoiceBtn").href = `nota-produk.html?id=${encodeURIComponent(r.order_id)}`;
  $("detailModal").classList.remove("hidden"); $("detailModal").setAttribute("aria-hidden","false");
}
function closeModal(){ $("detailModal").classList.add("hidden"); $("detailModal").setAttribute("aria-hidden","true"); }

function bind(){
  $("searchBtn").onclick=()=>{currentPage=1;loadData();};
  $("clearBtn").onclick=()=>{$("searchInput").value="";currentPage=1;loadData();};
  $("statusFilter").onchange=()=>{currentPage=1;loadData();};
  $("pageSize").onchange=()=>{currentPage=1;loadData();};
  $("prevBtn").onclick=()=>{if(currentPage>1){currentPage--;loadData();}};
  $("nextBtn").onclick=()=>{if(currentPage<Math.ceil(totalRows/pageSize)){currentPage++;loadData();}};
  $("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter"){currentPage=1;loadData();}});
  $("searchInput").addEventListener("input",()=>{clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>{if($("searchInput").value.trim().length>=3 || !$("searchInput").value.trim()){currentPage=1;loadData();}},550);});
  document.querySelectorAll("[data-close-modal]").forEach(el=>el.addEventListener("click",closeModal));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
}

(async()=>{ if(await ensureAdmin()){ bind(); await loadData(); } })();
