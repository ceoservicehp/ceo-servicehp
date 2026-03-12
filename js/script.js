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

let speed = 0.6;
let position = 0;
let isHover = false;
let isDragging = false;

let startX;
let startPos;


/* ===== AUTO SCROLL ===== */

function animate(){

if(!isHover && !isDragging){

position += speed;
track.style.transform = `translate3d(-${position}px,0,0)`;

const firstCard = track.children[0];
const cardWidth = firstCard.offsetWidth + 20;

if(position >= cardWidth){

track.appendChild(firstCard);
position -= cardWidth;

}

}

requestAnimationFrame(animate);
}

animate();


/* ===== HOVER PAUSE ===== */

track.addEventListener("mouseenter",()=> isHover = true);
track.addEventListener("mouseleave",()=> isHover = false);


/* ===== DRAG DESKTOP ===== */

track.addEventListener("mousedown",(e)=>{

isDragging = true;
startX = e.pageX;
startPos = position;

track.style.cursor="grabbing";

});

window.addEventListener("mouseup",()=>{

isDragging=false;
track.style.cursor="grab";

});

window.addEventListener("mousemove",(e)=>{

if(!isDragging) return;

const move = e.pageX - startX;
position = startPos - move;

track.style.transform = `translate3d(-${position}px,0,0)`;

});


/* ===== TOUCH MOBILE ===== */

track.addEventListener("touchstart",(e)=>{

isDragging = true;
startX = e.touches[0].pageX;
startPos = position;

});

track.addEventListener("touchmove",(e)=>{

const move = e.touches[0].pageX - startX;
position = startPos - move;

track.style.transform = `translate3d(-${position}px,0,0)`;

});

track.addEventListener("touchend",()=>{

isDragging=false;

});

});
