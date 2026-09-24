"use strict";
const client=window.supabaseClient,$=id=>document.getElementById(id);
let warrantyRows=[],warrantyPage=1,warrantyPageSize=10,warrantyTotal=0,warrantyTimer;
let claimRows=[],claimTimer,currentUnit=null;
const esc=s=>String(s??"-").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const fmtDate=v=>v?new Date(v+(String(v).length===10?"T00:00:00":"")).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const dt=v=>v?new Date(v).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"-";
function warrantyBadge(s){const m={aktif:["Aktif","ok"],habis:["Habis","bad"],belum_diatur:["Belum Diatur","muted"],belum_mulai:["Belum Mulai","warn"],nonaktif:["Nonaktif","muted"]};const [t,c]=m[s]||[s||"-","muted"];return `<span class="badge ${c}">${t}</span>`}
function claimBadge(s){return `<span class="badge claim ${esc(s)}">${esc(String(s||"-").replaceAll("_"," ").toUpperCase())}</span>`}
async function guard(){const {data:{session}}=await client.auth.getSession();if(!session){location.href="login.html";return false}const {data,error}=await client.from("admin_users").select("role,is_active").eq("user_id",session.user.id).maybeSingle();if(error||!data?.is_active||!["admin","superadmin"].includes(data.role)){alert("Akses hanya untuk admin / superadmin.");location.href="index.html";return false}return true}

async function loadWarranties(){
  $("tableBody").innerHTML='<tr><td colspan="7" class="empty">Memuat data...</td></tr>';
  warrantyPageSize=Number($("pageSize").value||10);
  const {data,error}=await client.rpc("admin_search_product_warranties",{p_q:$("searchInput").value.trim()||null,p_status:$("statusFilter").value,p_limit:warrantyPageSize,p_offset:(warrantyPage-1)*warrantyPageSize});
  if(error){$("tableBody").innerHTML=`<tr><td colspan="7" class="empty error">${esc(error.message)}</td></tr>`;return}
  warrantyRows=data||[];warrantyTotal=Number(warrantyRows[0]?.total_count||0);renderWarranties();
}
function renderWarranties(){
  $("statTotal").textContent=warrantyTotal;
  $("statAktif").textContent=warrantyRows.filter(x=>x.warranty_state==="aktif").length;
  $("statBelum").textContent=warrantyRows.filter(x=>["belum_diatur","belum_mulai"].includes(x.warranty_state)).length;
  $("statHabis").textContent=warrantyRows.filter(x=>x.warranty_state==="habis").length;
  $("tableBody").innerHTML=warrantyRows.length?warrantyRows.map(r=>`<tr>
    <td><b>${esc(r.order_number||("#"+r.order_id))}</b><small>${fmtDate(r.order_created_at)}</small></td>
    <td><b>${esc(r.customer_name)}</b><small><i class="fa-brands fa-whatsapp"></i> ${esc(r.customer_whatsapp)}</small></td>
    <td><b>${esc(r.product_name)}</b><small>${esc([r.variant_name,r.ram,r.storage,r.color].filter(Boolean).join(" · "))}</small></td>
    <td><code>${esc(r.imei1)}</code>${r.imei2?`<small>IMEI 2: ${esc(r.imei2)}</small>`:""}${r.serial_number?`<small>SN: ${esc(r.serial_number)}</small>`:""}</td>
    <td>${r.warranty_id?`<b>${esc(r.warranty_type||"Garansi")}</b><small>${fmtDate(r.warranty_start)} — ${fmtDate(r.warranty_end)}</small>`:'<span class="soft">Belum ditentukan</span>'}</td>
    <td>${warrantyBadge(r.warranty_state)}${Number.isFinite(r.days_left)?`<small>${r.days_left>=0?r.days_left+" hari tersisa":Math.abs(r.days_left)+" hari lewat"}</small>`:""}</td>
    <td><button class="btn tiny secondary" onclick="openUnit(${Number(r.unit_id)})"><i class="fa-solid fa-eye"></i> Detail</button></td>
  </tr>`).join(""):'<tr><td colspan="7" class="empty">Data tidak ditemukan.</td></tr>';
  const pages=Math.max(1,Math.ceil(warrantyTotal/warrantyPageSize));$("pageInfo").textContent=`Halaman ${warrantyPage} dari ${pages} · ${warrantyTotal} unit`;$("prevBtn").disabled=warrantyPage<=1;$("nextBtn").disabled=warrantyPage>=pages;
}
window.openUnit=async unitId=>{
  currentUnit=warrantyRows.find(x=>Number(x.unit_id)===Number(unitId));
  if(!currentUnit)return;
  // Fetch all warranty records for this unit through the same search RPC using IMEI/order context.
  let all=[currentUnit];
  const key=currentUnit.imei1||currentUnit.serial_number||currentUnit.order_number;
  if(key){const {data}=await client.rpc("admin_search_product_warranties",{p_q:key,p_status:"all",p_limit:100,p_offset:0});if(data?.length)all=data.filter(x=>Number(x.unit_id)===Number(unitId))}
  const cards=all.filter(x=>x.warranty_id).map(x=>`<div class="warranty-card">
    <div class="warranty-card-head"><i class="fa-solid ${String(x.warranty_type||"").toLowerCase().includes("service")?"fa-screwdriver-wrench":"fa-shield-halved"}"></i><div><b>${esc(x.warranty_type||"Garansi")}</b><small>${warrantyBadge(x.warranty_state)}</small></div></div>
    <div class="warranty-dates"><span><small>Mulai</small><b>${fmtDate(x.warranty_start)}</b></span><i class="fa-solid fa-arrow-right"></i><span><small>Berakhir</small><b>${fmtDate(x.warranty_end)}</b></span></div>
    ${Number.isFinite(x.days_left)?`<p>${x.days_left>=0?`${x.days_left} hari tersisa`:`Berakhir ${Math.abs(x.days_left)} hari lalu`}</p>`:""}
    ${x.warranty_note?`<div class="note"><i class="fa-regular fa-note-sticky"></i> ${esc(x.warranty_note)}</div>`:""}
  </div>`).join("");
  $("unitDetail").innerHTML=`<div class="detail-grid">
    <section><h4><i class="fa-solid fa-user"></i> Pembeli</h4><p><span>Nama</span><b>${esc(currentUnit.customer_name)}</b></p><p><span>WhatsApp</span><b>${esc(currentUnit.customer_whatsapp)}</b></p><p><span>No. Order</span><b>${esc(currentUnit.order_number)}</b></p></section>
    <section><h4><i class="fa-solid fa-mobile-screen-button"></i> Unit</h4><p><span>Produk</span><b>${esc(currentUnit.product_name)}</b></p><p><span>Varian</span><b>${esc([currentUnit.variant_name,currentUnit.ram,currentUnit.storage,currentUnit.color].filter(Boolean).join(" · ")||"-")}</b></p><p><span>IMEI 1</span><b>${esc(currentUnit.imei1)}</b></p>${currentUnit.imei2?`<p><span>IMEI 2</span><b>${esc(currentUnit.imei2)}</b></p>`:""}${currentUnit.serial_number?`<p><span>Serial</span><b>${esc(currentUnit.serial_number)}</b></p>`:""}</section>
  </div><div class="warranty-section"><h4><i class="fa-solid fa-shield-halved"></i> Garansi Unit</h4><div class="warranty-cards">${cards||'<div class="empty-card">Belum ada garansi pada unit ini. Pengaturan garansi dilakukan dari Kelola Order Produk.</div>'}</div></div>`;
  $("claimFromUnit").style.display=all.some(x=>x.warranty_state==="aktif")?"inline-flex":"none";
  $("unitModal").classList.remove("hidden");
};

