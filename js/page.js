"use strict";
(async()=>{
  const client=window.supabaseClient;
  const slug=new URLSearchParams(location.search).get("slug");
  const {data:site}=await client.from("site_settings").select("site_name,tagline,logo_url,footer_text,favicon_url").eq("id",1).maybeSingle();if(site){document.querySelectorAll(".brand strong").forEach(x=>{if(site.site_name)x.textContent=site.site_name});document.querySelectorAll(".brand span").forEach(x=>{if(site.tagline)x.textContent=site.tagline});document.querySelectorAll(".brand img").forEach(x=>{if(site.logo_url)x.src=site.logo_url});if(site.footer_text)document.getElementById("pageFooter").textContent=site.footer_text;if(site.favicon_url){let l=document.createElement("link");l.rel="icon";l.href=site.favicon_url;document.head.appendChild(l)}}
  if(!client||!slug)return show404();
  const {data,error}=await client.from("site_pages").select("title,excerpt,content,featured_image,seo_title,seo_description,status").eq("slug",slug).eq("status","published").maybeSingle();
  if(error||!data)return show404();
  document.title=data.seo_title||`${data.title} | CEO Part & Service`;
  if(data.seo_description){let m=document.querySelector('meta[name="description"]');if(!m){m=document.createElement("meta");m.name="description";document.head.appendChild(m)}m.content=data.seo_description}
  document.getElementById("pageTitle").textContent=data.title;
  document.getElementById("pageExcerpt").textContent=data.excerpt||"";
  const cover=document.getElementById("pageCover");
  if(data.featured_image){cover.src=data.featured_image;cover.alt=data.title;cover.hidden=false}
  document.getElementById("pageContent").innerHTML=sanitize(data.content||"");
  function show404(){document.getElementById("pageTitle").textContent="Halaman tidak ditemukan";document.getElementById("pageContent").innerHTML="<p>Halaman belum tersedia atau belum diterbitkan.</p>"}
  function sanitize(html){const t=document.createElement("template");t.innerHTML=html;t.content.querySelectorAll("script,iframe,object,embed,form").forEach(x=>x.remove());t.content.querySelectorAll("*").forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name);if((a.name==="href"||a.name==="src")&&/^javascript:/i.test(a.value))el.removeAttribute(a.name)}));return t.innerHTML}
})();
