document.addEventListener("DOMContentLoaded", () => {

let storeOpen = false;
const supabase = window.supabaseClient;


/* ================= FETCH STATUS TOKO ================= */
async function fetchStoreStatus(){
  const { data } = await supabase
    .from("store_status")
    .select("is_open")
    .eq("id",1)
    .maybeSingle();

  if(data){
    storeOpen = data.is_open;
    updateStoreStatus();
  }
}
fetchStoreStatus();


supabase.channel("status")
.on("postgres_changes",
{ event:"*", schema:"public", table:"store_status"},
payload=>{
  storeOpen = payload.new.is_open;
  updateStoreStatus();
})
.subscribe();


/* ================= STATUS UI ================= */
function updateStoreStatus(){
  const el = document.getElementById("store-status-msg");
  const list = document.getElementById("products-container");

  if(storeOpen){
    el.innerHTML="🟢 <b>Layanan Sedang Buka</b>";
    el.className="store-open";
    list.style.display="grid";
  }else{
    el.innerHTML="🔴 <b>Layanan Tutup</b>";
    el.className="store-closed";
    list.style.display="none";
  }
}



/* ================= DATA LAYANAN ================= */
const services=[
{
name:"Ganti LCD",
price:150000,
img:"images/lcd.jpg",
category:"hardware",
desc:"Penggantian LCD baru + pemasangan teknisi"
},
{
name:"Ganti Baterai",
price:90000,
img:"images/baterai.jpg",
category:"hardware",
desc:"Penggantian baterai original"
},
{
name:"Flash Software",
price:80000,
img:"images/software.jpg",
category:"software",
desc:"Perbaikan bootloop / hang logo"
},
{
name:"Bypass FRP",
price:70000,
img:"images/frp.jpg",
category:"software",
desc:"Unlock akun google terkunci"
}
];



/* ================= RENDER LAYANAN ================= */
function renderServices(list=services){
  const container=document.getElementById("products-container");
  container.innerHTML="";

  list.forEach((s,i)=>{
    const div=document.createElement("div");
    div.className="product-card";

    div.innerHTML=`
      <img src="${s.img}" class="product-image" onclick="showDetail(${i})">
      <h3>${s.name}</h3>
      <p>Rp ${s.price.toLocaleString()}</p>
      <button onclick="pilihService(${i})">Pilih</button>
    `;
    container.appendChild(div);
  });
}
renderServices();



/* ================= MODAL DETAIL ================= */
let selectedService=null;

window.showDetail=index=>{
  const s=services[index];
  selectedService=s;

  document.getElementById("modal-product-img").src=s.img;
  document.getElementById("modal-product-name").textContent=s.name;
  document.getElementById("modal-product-price").textContent=
    "Rp "+s.price.toLocaleString();
  document.getElementById("modal-product-desc").textContent=s.desc;

  document.getElementById("product-modal").classList.remove("hidden");
};


document.getElementById("close-product-modal")
.onclick=()=> document.getElementById("product-modal").classList.add("hidden");


window.pilihService=index=>{
  selectedService=services[index];
  alert("Layanan dipilih: "+selectedService.name);
  document.getElementById("product-modal").classList.add("hidden");
};



/* ================= SEARCH ================= */
document.getElementById("search-input")
.addEventListener("input",e=>{
  const k=e.target.value.toLowerCase();
  renderServices(
    services.filter(s=>s.name.toLowerCase().includes(k))
  );
});


/* ================= FILTER ================= */
const select=document.getElementById("filter-category");
[...new Set(services.map(s=>s.category))]
.forEach(cat=>{
  let opt=document.createElement("option");
  opt.value=cat;
  opt.textContent=cat;
  select.appendChild(opt);
});

select.addEventListener("change",e=>{
  const c=e.target.value;
  if(!c) renderServices();
  else renderServices(services.filter(s=>s.category===c));
});



/* ================= LOGIC PILIH LAYANAN ================= */

const serviceOption = document.getElementById("service-option");
const transportSection = document.getElementById("transport-section");
const mapSection = document.getElementById("map-section");
const proofSection = document.getElementById("payment-proof-section");
const transportInput = document.getElementById("transport-fee");

serviceOption.addEventListener("change",()=>{

const val = serviceOption.value;

transportSection.style.display="none";
mapSection.style.display="none";
proofSection.style.display="none";

if(val==="toko"){
transportInput.value="Rp 0";
}

else if(val==="home"){
transportSection.style.display="block";
mapSection.style.display="block";
proofSection.style.display="block";

let biaya=20000;
transportInput.value="Rp "+biaya.toLocaleString("id-ID");
}

else if(val==="paket"){
transportSection.style.display="block";
mapSection.style.display="block";

let biaya=15000;
transportInput.value="Rp "+biaya.toLocaleString("id-ID");
}

});


/* ================= AMBIL KOORDINAT ================= */

document.getElementById("getLocation").addEventListener("click",()=>{

if(!navigator.geolocation){
alert("Browser tidak support GPS");
return;
}

navigator.geolocation.getCurrentPosition(pos=>{
const lat = pos.coords.latitude;
const lng = pos.coords.longitude;
document.getElementById("customer-coord").value = lat+","+lng;
},
()=>alert("Gagal mengambil lokasi"));
});


/* ================= SUBMIT SERVICE ================= */

const btnSubmit=document.getElementById("checkout");

btnSubmit.addEventListener("click",async()=>{

if(btnSubmit.disabled) return;
btnSubmit.disabled=true;
btnSubmit.textContent="Mengirim...";

try{

if(!storeOpen){
alert("Maaf layanan sedang tutup");
return;
}

if(!selectedService){
alert("Pilih layanan terlebih dahulu");
return;
}

const nama=document.getElementById("customer-name").value.trim();
const alamat=document.getElementById("customer-address").value.trim();
const phone=document.getElementById("customer-phone").value.trim();
const brand=document.getElementById("customer-brand").value.trim();
const problem=document.getElementById("customer-problem").value.trim();
const metode=serviceOption.value;
const coord=document.getElementById("customer-coord").value;
const bukti=document.getElementById("payment-proof").files[0];

if(!nama||!alamat||!phone||!brand||!problem||!metode){
alert("Lengkapi semua data");
return;
}

if(metode==="home" && !bukti){
alert("Upload bukti transfer transport");
return;
}

if(!supabase){
alert("Database belum terhubung");
return;
}


/* INSERT DB */
const {error}=await supabase
.from("service_orders")
.insert([{
nama,
alamat,
no_hp:phone,
merk_hp:brand,
keluhan:problem,
layanan:selectedService.name,
metode,
koordinat:coord,
status:"pending"
}]);

if(error){
console.error(error);
alert("Gagal kirim data");
return;
}


/* WHATSAPP */
let msg=`📱 *SERVICE HP*\n`;
msg+=`Nama: ${nama}\n`;
msg+=`Alamat: ${alamat}\n`;
msg+=`No HP: ${phone}\n`;
msg+=`Merk: ${brand}\n`;
msg+=`Kerusakan: ${problem}\n`;
msg+=`Layanan: ${selectedService.name}\n`;
msg+=`Metode: ${metode}\n`;
msg+=`Lokasi: ${coord||"-"}\n`;
msg+=`Total: Rp ${selectedService.price.toLocaleString()}`;

window.open(`https://wa.me/6281234567890?text=${encodeURIComponent(msg)}`,"_blank");

alert("Permintaan service berhasil dikirim ✅");

}
finally{
btnSubmit.disabled=false;
btnSubmit.textContent="Kirim Permintaan Service";
}

});
