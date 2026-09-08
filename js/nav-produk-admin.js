"use strict";

(() => {
  const ITEMS = [
    { href: "produk.html", label: "Kelola Produk", icon: "fa-box-open", keys: ["produk.html"] },
    { href: "order-produk.html", label: "Order HP", icon: "fa-cart-shopping", keys: ["order-produk.html"] },
    { href: "keuangan-produk.html", label: "Keuangan HP", icon: "fa-chart-line", keys: ["keuangan-produk.html"] },
    { href: "histori-imei.html", label: "Histori & IMEI", icon: "fa-mobile-screen-button", keys: ["histori-imei.html"] },
    { href: "garansi-produk.html", label: "Garansi Produk", icon: "fa-shield-halved", keys: ["garansi-produk.html"] },
    { href: "klaim-garansi-produk.html", label: "Klaim Garansi", icon: "fa-screwdriver-wrench", keys: ["klaim-garansi-produk.html"] }
  ];

  function currentFile(){
    const path = (location.pathname || "").split("/").pop();
    return (path || "produk.html").toLowerCase();
  }

  function isActive(item){
    const file = currentFile();
    return item.keys.some(k => file === k.toLowerCase());
  }

  function closeNav(){
    document.body.classList.remove("ceo-product-nav-open");
    document.getElementById("ceoProductNavToggle")?.setAttribute("aria-expanded","false");
  }

  function init(){
    if(document.getElementById("ceoProductAdminNav")) return;

    document.body.classList.add("ceo-product-admin-nav");

    const aside = document.createElement("aside");
    aside.id = "ceoProductAdminNav";
    aside.setAttribute("aria-label", "Navigasi Penjualan HP");

    const links = ITEMS.map(item => `
      <a class="ceo-product-nav-link${isActive(item) ? " active" : ""}" href="${item.href}"${isActive(item) ? ' aria-current="page"' : ""}>
        <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
      </a>`).join("");

    aside.innerHTML = `
      <div class="ceo-product-nav-brand">
        <a href="produk.html">
          <img class="ceo-product-nav-logo" src="images/logo.png" alt="CEO" onerror="this.style.display='none'">
          <div><strong>CEO PART & SERVICE</strong><span>PENJUALAN HANDPHONE</span></div>
        </a>
      </div>
      <div class="ceo-product-nav-section">
        <div class="ceo-product-nav-label">Menu Produk HP</div>
        <nav class="ceo-product-nav-list">${links}</nav>
      </div>
      <div class="ceo-product-nav-spacer"></div>
      <div class="ceo-product-nav-footer">
        <a class="ceo-product-nav-link" href="index.html"><i class="fa-solid fa-arrow-left"></i><span>Kembali ke Beranda</span></a>
        <div class="ceo-product-nav-version">Cellular Engineering Officer</div>
      </div>`;

    const toggle = document.createElement("button");
    toggle.id = "ceoProductNavToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Buka menu penjualan HP");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';

    const overlay = document.createElement("div");
    overlay.id = "ceoProductNavOverlay";

    document.body.prepend(overlay);
    document.body.prepend(toggle);
    document.body.prepend(aside);

    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("ceo-product-nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    overlay.addEventListener("click", closeNav);
    aside.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      if(window.innerWidth <= 980) closeNav();
    }));
    document.addEventListener("keydown", e => { if(e.key === "Escape") closeNav(); });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
