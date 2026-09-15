"use strict";
const client = window.supabaseClient;
let currentUser = null;
let currentRole = null;
let pages = [];
let filteredPages = [];
let currentPage = 1;
const pageSize = 10;
const $ = id => document.getElementById(id);
const fields = ["hero_badge","hero_title","hero_description","hero_primary_text","hero_primary_url","hero_secondary_text","hero_secondary_url","hero_image_url","services_label","services_title","services_subtitle","why_label","why_title","why_subtitle","contact_title","contact_short","contact_address","contact_phone","whatsapp_url"];

function msg(text,error=false){const el=$("message");el.hidden=false;el.textContent=text;el.classList.toggle("error",error);clearTimeout(msg.t);msg.t=setTimeout(()=>el.hidden=true,4000)}
function slugify(v){return String(v||"").toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-")}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function fmtDate(v){if(!v)return "-";return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}
function pageUrl(p){return `page.html?slug=${encodeURIComponent(p.slug)}`}

async function guard(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){location.href="login.html";return false}
  currentUser=session.user;
  const {data,error}=await client.from("admin_users").select("role,is_active").eq("user_id",currentUser.id).maybeSingle();
  if(error||!data||!data.is_active||!["admin","superadmin"].includes(data.role)){alert("Akses Kelola Website hanya untuk admin/superadmin.");location.href="index.html";return false}
  currentRole=data.role;
  return true;
}

async function loadHome(){const {data,error}=await client.from("site_homepage").select("*").eq("id",1).maybeSingle();if(error){msg(error.message,true);return}if(data)fields.forEach(k=>{if($(k))$(k).value=data[k]??""})}
async function saveHome(e){e.preventDefault();const btn=e.submitter;btn&&(btn.disabled=true);const payload={id:1,updated_by:currentUser.id,updated_at:new Date().toISOString()};fields.forEach(k=>payload[k]=$(k).value.trim());const {error}=await client.from("site_homepage").upsert(payload,{onConflict:"id"});btn&&(btn.disabled=false);if(error)return msg(error.message,true);msg("Halaman utama berhasil disimpan.")}

