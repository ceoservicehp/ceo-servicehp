"use strict";
(() => {
  const PAGES = {
    "produk.html": {label:"Produk", icon:"fa-box-open", badge:"Manajemen Katalog", title:"Kelola <span>Produk HP</span>", desc:"Tambah produk, kategori, varian, harga, promo, gambar dan stok dengan tampilan administrasi yang terhubung ke katalog CEO Part & Service.", action:"#"},
    "order-produk.html": {label:"Order HP", icon:"fa-cart-shopping", badge:"Administrasi Penjualan", title:"Kelola <span>Order HP</span>", desc:"Pantau pembayaran, ongkir, proses pesanan, pengiriman, IMEI dan penyelesaian order dalam satu area penjualan.", action:"#"},
    "keuangan-produk.html": {label:"Keuangan", icon:"fa-chart-line", badge:"Keuangan Produk", title:"Ringkasan <span>Keuangan HP</span>", desc:"Pantau omzet produk, modal, laba kotor, uang masuk, piutang dan ongkir khusus penjualan handphone.", action:"#"},
    "histori-imei.html": {label:"Histori IMEI", icon:"fa-mobile-screen-button", badge:"Histori Penjualan", title:"Histori <span>Penjualan & IMEI</span>", desc:"Telusuri unit yang telah terjual berdasarkan nomor order, pelanggan, produk, IMEI dan serial number.", action:"#"},
    "garansi-produk.html": {label:"Garansi", icon:"fa-shield-halved", badge:"Garansi Berbasis IMEI", title:"Kelola <span>Garansi Produk</span>", desc:"Atur masa garansi setiap unit fisik berdasarkan IMEI atau serial number dan pantau status garansinya.", action:"#"},
    "klaim-garansi-produk.html": {label:"Klaim", icon:"fa-screwdriver-wrench", badge:"Klaim Garansi", title:"Kelola <span>Klaim Garansi</span>", desc:"Catat pengajuan, pemeriksaan, proses, solusi dan penyelesaian klaim garansi setiap unit HP.", action:"#"}
  };
  const ITEMS = Object.entries(PAGES).map(([href,p])=>({href,label:p.label,icon:p.icon}));
  const file = (() => ((location.pathname||"").split("/").pop() || "produk.html").toLowerCase())();
  const page = PAGES[file] || PAGES["produk.html"];

  function headerHTML(){return `
    <header class="public-header" id="ceoProductAdminHeader">
      <div class="header-inner">
        <a href="produk.html" class="brand">
          <img src="images/logo.png" alt="CEO Part & Service">
          <div class="brand-text"><strong>CEO PART & SERVICE</strong><span>ADMIN PENJUALAN HANDPHONE</span></div>
        </a>
        <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Buka menu" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
        <nav class="main-nav" id="mainNav">
          ${ITEMS.map(x=>`<a href="${x.href}" class="${file===x.href?'active':''}" ${file===x.href?'aria-current="page"':''}><i class="fa-solid ${x.icon}"></i>${x.label}</a>`).join('')}
        </nav>
      </div>
    </header>`}

  function heroHTML(){return `
    <section class="admin-product-hero" id="adminProductHero">
      <div class="admin-hero-content">
        <div class="admin-hero-badge"><i class="fa-solid ${page.icon}"></i>${page.badge}</div>
        <h1>${page.title}</h1>
        <p>${page.desc}</p>
        <div class="admin-hero-actions">
          <a class="admin-hero-button" href="#adminMainContent"><i class="fa-solid fa-arrow-down"></i>Lihat Data</a>
          <a class="admin-hero-button secondary" href="produk-public.html"><i class="fa-solid fa-store"></i>Lihat Katalog Publik</a>
        </div>
      </div>
    </section>`}

  function footerHTML(){return `
    <footer class="public-footer" id="ceoProductAdminFooter">
      <div class="footer-inner">
        <div class="footer-brand"><img src="images/logo.png" alt="CEO Part & Service"><div><strong>CEO PART & SERVICE</strong><p>Admin Penjualan Handphone · Cellular Engineering Officer</p></div></div>
        <div class="footer-links"><a href="produk.html">Produk</a><a href="order-produk.html">Order HP</a><a href="keuangan-produk.html">Keuangan</a><a href="histori-imei.html">Histori IMEI</a><a href="garansi-produk.html">Garansi</a><a href="klaim-garansi-produk.html">Klaim</a></div>
        <div class="footer-copy"><p>© <span id="ceoProductFooterYear"></span> CEO Part & Service — All Rights Reserved</p></div>
      </div>
    </footer>`}

  function init(){
    if(document.getElementById("ceoProductAdminHeader")) return;
    document.body.classList.add("ceo-product-admin-public");
    document.body.insertAdjacentHTML("afterbegin", headerHTML()+heroHTML());
    const main = document.querySelector("body > main");
    if(main) main.id = main.id || "adminMainContent";
    document.body.insertAdjacentHTML("beforeend", footerHTML());
    const year=document.getElementById("ceoProductFooterYear"); if(year) year.textContent=new Date().getFullYear();

    const btn=document.getElementById("mobileMenuBtn"), nav=document.getElementById("mainNav"), header=document.getElementById("ceoProductAdminHeader");
    const close=()=>{nav?.classList.remove("show");btn?.setAttribute("aria-expanded","false");const i=btn?.querySelector("i");if(i)i.className="fa-solid fa-bars"};
    btn?.addEventListener("click",()=>{const open=nav.classList.toggle("show");btn.setAttribute("aria-expanded",String(open));const i=btn.querySelector("i");if(i)i.className=open?"fa-solid fa-xmark":"fa-solid fa-bars"});
    nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",close));
    document.addEventListener("click",e=>{if(window.innerWidth<=760&&nav?.classList.contains("show")&&!header.contains(e.target))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    window.addEventListener("resize",()=>{if(window.innerWidth>760)close()});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