async function loadClaims(){
  $("claimBody").innerHTML='<tr><td colspan="6" class="empty">Memuat klaim...</td></tr>';
  const {data,error}=await client.rpc("admin_search_product_warranty_claims",{p_q:$("claimSearch").value.trim()||null,p_status:$("claimStatus").value,p_limit:200,p_offset:0});
  if(error){$("claimBody").innerHTML=`<tr><td colspan="6" class="empty error">${esc(error.message)}</td></tr>`;return}
  claimRows=data||[];renderClaims();
}
function renderClaims(){
  $("claimBody").innerHTML=claimRows.length?claimRows.map(x=>`<tr><td><b>${esc(x.claim_number)}</b><small>${dt(x.received_at)}</small></td><td><b>${esc(x.customer_name)}</b><small>${esc(x.customer_whatsapp)}</small></td><td><b>${esc(x.product_name)}</b><small>${esc(x.variant_name)}</small><small>IMEI: ${esc(x.imei1)}</small></td><td class="complaint">${esc(x.complaint)}</td><td>${claimBadge(x.claim_status)}</td><td><button class="btn tiny secondary" onclick="openClaim(${Number(x.claim_id)})"><i class="fa-solid fa-eye"></i> Detail</button></td></tr>`).join(""):'<tr><td colspan="6" class="empty">Belum ada klaim.</td></tr>';
  $("sTotal").textContent=claimRows.length;$("sProcess").textContent=claimRows.filter(x=>["diperiksa","diproses"].includes(x.claim_status)).length;$("sDone").textContent=claimRows.filter(x=>x.claim_status==="selesai").length;$("sReject").textContent=claimRows.filter(x=>x.claim_status==="ditolak").length;$("claimTabCount").textContent=claimRows.filter(x=>!["selesai","ditolak"].includes(x.claim_status)).length;
}
async function findUnits(prefill){
  const q=(prefill||$("unitQ").value).trim();if(!q)return alert("Masukkan IMEI / Serial / Order / Nama");
  $("unitQ").value=q;
  const {data,error}=await client.rpc("admin_search_product_warranties",{p_q:q,p_status:"aktif",p_limit:50,p_offset:0});if(error)return alert(error.message);
  const units=[];const seen=new Set();(data||[]).forEach(x=>{if(!seen.has(String(x.unit_id))){seen.add(String(x.unit_id));units.push(x)}});
  $("unitResults").innerHTML=units.length?units.map((x,i)=>`<button type="button" class="unit-option" data-index="${i}"><b>${esc(x.product_name)} ${esc(x.variant_name||"")}</b><small>${esc(x.order_number)} · ${esc(x.customer_name)}</small><small>IMEI: ${esc(x.imei1)}</small></button>`).join(""):'<p class="empty-card">Unit dengan garansi aktif tidak ditemukan.</p>';
  $("unitResults").querySelectorAll(".unit-option").forEach(el=>el.onclick=()=>selectUnit(units[Number(el.dataset.index)]));
}
function selectUnit(x){$("unitId").value=x.unit_id;$("selectedUnit").innerHTML=`<b>${esc(x.product_name)} ${esc(x.variant_name||"")}</b><span>${esc(x.customer_name)} · ${esc(x.order_number)}</span><code>IMEI: ${esc(x.imei1)}</code><small>Garansi aktif: ${fmtDate(x.warranty_start)} s/d ${fmtDate(x.warranty_end)}</small>`;$("createForm").classList.remove("hidden")}
window.openClaim=id=>{const x=claimRows.find(r=>Number(r.claim_id)===Number(id));if(!x)return;$("claimId").value=x.claim_id;$("editClaimStatus").value=x.claim_status;$("editCondition").value=x.unit_condition||"";$("inspection").value=x.inspection_result||"";$("action").value=x.action_taken||"";$("editNote").value=x.admin_note||"";$("claimSummary").innerHTML=`<b>${esc(x.claim_number)}</b><span>${esc(x.customer_name)} · ${esc(x.product_name)}</span><code>IMEI: ${esc(x.imei1)}</code><p><b>Keluhan:</b> ${esc(x.complaint)}</p>`;$("editClaimModal").classList.remove("hidden")};

