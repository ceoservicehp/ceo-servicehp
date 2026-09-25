"use strict";
(() => {
  const current=(location.pathname.split("/").pop()||"").toLowerCase();
  const groups=window.CEO_ADMIN_NAV||[];

  function html(){
    return `
      <a class="ceo-nav-home" href="index.html">
        <i class="fa-solid fa-house"></i><span>Beranda</span>
      </a>
      ${groups.map((g,idx)=>`
        <div class="ceo-nav-group ${g.pages.includes(current)?"section-active":""}" data-ceo-group="${idx}">
          <button class="ceo-nav-trigger" type="button" aria-expanded="false">
            <i class="fa-solid ${g.icon}"></i><span>${g.label}</span>
            <i class="fa-solid fa-chevron-down ceo-nav-chevron"></i>
          </button>
          <div class="ceo-nav-dropdown">
            ${g.items.map(i=>`<a href="${i.href}" class="${current===i.href?"active":""}" ${i.external?'target="_blank" rel="noopener"':""}>
              <i class="fa-solid ${i.icon}"></i><span>${i.label}</span>
            </a>`).join("")}
          </div>
        </div>`).join("")}`;
  }

  let nav=document.querySelector("header .top-nav, header nav#topNav, header nav.top-nav");
  if(!nav){
    const outside=document.querySelector("body > nav.top-nav");
    if(outside){
      nav=outside;
      const header=document.querySelector("header");
      if(header) header.appendChild(nav);
    }
  }
  if(!nav){
    const header=document.querySelector("header");
    if(!header) return;
    nav=document.createElement("nav");
    header.appendChild(nav);
  }

  nav.id="topNav";
  nav.classList.add("ceo-admin-nav");
  nav.setAttribute("aria-label","Navigasi admin CEO");
  nav.innerHTML=html();

  let toggle=document.getElementById("menuToggle");
  if(!toggle){
    toggle=document.createElement("button");
    toggle.id="menuToggle";
    toggle.type="button";
    toggle.className="ceo-nav-mobile-toggle";
    toggle.setAttribute("aria-label","Buka navigasi admin");
    toggle.innerHTML='<i class="fa-solid fa-bars"></i>';
    nav.parentElement?.insertBefore(toggle,nav);
  }

  toggle.addEventListener("click",()=>nav.classList.toggle("ceo-mobile-open"));

  const close=(except=null)=>nav.querySelectorAll(".ceo-nav-group.open").forEach(g=>{
    if(g!==except){
      g.classList.remove("open");
      g.querySelector(".ceo-nav-trigger")?.setAttribute("aria-expanded","false");
    }
  });

  nav.querySelectorAll(".ceo-nav-trigger").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.preventDefault(); e.stopPropagation();
      const group=btn.closest(".ceo-nav-group");
      const open=!group.classList.contains("open");
      close(group);
      group.classList.toggle("open",open);
      btn.setAttribute("aria-expanded",open?"true":"false");
    });
  });
  nav.querySelectorAll(".ceo-nav-dropdown").forEach(x=>x.addEventListener("click",e=>e.stopPropagation()));
  document.addEventListener("click",()=>close());
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){ close(); nav.classList.remove("ceo-mobile-open"); }
  });
})();