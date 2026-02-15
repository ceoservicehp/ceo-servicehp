document.addEventListener("DOMContentLoaded",()=>{

/* DATA SERVICE */
const services=[
{
name:"Ganti LCD",
price:150000,
img:"images/lcd.jpg",
desc:"Penggantian LCD baru + pemasangan teknisi"
},
{
name:"Ganti Baterai",
price:90000,
img:"images/baterai.jpg",
desc:"Penggantian baterai original"
},
{
name:"Flash Software",
price:80000,
img:"images/software.jpg",
desc:"Perbaikan bootloop"
},
{
name:"Bypass FRP",
price:70000,
img:"images/frp.jpg",
desc:"Unlock akun google"
}
];

let selectedService=null;


/* RENDER */
const container=document.getElementById("products-container");

services.forEach((s,i)=>{
const div=document.createElement("div");
div.className="product-card";

div.innerHTML=`
<img src="${s.img}">
<h4>${s.name}</h4>
<p>Rp ${s.price.toLocaleString()}</p>
<button data-id="${i}">Detail</button>
`;

container.appendChild(div);
});


/* MODAL */
const modal=document.getElementById("product-modal");

container.addEventListener("click",e=>{
if(e.target.tagName!=="BUTTON") return;

const id=e.target.dataset.id;
const s=services[id];
selectedService=s;

document.getElementById("modal-product-img").src=s.img;
document.getElementById("modal-product-name").textContent=s.name;
document.getElementById("modal-product-price").textContent="Rp "+s.price.toLocaleString();
document.getElementById("modal-product-desc").textContent=s.desc;

modal.classList.remove("hidden");
});

document.getElementById("close-product-modal").onclick=()=>modal.classList.add("hidden");

document.getElementById("modal-add-cart").onclick=()=>{
alert("Dipilih: "+selectedService.name);
modal.classList.add("hidden");
};



/* METODE */
const metode=document.getElementById("service-option");
const map=document.getElementById("map-section");
const transport=document.getElementById("transport-section");
const proof=document.getElementById("payment-proof-section");
const ongkir=document.getElementById("transport-fee");

metode.addEventListener("change",()=>{

map.style.display="none";
transport.style.display="none";
proof.style.display="none";

if(metode.value==="toko"){
ongkir.value="Rp 0";
}

if(metode.value==="home"){
map.style.display="block";
transport.style.display="block";
proof.style.display="block";
}

if(metode.value==="paket"){
map.style.display="block";
transport.style.display="block";
}
});


/* GPS */
document.getElementById("getLocation").onclick=()=>{

navigator.geolocation.getCurrentPosition(pos=>{

const lat=pos.coords.latitude;
const lng=pos.coords.longitude;

document.getElementById("customer-coord").value=lat+","+lng;

/* simulasi jarak */
let km=Math.floor(Math.random()*10)+1;
let biaya=20000;

if(km>1) biaya+=(km-1)*3000;

ongkir.value="Rp "+biaya.toLocaleString();
document.getElementById("distance-info").textContent="Estimasi jarak "+km+" KM";

});
};



/* SUBMIT */
document.getElementById("checkout").onclick=()=>{

const nama=document.getElementById("customer-name").value.trim();
const alamat=document.getElementById("customer-address").value.trim();
const phone=document.getElementById("customer-phone").value.trim();
const brand=document.getElementById("customer-brand").value.trim();
const problem=document.getElementById("customer-problem").value.trim();
const method=metode.value;

if(!nama||!alamat||!phone||!brand||!problem||!method){
alert("Lengkapi data");
return;
}

if(!selectedService){
alert("Pilih service dulu");
return;
}

let msg=`📱 *SERVICE HP*%0A`;
msg+=`Nama: ${nama}%0A`;
msg+=`Alamat: ${alamat}%0A`;
msg+=`HP: ${phone}%0A`;
msg+=`Merk: ${brand}%0A`;
msg+=`Keluhan: ${problem}%0A`;
msg+=`Service: ${selectedService.name}%0A`;
msg+=`Metode: ${method}`;

window.open(`https://wa.me/6281234567890?text=${msg}`);
};

});