function openCreateClaim(prefill=""){$("createClaimModal").classList.remove("hidden");$("unitResults").innerHTML="";$("createForm").classList.add("hidden");$("unitQ").value=prefill;if(prefill)findUnits(prefill)}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));$("monitoringTab").classList.toggle("hidden",b.dataset.tab!=="monitoring");$("claimsTab").classList.toggle("hidden",b.dataset.tab!=="claims");if(b.dataset.tab==="claims")loadClaims()});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
$("claimFromUnit").onclick=()=>{const q=currentUnit?.imei1||currentUnit?.serial_number||currentUnit?.order_number||"";$("unitModal").classList.add("hidden");openCreateClaim(q)};
$("newClaimBtn").onclick=()=>openCreateClaim();$("findUnit").onclick=()=>findUnits();$("refreshAll").onclick=()=>{loadWarranties();loadClaims()};
$("searchInput").oninput=()=>{clearTimeout(warrantyTimer);warrantyTimer=setTimeout(()=>{warrantyPage=1;loadWarranties()},350)};$("statusFilter").onchange=()=>{warrantyPage=1;loadWarranties()};$("pageSize").onchange=()=>{warrantyPage=1;loadWarranties()};
$("prevBtn").onclick=()=>{if(warrantyPage>1){warrantyPage--;loadWarranties()}};$("nextBtn").onclick=()=>{if(warrantyPage<Math.ceil(warrantyTotal/warrantyPageSize)){warrantyPage++;loadWarranties()}};
$("claimSearch").oninput=()=>{clearTimeout(claimTimer);claimTimer=setTimeout(loadClaims,350)};$("claimStatus").onchange=loadClaims;
$("createForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;const {error}=await client.rpc("admin_create_product_warranty_claim",{p_unit_id:Number($("unitId").value),p_complaint:$("complaint").value,p_condition:$("condition").value||null,p_note:$("createNote").value||null});btn.disabled=false;if(error)return alert(error.message);alert("Klaim berhasil dibuat");$("createClaimModal").classList.add("hidden");e.target.reset();loadClaims()};
$("editForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;const {error}=await client.rpc("admin_update_product_warranty_claim",{p_claim_id:Number($("claimId").value),p_status:$("editClaimStatus").value,p_condition:$("editCondition").value||null,p_inspection:$("inspection").value||null,p_action:$("action").value||null,p_note:$("editNote").value||null});btn.disabled=false;if(error)return alert(error.message);alert("Klaim diperbarui");$("editClaimModal").classList.add("hidden");loadClaims()};
document.addEventListener("DOMContentLoaded",async()=>{if(await guard()){await Promise.all([loadWarranties(),loadClaims()])}});
