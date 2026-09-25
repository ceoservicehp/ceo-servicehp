"use strict";
(() => {
  if (document.getElementById("ceoAdminGlobalNav")) return;

  const current=(location.pathname.split("/").pop()||"").toLowerCase();
  const groups=[
    {label:"Service",icon:"fa-screwdriver-wrench",pages:["dapur.html","keuangan.html"],items:[
      ["dapur.html","Dapur / Order Service","fa-kitchen-set"],
      ["keuangan.html","Keuangan Service","fa-wallet"]
    ]},
    {label:"Produk HP",icon:"fa-mobile-screen-button",pages:["produk.html","order-produk.html","keuangan-produk.html","histori-imei.html","garansi-produk.html"],items:[
      ["produk.html","Kelola Produk","fa-box-open"],
      ["order-produk.html","Order Produk","fa-cart-shopping"],
      ["keuangan-produk.html","Keuangan Produk","fa-chart-line"],
      ["histori-imei.html","Histori IMEI","fa-barcode"],
      ["garansi-produk.html","Garansi Produk","fa-shield-halved"]
    ]},
    {label:"Administrasi",icon:"fa-user-gear",pages:["admin-users.html","profile.html"],items:[
      ["profile.html","Profil Akun","fa-user"],
      ["admin-users.html","Kelola Admin","fa-users-gear"]
    ]},
    {label:"Website",icon:"fa-globe",pages:["kelola-website.html"],items:[
      ["kelola-website.html","Kelola Website","fa-pen-ruler"],
      ["index.html","Lihat Website","fa-arrow-up-right-from-square"]
    ]}
  ];

  const nav=document.createElement("nav");
  nav.id="ceoAdminGlobalNav";
  nav.className="ceo-admin-global-nav";
  nav.setAttribute("aria-label","Navigasi admin CEO Part & Service");
  nav.innerHTML=`
    <div class="ceo-admin-global-inner">
      <a class="ceo-admin-global-home" href="dapur.html" title="Panel Admin">
        <i class="fa-solid fa-shield-halved"></i><span>CEO ADMIN</span>
      </a>
      <button class="ceo-admin-global-mobile-toggle" type="button" aria-label="Buka menu admin"><i class="fa-solid fa-bars"></i></button>
      <div class="ceo-admin-global-scroll">
        ${groups.map((g,gi)=>{
          const active=g.pages.includes(current);
          return `<div class="ceo-admin-global-item" data-global-group="${gi}">
            <button class="ceo-admin-global-trigger ${active?"active":""}" type="button">
              <i class="fa-solid ${g.icon}"></i><span>${g.label}</span><i class="fa-solid fa-chevron-down chev"></i>
            </button>
            <div class="ceo-admin-global-menu">
              ${g.items.map(i=>`<a href="${i[0]}" class="${current===i[0]?"active":""}" ${i[0]==="index.html"?'target="_blank" rel="noopener"':""}><i class="fa-solid ${i[2]}"></i>${i[1]}</a>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="ceo-admin-global-actions">
        <a href="profile.html" title="Profil"><i class="fa-solid fa-user"></i></a>
        <button id="ceoGlobalLogoutBtn" type="button" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    </div>`;

  const header=document.querySelector("header");
  if(header) header.insertAdjacentElement("afterend",nav);
  else document.body.prepend(nav);

  const closeAll=(except=null)=>nav.querySelectorAll(".ceo-admin-global-item.open").forEach(x=>{if(x!==except)x.classList.remove("open")});
  nav.querySelectorAll(".ceo-admin-global-trigger").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation(); const item=btn.closest(".ceo-admin-global-item"), will=!item.classList.contains("open");
    closeAll(item); item.classList.toggle("open",will);
  }));
  nav.querySelector(".ceo-admin-global-mobile-toggle")?.addEventListener("click",()=>nav.classList.toggle("mobile-open"));
  document.addEventListener("click",()=>closeAll());
  window.addEventListener("resize",()=>{if(innerWidth>680)nav.classList.remove("mobile-open")});

  document.getElementById("ceoGlobalLogoutBtn")?.addEventListener("click",async()=>{
    try{
      const sb=window.supabaseClient || window.supabase;
      if(sb?.auth?.signOut) await sb.auth.signOut();
    }catch(err){console.warn("Logout global:",err)}
    localStorage.removeItem("userRole");
    location.href="login.html";
  });
})();