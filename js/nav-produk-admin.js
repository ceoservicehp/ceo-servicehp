"use strict";

(() => {
  const ITEMS = [
    { href: "produk.html", label: "Produk", icon: "fa-box-open" },
    { href: "order-produk.html", label: "Order HP", icon: "fa-cart-shopping" },
    { href: "keuangan-produk.html", label: "Keuangan", icon: "fa-chart-line" },
    { href: "histori-imei.html", label: "Histori IMEI", icon: "fa-mobile-screen-button" },
    { href: "garansi-produk.html", label: "Garansi", icon: "fa-shield-halved" },
    { href: "klaim-garansi-produk.html", label: "Klaim", icon: "fa-screwdriver-wrench" }
  ];

  const currentFile = () => ((location.pathname || "").split("/").pop() || "produk.html").toLowerCase();

  function init() {
    if (document.getElementById("ceoProductAdminHeader")) return;
    document.body.classList.add("ceo-product-admin-topnav");

    const header = document.createElement("header");
    header.id = "ceoProductAdminHeader";
    header.className = "ceo-product-public-header";
    header.innerHTML = `
      <div class="ceo-product-header-inner">
        <a class="ceo-product-brand" href="produk.html" aria-label="CEO Penjualan HP">
          <img src="images/logo.png" alt="Logo CEO Part & Service" onerror="this.style.display='none'">
          <div class="ceo-product-brand-text">
            <strong>CEO PART & SERVICE</strong>
            <span>ADMIN PENJUALAN HP</span>
          </div>
        </a>
        <button class="ceo-product-mobile-menu-btn" id="ceoProductMenuBtn" type="button" aria-label="Buka menu" aria-expanded="false">
          <i class="fa-solid fa-bars"></i>
        </button>
        <nav class="ceo-product-main-nav" id="ceoProductMainNav" aria-label="Navigasi penjualan HP">
          ${ITEMS.map(item => {
            const active = currentFile() === item.href.toLowerCase();
            return `<a href="${item.href}" class="${active ? "active" : ""}" ${active ? 'aria-current="page"' : ''}><i class="fa-solid ${item.icon}"></i><span>${item.label}</span></a>`;
          }).join("")}
        </nav>
      </div>`;

    document.body.prepend(header);

    const btn = document.getElementById("ceoProductMenuBtn");
    const nav = document.getElementById("ceoProductMainNav");
    const close = () => {
      nav.classList.remove("show");
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    };

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("show");
      btn.setAttribute("aria-expanded", String(open));
      btn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
    document.addEventListener("click", e => {
      if (window.innerWidth <= 760 && nav.classList.contains("show") && !header.contains(e.target)) close();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 760) close(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
