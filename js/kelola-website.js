"use strict";
const client = window.supabaseClient;
let currentUser = null;
let pages = [];
const $ = id => document.getElementById(id);
const fields = ["hero_badge","hero_title","hero_description","hero_primary_text","hero_primary_url","hero_secondary_text","hero_secondary_url","hero_image_url","services_label","services_title","services_subtitle","why_label","why_title","why_subtitle","contact_title","contact_short","contact_address","contact_phone","whatsapp_url"];

function msg(text,error=false){const el=$("message");el.hidden=false;el.textContent=text;el.classList.toggle("error",error);setTimeout(()=>el.hidden=true,3500)}
function slugify(v){return String(v||"").toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-")}
function esc(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}

async function guard(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){location.href="login.html";return false}
  currentUser=session.user;
  const {data,error}=await client.from("admin_users").select("role,is_active").eq("user_id",currentUser.id).maybeSingle();
  if(error||!data||!data.is_active||!["admin","superadmin"].includes(data.role)){alert("Akses Kelola Website hanya untuk admin/superadmin.");location.href="index.html";return false}
  return true;
}
async function loadHome(){const {data,error}=await client.from("site_homepage").select("*").eq("id",1).maybeSingle();if(error){msg(error.message,true);return}if(data) fields.forEach(k=>{if($(k))$(k).value=data[k]??""})}
async function saveHome(e){e.preventDefault();const payload={id:1,updated_by:currentUser.id};fields.forEach(k=>payload[k]=$(k).value.trim());const {error}=await client.from("site_homepage").upsert(payload,{onConflict:"id"});if(error)return msg(error.message,true);msg("Halaman utama berhasil disimpan.")}
async function loadPages(){const {data,error}=await client.from("site_pages").select("*").order("nav_order").order("created_at",{ascending:false});if(error)return msg(error.message,true);pages=data||[];renderPages()}
function renderPages(){const body=$("pagesBody");body.innerHTML=pages.length?pages.map(p=>`<tr><td><strong>${esc(p.title)}</strong></td><td>${esc(p.slug)}</td><td><span class="badge ${p.status}">${p.status==="published"?"Terbit":"Draft"}</span></td><td>${p.show_in_nav?"Ya":"Tidak"}</td><td>${p.nav_order||0}</td><td><div class="actions"><button class="btn" onclick="editPage('${p.id}')">Edit</button><a class="btn" target="_blank" href="page.html?slug=${encodeURIComponent(p.slug)}">Lihat</a></div></td></tr>`).join(""):`<tr><td colspan="6">Belum ada halaman.</td></tr>`}
function openModal(p=null){$("pageForm").reset();$("page_id").value=p?.id||"";$("modalTitle").textContent=p?"Edit Halaman":"Tambah Halaman";$("deletePageBtn").hidden=!p;if(p){["title","slug","status","excerpt","content","seo_title","seo_description"].forEach(k=>$("page_"+k).value=p[k]??"");$("nav_order").value=p.nav_order||0;$("show_in_nav").checked=!!p.show_in_nav}$("pageModal").classList.add("show")}
window.editPage=id=>openModal(pages.find(x=>x.id===id));
function closeModal(){$("pageModal").classList.remove("show")}
async function savePage(e){e.preventDefault();const id=$("page_id").value;const payload={title:$("page_title").value.trim(),slug:slugify($("page_slug").value),status:$("page_status").value,excerpt:$("page_excerpt").value.trim(),content:$("page_content").value,seo_title:$("seo_title").value.trim(),seo_description:$("seo_description").value.trim(),show_in_nav:$("show_in_nav").checked,nav_order:Number($("nav_order").value||0),updated_by:currentUser.id};if(!payload.slug)return msg("Slug wajib diisi.",true);let q=id?client.from("site_pages").update(payload).eq("id",id):client.from("site_pages").insert({...payload,created_by:currentUser.id});const {error}=await q;if(error)return msg(error.message,true);closeModal();await loadPages();msg("Halaman berhasil disimpan.")}
async function deletePage(){const id=$("page_id").value;if(!id||!confirm("Hapus halaman ini?"))return;const {error}=await client.from("site_pages").delete().eq("id",id);if(error)return msg(error.message,true);closeModal();await loadPages();msg("Halaman dihapus.")}

document.addEventListener("DOMContentLoaded",async()=>{if(!client)return alert("Supabase client tidak ditemukan.");if(!await guard())return;await Promise.all([loadHome(),loadPages()]);document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab==="homepage"?"homepagePanel":"pagesPanel").classList.add("active")});$("homepageForm").onsubmit=saveHome;$("newPageBtn").onclick=()=>openModal();$("closeModal").onclick=closeModal;$("cancelPageBtn").onclick=closeModal;$("pageForm").onsubmit=savePage;$("deletePageBtn").onclick=deletePage;$("page_title").addEventListener("input",()=>{if(!$("page_id").value)$("page_slug").value=slugify($("page_title").value)});$("menuToggle").onclick=()=>$("topNav").classList.toggle("open");});