async function loadPages(){
  const {data,error}=await client.from("site_pages").select("*").order("nav_order").order("created_at",{ascending:false});
  if(error)return msg(error.message,true);
  pages=data||[];
  applyFilters();
  updateStats();
}
function updateStats(){
  $("statTotal").textContent=pages.length;
  $("statPublished").textContent=pages.filter(p=>p.status==="published").length;
  $("statDraft").textContent=pages.filter(p=>p.status==="draft").length;
  $("statNav").textContent=pages.filter(p=>p.status==="published"&&p.show_in_nav).length;
}
function applyFilters(){
  const q=($("pageSearch")?.value||"").trim().toLowerCase();
  const status=$("statusFilter")?.value||"all";
  filteredPages=pages.filter(p=>{
    const hit=!q||[p.title,p.slug,p.excerpt,p.nav_label].some(v=>String(v||"").toLowerCase().includes(q));
    const statusHit=status==="all"||p.status===status;
    return hit&&statusHit;
  });
  const max=Math.max(1,Math.ceil(filteredPages.length/pageSize));
  currentPage=Math.min(currentPage,max);
  renderPages();
}
function renderPages(){
  const body=$("pagesBody");
  const start=(currentPage-1)*pageSize;
  const rows=filteredPages.slice(start,start+pageSize);
  body.innerHTML=rows.length?rows.map(p=>`<tr>
    <td><div class="page-title-cell"><strong>${esc(p.title)}</strong><small>${esc(p.excerpt||"Tanpa ringkasan")}</small></div></td>
    <td><code>/${esc(p.slug)}</code></td>
    <td><button class="badge ${p.status} status-toggle" data-action="toggle-status" data-id="${p.id}" title="Klik untuk ubah status">${p.status==="published"?"Terbit":"Draft"}</button></td>
    <td>${p.show_in_nav?`<span class="yes"><i class="fa-solid fa-check"></i> ${esc(p.nav_label||p.title)}</span>`:"Tidak"}</td>
    <td>${p.nav_order||0}</td>
    <td>${fmtDate(p.updated_at||p.created_at)}</td>
    <td><div class="actions">
      <button class="icon-action edit" data-action="edit" data-id="${p.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <a class="icon-action" target="_blank" href="${pageUrl(p)}" title="Lihat"><i class="fa-solid fa-eye"></i></a>
      <button class="icon-action" data-action="duplicate" data-id="${p.id}" title="Duplikat"><i class="fa-regular fa-copy"></i></button>
      <button class="icon-action danger-icon" data-action="delete" data-id="${p.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
    </div></td></tr>`).join(""):`<tr><td colspan="7" class="empty-state"><i class="fa-regular fa-file-lines"></i><strong>Tidak ada halaman</strong><span>Coba ubah pencarian/filter atau buat halaman baru.</span></td></tr>`;
  renderPagination();
}
function renderPagination(){
  const total=filteredPages.length;
  const max=Math.max(1,Math.ceil(total/pageSize));
  $("pageInfo").textContent=total?`${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,total)} dari ${total} halaman`:`0 halaman`;
  $("prevPage").disabled=currentPage<=1;
  $("nextPage").disabled=currentPage>=max;
  $("pageNumber").textContent=`${currentPage} / ${max}`;
}
function openModal(p=null){
  $("pageForm").reset();
  $("page_id").value=p?.id||"";
  $("modalTitle").textContent=p?"Edit Halaman":"Tambah Halaman";
  $("deletePageBtn").hidden=!p;
  $("duplicatePageBtn").hidden=!p;
  if(p){
    ["title","slug","status","excerpt","content","seo_title","seo_description","nav_label","featured_image"].forEach(k=>{const el=$("page_"+k)||$(k);if(el)el.value=p[k]??""});
    $("nav_order").value=p.nav_order||0;
    $("show_in_nav").checked=!!p.show_in_nav;
  }
  updateNavFields();
  updateSlugPreview();
  $("pageModal").classList.add("show");
  document.body.classList.add("modal-open");
}
window.editPage=id=>openModal(pages.find(x=>x.id===id));
function closeModal(){$("pageModal").classList.remove("show");document.body.classList.remove("modal-open")}
function updateNavFields(){const on=$("show_in_nav").checked;$("nav_label").disabled=!on;$("nav_order").disabled=!on}
function updateSlugPreview(){$("slugPreview").textContent=`page.html?slug=${slugify($("page_slug").value)||"slug-halaman"}`}

