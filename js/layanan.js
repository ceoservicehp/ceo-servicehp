document.addEventListener("DOMContentLoaded",()=>{

/* ================= DATA SPAREPART ================= */
const products=[
{name:"LCD Samsung",price:150000,img:"images/lcd.jpg"},
{name:"Baterai Original",price:90000,img:"images/baterai.jpg"},
{name:"Port Charger",price:50000,img:"images/port.jpg"},
{name:"Kamera",price:120000,img:"images/kamera.jpg"}
];

let spareparts=[];
let transportCost=0;

const TOKO_LAT=-6.200000;
const TOKO_LNG=106.816666;

/* ================= ELEMENT ================= */
const container=document.getElementById("products-container");
const metode=document.getElementById("service-option");
const mapSection=document.getElementById("map-section");
const transportSection=document.getElementById("transport-section");
const proof=document.getElementById("payment-proof-section");
const alamatToko=document.getElementById("alamat-toko");

const sparepartPriceEl=document.getElementById("sparepart-price");
const transportPriceEl=document.getElementById("transport-price");
const totalPriceEl=document.getElementById("total-price");
const transportRow=document.getElementById("transport-row");

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

const spare=spareparts.reduce((a,b)=>a+b.price,0);
const total=spare+transportCost;

sparepartPriceEl.textContent=rupiah(spare);
transportPriceEl.textContent=rupiah(transportCost);
totalPriceEl.textContent=rupiah(total);
}

/* ================= HITUNG JARAK ================= */
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

if(metode.value!=="home") return;

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

const customIcon=L.divIcon({
className:"custom-marker",
html:`<i class="fa-solid fa-location-dot"></i>`,
iconSize:[30,30],
iconAnchor:[15,30]
});

marker=L.marker([TOKO_LAT,TOKO_LNG],{icon:customIcon}).addTo(mapInstance);

mapInstance.on("click",e=>{

setLocation(e.latlng.lat,e.latlng.lng);

/* animasi bounce */
marker.getElement().classList.remove("bounce");
void marker.getElement().offsetWidth;
marker.getElement().classList.add("bounce");

});

}

/* ================= RENDER PRODUK ================= */
products.forEach((p,i)=>{
const div=document.createElement("div");
div.className="product-card";

div.innerHTML=`
<img src="${p.img}">
<h4>${p.name}</h4>
<p>${rupiah(p.price)}</p>
<button data-id="${i}">Tambah</button>
`;

container.appendChild(div);
});

container.addEventListener("click",e=>{
if(e.target.tagName!=="BUTTON") return;

const item=products[e.target.dataset.id];
spareparts.push(item);

updateTotal();
alert("Ditambahkan: "+item.name);
});

/* ================= METODE SERVICE ================= */
metode.addEventListener("change",()=>{

mapSection.style.display="none";
transportSection.style.display="none";
proof.style.display="none";
alamatToko.style.display="none";
transportRow.style.display="none";
transportCost=0;

/* DATANG KE TOKO */
if(metode.value==="toko"){
}

/* HOME SERVICE */
if(metode.value==="home"){
mapSection.style.display="block";
transportSection.style.display="block";
proof.style.display="block";
transportRow.style.display="flex";
initMap();
}

/* KIRIM PAKET */
if(metode.value==="paket"){
alamatToko.style.display="block";
}

updateTotal();
});

/* ================= GPS ================= */
document.getElementById("getLocation").onclick=()=>{
navigator.geolocation.getCurrentPosition(pos=>{
setLocation(pos.coords.latitude,pos.coords.longitude);
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

if(!nama||!alamat||!phone||!brand||!problem||!method)
return alert("Lengkapi data");

if(method==="home" && !coordInput.value)
return alert("Lokasi wajib diisi untuk Home Service");

const spare=spareparts.reduce((a,b)=>a+b.price,0);
const total=spare+transportCost;

/* LIST SPARE */
let spareList="Tidak ada";
if(spareparts.length){
spareList=spareparts.map(s=>`${s.name} (${rupiah(s.price)})`).join(", ");
}

/* MESSAGE */
let msg=`📱 *SERVICE HP*%0A`;
msg+=`Nama: ${nama}%0A`;
msg+=`No HP: ${phone}%0A`;
msg+=`Merk: ${brand}%0A`;
msg+=`Keluhan: ${problem}%0A`;
msg+=`Metode: ${method}%0A`;
msg+=`Sparepart: ${spareList}%0A`;

if(method==="home")
msg+=`Transport: ${rupiah(transportCost)}%0A`;

if(method==="paket")
msg+=`Pengiriman ke alamat toko%0A`;

msg+=`Total Estimasi: ${rupiah(total)}%0A`;
msg+=`%0A(Jasa diinformasikan setelah pengecekan teknisi)`;

/* WA */
window.open(`https://wa.me/6281234567890?text=${msg}`);

};

});
