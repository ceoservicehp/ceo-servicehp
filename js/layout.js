document.addEventListener("DOMContentLoaded", async () => {

  const header = document.getElementById("header-global");
  const footer = document.getElementById("footer-global");

  if(header){
    const res = await fetch("/components/header.html");
    header.innerHTML = await res.text();
  }

  if(footer){
    const res = await fetch("/components/footer.html");
    footer.innerHTML = await res.text();
  }

});

const currentPage = window.location.pathname.split("/").pop();

document.querySelectorAll(".nav-btn").forEach(link=>{
  if(link.getAttribute("href") === currentPage){
    link.style.background = "#1f6f78";
    link.style.color = "white";
  }
});
