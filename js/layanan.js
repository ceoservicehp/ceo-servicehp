document.addEventListener("DOMContentLoaded",()=>{

/* ================= DATA SERVICE ================= */
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
let transportCost=0;


/* ================= ELEMENT ================= */
const container=document.getElementById("products-container");
const modal=document.getElementById("product-modal");

const servicePriceEl=document.getElementById("service-price");
const transportPriceEl=document.getElementById("transport-price");
const totalPriceEl=document.getElementById("total-price");

const metode=document.getElementById("service-option");
const map=document.getElementById("map-section");
const transport=document.getElementById("transport-section");
const proof=document.getElementById("payment-proof-section");
const ongkir=document.getElementById("transport-fee");


/* ================= HELPER ================= */
function rupiah(n){
return "Rp "+Number(n).toLocaleString("id-ID");
}

function updateTotal(){
const jasa=selectedService?.price || 0;
const total=jasa+transportCost;

servicePriceEl.textContent=rupiah(jasa);
transportPriceEl.textContent=rupiah(transportCost);
totalPriceEl.textContent=rupiah(total);
}


/* ================= RENDER SERVICE ================= */
services.forEach((s,i)=>{
const div=document.createElement("div");
div.className="product-card";

div.innerHTML=`
<img src="${s.img}">
<h4>${s.name}</h4>
<p>${rupiah(s.price)}</p>
<button data-id="${i}">Detail</button>
`;

container.appendChild(div);
});


/* ================= MODAL ================= */
container.addEventListener("click",e=>{
if(e.target.tagName!=="BUTTON") return;

const id=e.target.dataset.id;
const s=services[id];
selectedService=s;

document.getElementById("modal-product-img").src=s.img;
document.getElementById("modal-product-name").textContent=s.name;
document.getElementById("modal-product-price").textContent=rupiah(s.price);
document.getElementById("modal-product-desc").textContent=s.desc;

modal.classList.remove("hidden");
});

document.getElementById("close-product-modal").onclick=
()=>modal.classList.add("hidden");


document.getElementById("modal-add-cart").onclick=()=>{
if(!selectedService) return;

updateTotal();
modal.classList.add("hidden");

alert("Service dipilih: "+selectedService.name);
};


/* ================= METODE SERVICE ================= */
metode.addEventListener("change",()=>{

map.style.display="none";
transport.style.display="none";
proof.style.display="none";
transportCost=0;

if(metode.value==="toko"){
transportCost=0;
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

updateTotal();
});


/* ================= GPS ================= */
document.getElementById("getLocation").onclick=()=>{

navigator.geolocation.getCurrentPosition(pos=>{

const lat=pos.coords.latitude;
const lng=pos.coords.longitude;

document.getElementById("customer-coord").value=lat+","+lng;

/* simulasi jarak */
let km=Math.floor(Math.random()*10)+1;

/* rumus ongkir */
let biaya=20000;
if(km>1) biaya+=(km-1)*3000;

transportCost=biaya;
ongkir.value=rupiah(biaya);

document.getElementById("distance-info").textContent=
"Estimasi jarak "+km+" KM";

updateTotal();

});
};


/* ================= SUBMIT ================= */
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

let total=(selectedService.price||0)+transportCost;

let msg=`📱 *SERVICE HP*%0A`;
msg+=`Nama: ${nama}%0A`;
msg+=`Alamat: ${alamat}%0A`;
msg+=`HP: ${phone}%0A`;
msg+=`Merk: ${brand}%0A`;
msg+=`Keluhan: ${problem}%0A`;
msg+=`Service: ${selectedService.name}%0A`;
msg+=`Metode: ${method}%0A`;
msg+=`Total: ${rupiah(total)}`;

window.open(`https://wa.me/6281234567890?text=${msg}`);
};

});
