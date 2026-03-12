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

const track = document.querySelector(".marquee-wrapper");
const content = document.querySelector(".marquee-track");

if(!track || !content) return;

let speed = 0.5;
let isDown = false;
let startX;
let scrollLeft;
let isDragging = false;
let isHover = false;


/* ===== AUTO SCROLL ===== */

function autoScroll(){

if(!isDragging && !isHover){

track.scrollLeft += speed;

if(track.scrollLeft >= content.scrollWidth / 2){
track.scrollLeft -= content.scrollWidth / 2;
}

}

requestAnimationFrame(autoScroll);
}

autoScroll();


/* ===== PAUSE HOVER ===== */

track.addEventListener("mouseenter",()=> isHover = true);
track.addEventListener("mouseleave",()=> isHover = false);


/* ===== DRAG DESKTOP ===== */

track.addEventListener("mousedown",(e)=>{

isDown = true;
isDragging = true;

startX = e.pageX - track.offsetLeft;
scrollLeft = track.scrollLeft;

track.style.cursor = "grabbing";

});

track.addEventListener("mouseup",()=>{

isDown = false;
track.style.cursor = "grab";

setTimeout(()=> isDragging=false,200);

});

track.addEventListener("mouseleave",()=>{

isDown = false;
track.style.cursor = "grab";

setTimeout(()=> isDragging=false,200);

});

track.addEventListener("mousemove",(e)=>{

if(!isDown) return;

e.preventDefault();

const x = e.pageX - track.offsetLeft;
const walk = (x - startX) * 2;

track.scrollLeft = scrollLeft - walk;

});


/* ===== TOUCH MOBILE ===== */

track.addEventListener("touchstart",(e)=>{

isDragging = true;

startX = e.touches[0].pageX;
scrollLeft = track.scrollLeft;

});

track.addEventListener("touchmove",(e)=>{

const x = e.touches[0].pageX;
const walk = (x - startX) * 2;

track.scrollLeft = scrollLeft - walk;

},{ passive:true });

track.addEventListener("touchend",()=>{

setTimeout(()=> isDragging=false,200);

});

});
