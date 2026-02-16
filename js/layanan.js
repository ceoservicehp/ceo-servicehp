document.addEventListener("DOMContentLoaded",()=>{

/* ================= DATA SERVICE ================= */
const services=[
{name:"Ganti LCD",price:150000,img:"images/lcd.jpg"},
{name:"Ganti Baterai",price:90000,img:"images/baterai.jpg"},
{name:"Flash Software",price:80000,img:"images/software.jpg"},
{name:"Bypass FRP",price:70000,img:"images/frp.jpg"}
];

let selectedService=null;
let spareparts=[];
let transportCost=0;

const TOKO_LAT=-6.200000;
const TOKO_LNG=106.816666;

/* ================= ELEMENT ================= */
const container=document.getElementById("products-container");
const metode=document.getElementById("service-option");
const mapSection=document.getElementById("map-section");
const transport=document.getElementById("transport-section");
const proof=document.getElementById("payment-proof-section");

const servicePriceEl=document.getElementById("service-price");
const sparepartPriceEl=document.getElementById("sparepart-price");
const transportPriceEl=document.getElementById("transport-price");
const totalPriceEl=document.getElementById("total-price");

const ongkir=document.getElementById("transport-fee");
const coordInput=document.getElementById("customer-coord");
const distanceInfo=document.getElementById("distance-info");

let mapInstance=null;
let marker=null;

/* ================= HELPER ================= */
function rupiah(n){
return "Rp "+Number(n).toLocaleString("id-ID");
}

/* ================= TOTAL ================= */
function updateTotal(){

const jasa=selectedService?.price||0;
const spare=spareparts.reduce((a,b)=>a+b.price,0);
const total=jasa+spare+transportCost;

servicePriceEl.textContent=rupiah(jasa);
sparepartPriceEl.textContent=rupiah(spare);
transportPriceEl.textContent=rupiah(transportCost);
totalPriceEl.textContent=rupiah(total);
}

/* ================= JARAK ================= */
function hitungJarak(lat,lng){

const R=6371;
const dLat=(lat-TOKO_LAT)*Math.PI/180;
const dLng=(lng-TOKO_LNG)*Math.PI/180;

const a=
Math.sin(dLat/2)**2+
Math.cos(TOKO_LAT*Math.PI/180)*
Math.cos(lat*Math.PI/180)*
Math.sin(dLng/2)**2;

return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function hitungOngkir(km){

km=Math.ceil(km);
let biaya=20000;
if(km>1) biaya+=(km-1)*3000;
return {biaya,km};
}

/* ================= SET LOCATION ================= */
function setLocation(lat,lng){

coordInput.value=lat+","+lng;
if(marker) marker.setLatLng([lat,lng]);

if(metode.value==="toko") return;

const jarak=hitungJarak(lat,lng);
const res=hitungOngkir(jarak);

transportCost=res.biaya;
ongkir.value=rupiah(res.biaya);
distanceInfo.textContent="Jarak "+res.km+" KM";

updateTotal();
}

/* ================= MAP ================= */
function initMap(){
if(mapInstance) return;

mapInstance=L.map("map").setView([TOKO_LAT,TOKO_LNG],13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapInstance);

marker=L.marker([TOKO_LAT,TOKO_LNG]).addTo(mapInstance);

mapInstance.on("click",e=>{
setLocation(e.latlng.lat,e.latlng.lng);
});
}

/* ================= RENDER SERVICE ================= */
services.forEach((s,i)=>{
const div=document.createElement("div");
div.className="product-card";

div.innerHTML=`
<img src="${s.img}">
<h4>${s.name}</h4>
<p>${rupiah(s.price)}</p>
<button data-id="${i}">Pilih</button>
`;

container.appendChild(div);
});

container.addEventListener("click",e=>{
if(e.target.tagName!=="BUTTON") return;

selectedService=services[e.target.dataset.id];
updateTotal();
alert("Service dipilih: "+selectedService.name);
});

/* ================= METODE ================= */
metode.addEventListener("change",()=>{

mapSection.style.display="none";
transport.style.display="none";
proof.style.display="none";
transportCost=0;

if(metode.value==="home"){
mapSection.style.display="block";
transport.style.display="block";
proof.style.display="block";
initMap();
}

if(metode.value==="paket"){
mapSection.style.display="block";
transport.style.display="block";
transportCost=10000;
ongkir.value=rupiah(10000);
initMap();
}

updateTotal();
});

/* ================= GPS ================= */
document.getElementById("getLocation").onclick=()=>{
navigator.geolocation.getCurrentPosition(pos=>{
setLocation(pos.coords.latitude,pos.coords.longitude);
});
};

/* ================= SPAREPART ================= */
document.getElementById("add-spare").onclick=()=>{

const name=document.getElementById("spare-name").value;
const price=Number(document.getElementById("spare-price").value);

if(!name||!price) return alert("Isi nama & harga sparepart");

spareparts.push({name,price});
renderSpare();
updateTotal();
};

function renderSpare(){

const box=document.getElementById("spare-list");
box.innerHTML="";

spareparts.forEach((s,i)=>{
const div=document.createElement("div");
div.innerHTML=`${s.name} - ${rupiah(s.price)}
<button data-i="${i}">❌</button>`;
box.appendChild(div);
});

box.querySelectorAll("button").forEach(btn=>{
btn.onclick=()=>{
spareparts.splice(btn.dataset.i,1);
renderSpare();
updateTotal();
};
});
}

/* ================= SUBMIT ================= */
document.getElementById("checkout").onclick=()=>{

const nama=document.getElementById("customer-name").value.trim();
const alamat=document.getElementById("customer-address").value.trim();
const phone=document.getElementById("customer-phone").value.trim();
const brand=document.getElementById("customer-brand").value.trim();
const problem=document.getElementById("customer-problem").value.trim();
const method=metode.value;

if(!nama||!alamat||!phone||!brand||!problem||!method)
return alert("Lengkapi data");

const jasa=selectedService?.price||0;
const spare=spareparts.reduce((a,b)=>a+b.price,0);
const total=jasa+spare+transportCost;

let msg=`📱 SERVICE HP%0A`;
msg+=`Nama: ${nama}%0A`;
msg+=`Merk: ${brand}%0A`;
msg+=`Keluhan: ${problem}%0A`;
msg+=`Metode: ${method}%0A`;
msg+=`Jasa: ${rupiah(jasa)}%0A`;
msg+=`Sparepart: ${rupiah(spare)}%0A`;
msg+=`Transport: ${rupiah(transportCost)}%0A`;
msg+=`Total Estimasi: ${rupiah(total)}`;

window.open(`https://wa.me/6281234567890?text=${msg}`);
};

});
