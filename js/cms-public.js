"use strict";

(() => {
  const client = window.supabaseClient;
  if (!client) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined && value !== "") el.textContent = value;
  };
  const setHref = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.href = value;
  };

  async function loadHomepage(){
    const { data, error } = await client
      .from("site_homepage")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return;

    setText("cmsHeroBadge", data.hero_badge);
    if (data.hero_title) {
      const h = document.getElementById("cmsHeroTitle");
      if (h) h.textContent = data.hero_title;
    }
    setText("cmsHeroDescription", data.hero_description);
    const p = document.querySelector("#cmsHeroPrimary span");
    if (p && data.hero_primary_text) p.textContent = data.hero_primary_text;
    setHref("cmsHeroPrimary", data.hero_primary_url);
    const s = document.querySelector("#cmsHeroSecondary span");
    if (s && data.hero_secondary_text) s.textContent = data.hero_secondary_text;
    setHref("cmsHeroSecondary", data.hero_secondary_url);

    setText("cmsServicesLabel", data.services_label);
    setText("cmsServicesTitle", data.services_title);
    setText("cmsServicesSubtitle", data.services_subtitle);
    setText("cmsWhyLabel", data.why_label);
    setText("cmsWhyTitle", data.why_title);
    setText("cmsWhySubtitle", data.why_subtitle);
    setText("cmsContactTitle", data.contact_title);
    setText("cmsContactShort", data.contact_short);
    setText("cmsContactAddress", data.contact_address);
    setText("cmsContactPhone", data.contact_phone ? `📞 ${data.contact_phone}` : "");
    setHref("cmsContactWhatsapp", data.whatsapp_url);

    if (data.hero_image_url) {
      document.querySelector(".hero")?.style.setProperty("--cms-hero-image", `url('${data.hero_image_url}')`);
      const hero = document.querySelector(".hero");
      if (hero) hero.style.background = `linear-gradient(rgba(13,57,64,.64),rgba(17,86,94,.58)),url('${data.hero_image_url}') center/cover no-repeat`;
    }
  }

  async function loadNavigation(){
    const { data, error } = await client.from("site_pages")
      .select("title,slug,show_in_nav,nav_order")
      .eq("status","published")
      .eq("show_in_nav",true)
      .order("nav_order",{ascending:true});
    if (error || !data?.length) return;
    const nav = document.getElementById("topNav");
    if (!nav) return;
    data.forEach(page => {
      const a = document.createElement("a");
      a.href = `page.html?slug=${encodeURIComponent(page.slug)}`;
      a.innerHTML = `<i class="fa-regular fa-file-lines"></i> ${escapeHtml(page.title)}`;
      nav.appendChild(a);
    });
  }

  function escapeHtml(v=""){
    return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadHomepage();
    loadNavigation();
  });
})();
