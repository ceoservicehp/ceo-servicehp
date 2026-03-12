document.addEventListener("DOMContentLoaded", () => {

/* ================= SMOOTH SCROLL NAV ================= */
document.querySelectorAll(".nav-menu a").forEach(link => {
  link.addEventListener("click", function(e){
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if(target){
      target.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
});


/* ================= SIMPLE ANIMATION ON SCROLL ================= */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.style.opacity = 1;
      entry.target.style.transform = "translateY(0)";
    }
  });
},{
  threshold: 0.1
});

document.querySelectorAll(".section, .card, .contact")
.forEach(el=>{
  el.style.opacity = 0;
  el.style.transform = "translateY(40px)";
  el.style.transition = "all .6s ease";
  observer.observe(el);
});


/* ================= HERO BUTTON CLICK ================= */
const heroBtn = document.querySelector(".btn-primary");

if(heroBtn){
  heroBtn.addEventListener("click", ()=>{
    const layanan = document.getElementById("layanan");
    if(layanan){
      layanan.scrollIntoView({ behavior:"smooth" });
    }
  });
}

});

/* ================= Accordion ================= */
document.addEventListener("DOMContentLoaded", function(){

  const accordions = document.querySelectorAll(".accordion");

  accordions.forEach(acc => {
    acc.addEventListener("click", function(){

      const panel = this.nextElementSibling;
      const isOpen = this.classList.contains("active");

      // Tutup semua dulu
      accordions.forEach(a => {
        a.classList.remove("active");
        const p = a.nextElementSibling;
        p.style.maxHeight = null;
      });

      // Jika belum terbuka, buka
      if(!isOpen){
        this.classList.add("active");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }

    });
  });

});

/* ================= Slider ================= */

document.addEventListener("DOMContentLoaded",()=>{

const track = document.querySelector(".marquee-track");

let speed = 0.5;
let scroll = 0;
let isDragging = false;
let startX;
let scrollStart;

function animate(){

if(!isDragging){

scroll += speed;
track.style.transform = `translateX(-${scroll}px)`;

const firstCard = track.children[0];
const cardWidth = firstCard.offsetWidth + 20;

if(scroll >= cardWidth){

track.appendChild(firstCard);
scroll -= cardWidth;

}

}

requestAnimationFrame(animate);
}

animate();


/* DRAG */

track.addEventListener("mousedown",(e)=>{

isDragging = true;
startX = e.pageX;
scrollStart = scroll;

});

window.addEventListener("mouseup",()=>{

isDragging = false;

});

window.addEventListener("mousemove",(e)=>{

if(!isDragging) return;

const move = (e.pageX - startX);

scroll = scrollStart - move;

track.style.transform = `translateX(-${scroll}px)`;

});

});