async function savePage(e){
  e.preventDefault();
  const id=$("page_id").value;
  const payload={
    title:$("page_title").value.trim(),slug:slugify($("page_slug").value),status:$("page_status").value,
    excerpt:$("page_excerpt").value.trim(),content:$("page_content").value,
    featured_image:$("featured_image").value.trim(),seo_title:$("seo_title").value.trim(),seo_description:$("seo_description").value.trim(),
    show_in_nav:$("show_in_nav").checked,nav_label:$("nav_label").value.trim(),nav_order:Number($("nav_order").value||0),
    updated_by:currentUser.id,updated_at:new Date().toISOString()
  };
  if(!payload.title)return msg("Judul wajib diisi.",true);
  if(!payload.slug)return msg("Slug wajib diisi.",true);
  if(!payload.content.trim())return msg("Isi halaman wajib diisi.",true);
  if(payload.show_in_nav&&!payload.nav_label)payload.nav_label=payload.title;
  const duplicate=pages.find(p=>p.slug===payload.slug&&p.id!==id);
  if(duplicate)return msg("Slug sudah dipakai halaman lain.",true);
  const submit=e.submitter;submit&&(submit.disabled=true);
  const q=id?client.from("site_pages").update(payload).eq("id",id):client.from("site_pages").insert({...payload,created_by:currentUser.id});
  const {error}=await q;submit&&(submit.disabled=false);
  if(error)return msg(error.message,true);
  closeModal();await loadPages();msg(id?"Perubahan halaman berhasil disimpan.":"Halaman baru berhasil dibuat.");
}
async function deleteById(id){
  const p=pages.find(x=>x.id===id);if(!p)return;
  if(!confirm(`Hapus halaman “${p.title}”?\n\nTindakan ini tidak dapat dibatalkan.`))return;
  const {error}=await client.from("site_pages").delete().eq("id",id);
  if(error)return msg(error.message,true);
  if($("page_id").value===id)closeModal();
  await loadPages();msg("Halaman berhasil dihapus.");
}
async function duplicateById(id){
  const p=pages.find(x=>x.id===id);if(!p)return;
  let base=`${p.slug}-copy`,slug=base,n=2;while(pages.some(x=>x.slug===slug))slug=`${base}-${n++}`;
  const payload={title:`${p.title} (Salinan)`,slug,excerpt:p.excerpt||"",content:p.content||"",featured_image:p.featured_image||"",status:"draft",show_in_nav:false,nav_label:p.nav_label||p.title,nav_order:p.nav_order||0,seo_title:p.seo_title||"",seo_description:p.seo_description||"",created_by:currentUser.id,updated_by:currentUser.id};
  const {data,error}=await client.from("site_pages").insert(payload).select().single();
  if(error)return msg(error.message,true);await loadPages();msg("Halaman berhasil diduplikat sebagai Draft.");if(data)openModal(data);
}
async function toggleStatus(id){
  const p=pages.find(x=>x.id===id);if(!p)return;
  const status=p.status==="published"?"draft":"published";
  const {error}=await client.from("site_pages").update({status,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)return msg(error.message,true);await loadPages();msg(status==="published"?"Halaman diterbitkan.":"Halaman dijadikan Draft.");
}
function insertHtml(before,after=""){
  const ta=$("page_content"),start=ta.selectionStart,end=ta.selectionEnd,selected=ta.value.slice(start,end);
  ta.setRangeText(before+selected+after,start,end,"end");ta.focus();
}

function bindEvents(){
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab==="homepage"?"homepagePanel":"pagesPanel").classList.add("active")});
  $("homepageForm").onsubmit=saveHome;
  $("newPageBtn").onclick=()=>openModal();$("closeModal").onclick=closeModal;$("cancelPageBtn").onclick=closeModal;$("pageForm").onsubmit=savePage;
  $("deletePageBtn").onclick=()=>deleteById($("page_id").value);$("duplicatePageBtn").onclick=()=>duplicateById($("page_id").value);
  $("page_title").addEventListener("input",()=>{if(!$("page_id").value){$("page_slug").value=slugify($("page_title").value);updateSlugPreview()}});
  $("page_slug").addEventListener("input",updateSlugPreview);$("show_in_nav").addEventListener("change",updateNavFields);
  $("pageSearch").addEventListener("input",()=>{currentPage=1;applyFilters()});$("statusFilter").addEventListener("change",()=>{currentPage=1;applyFilters()});
  $("prevPage").onclick=()=>{if(currentPage>1){currentPage--;renderPages()}};$("nextPage").onclick=()=>{if(currentPage*pageSize<filteredPages.length){currentPage++;renderPages()}};
  $("pagesBody").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const {action,id}=b.dataset;if(action==="edit")openModal(pages.find(x=>x.id===id));if(action==="delete")deleteById(id);if(action==="duplicate")duplicateById(id);if(action==="toggle-status")toggleStatus(id)});
  document.querySelectorAll("[data-insert]").forEach(b=>b.onclick=()=>insertHtml(b.dataset.insert,b.dataset.after||""));
  $("menuToggle").onclick=()=>$("topNav").classList.toggle("open");
  $("pageModal").addEventListener("click",e=>{if(e.target===$("pageModal"))closeModal()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("pageModal").classList.contains("show"))closeModal()});
}

document.addEventListener("DOMContentLoaded",async()=>{if(!client)return alert("Supabase client tidak ditemukan.");if(!await guard())return;bindEvents();await Promise.all([loadHome(),loadPages()])});
