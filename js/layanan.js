const db = window.supabaseClient;

let spareparts = {}; 
let transportCost = 0;

let metode,
    mapSection,
    transportSection,
    proof,
    alamatToko,
    sparepartPriceEl,
    transportPriceEl,
    totalPriceEl,
    transportRow,
    ongkir,
    coordInput,
    distanceInfo;

/* ================= MAP GLOBAL ================= */
let mapInstance = null;
let marker = null;
let paymentSection,
    paymentMethod,
    paymentInfo;

/* ================= KOORDINAT TOKO ================= */
/* GANTI dengan lokasi toko kamu */
const TOKO_LAT = -6.16639026634003;   // contoh: Jakarta
const TOKO_LNG = 106.80295190492956;

document.addEventListener("DOMContentLoaded",()=>{

    if(!db){
        alert("Supabase belum terhubung");
        return;
    }

    /* ================= AMBIL ELEMENT ================= */
    metode = document.getElementById("service-option");
    mapSection = document.getElementById("map-section");
    transportSection = document.getElementById("transport-section");
    proof = document.getElementById("payment-proof-section");
    alamatToko = document.getElementById("alamat-toko");

    sparepartPriceEl = document.getElementById("sparepart-price");
    transportPriceEl = document.getElementById("transport-price");
    totalPriceEl = document.getElementById("total-price");
    transportRow = document.getElementById("transport-row");

    ongkir = document.getElementById("transport-fee");
    coordInput = document.getElementById("customer-coord");
    distanceInfo = document.getElementById("distance-info");
    paymentSection = document.getElementById("payment-section");
    paymentMethod = document.getElementById("payment-method");
    paymentInfo = document.getElementById("payment-info");


    /* ================= EVENT METODE ================= */
    if(metode){
        metode.addEventListener("change",()=>{

           mapSection.style.display="none";
            transportSection.style.display="none";
            proof.style.display="none";
            alamatToko.style.display="none";
            transportRow.style.display="none";
            transportCost=0;
            
            if(paymentSection){
                paymentSection.style.display="none";
            }

               if(metode.value==="home"){
                    mapSection.style.display="block";
                    transportSection.style.display="block";
                    proof.style.display="block";
                    transportRow.style.display="flex";
                
                    if(paymentSection){
                        paymentSection.style.display="block";
                    }
                
                    initMap();
                }


            if(metode.value==="paket"){
                alamatToko.style.display="block";
            }

            updateTotal();
        });
    }
    
/* ================= METODE PEMBAYARAN ================= */
if(paymentMethod){
    paymentMethod.addEventListener("change", ()=>{

        paymentInfo.innerHTML = "";

        if(paymentMethod.value === "Transfer"){
            paymentInfo.innerHTML = `
                <p><b>Transfer ke:</b></p>
                <p>BCA - 1234567890</p>
                <p>a.n CEO Service HP</p>
            `;
        }

        if(paymentMethod.value === "QRIS"){
            paymentInfo.innerHTML = `
                <p><b>Scan QRIS berikut:</b></p>
                <img src="images/qris.jpg" width="200" style="margin-top:5px;border-radius:8px;">
            `;
        }

        if(paymentMethod.value === "Tunai/Cash"){
            paymentInfo.innerHTML = `
                <p>Pembayaran dilakukan langsung saat service selesai.</p>
            `;
        }
    });
}
    
    loadProducts();
});

/* ================= HELPER ================= */
function rupiah(n){
return "Rp "+Number(n).toLocaleString("id-ID");
}

/* ================= TOTAL ================= */
function updateTotal(){

const spare=Object.values(spareparts)
.reduce((a,b)=>a+(b.price*b.qty),0);

const total=spare+transportCost;

if(sparepartPriceEl) sparepartPriceEl.textContent=rupiah(spare);
if(transportPriceEl) transportPriceEl.textContent=rupiah(transportCost);
if(totalPriceEl) totalPriceEl.textContent=rupiah(total);
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

if(marker){
marker.setLatLng([lat,lng]);
mapInstance.panTo([lat,lng],{animate:true,duration:0.5});

setTimeout(()=>{
if(marker._icon){
marker._icon.classList.remove("bounce");
void marker._icon.offsetWidth;
marker._icon.classList.add("bounce");
}
},10);
}

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

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
maxZoom:19
}).addTo(mapInstance);

/* ICON MARKER HIJAU */
const customIcon=L.divIcon({
className:"custom-marker",
html:`<i class="fa-solid fa-location-dot"></i>`,
iconSize:[30,30],
iconAnchor:[15,30]
});

marker=L.marker([TOKO_LAT,TOKO_LNG],{icon:customIcon}).addTo(mapInstance);

/* KLIK MAP */
mapInstance.on("click",e=>{

const lat=e.latlng.lat;
const lng=e.latlng.lng;

setLocation(lat,lng);

/* ANIMASI PINDAH */
marker.setLatLng([lat,lng]);

setTimeout(()=>{
if(marker._icon){
marker._icon.classList.remove("bounce");
void marker._icon.offsetWidth;
marker._icon.classList.add("bounce");
}
},10);

});
}

/* ================= LOAD PRODUK DARI DATABASE ================= */
async function loadProducts(){

    const { data, error } = await db
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if(error){
        console.error("Gagal load produk:", error);
        return;
    }

    const container = document.getElementById("products-container");
    container.innerHTML = "";

    if(!data || data.length === 0){
        container.innerHTML = "<p>Belum ada produk tersedia</p>";
        return;
    }

    data.forEach((p)=>{

        const hargaTampil = p.promo_price && p.promo_price > 0
            ? p.promo_price
            : p.price;

        const div = document.createElement("div");
        div.className = "product-card";

        div.innerHTML = `
            <img src="${p.image_url || 'images/no-image.png'}">
            <h4>${p.name}</h4>
            <p>${rupiah(hargaTampil)}</p>
            <button data-id="${p.id}"
                    data-name="${p.name}"
                    data-price="${hargaTampil}">
                Tambah
            </button>
        `;

        container.appendChild(div);
    });

    attachProductEvents();
}

function attachProductEvents(){

    document.querySelectorAll(".product-card button")
        .forEach(btn=>{

            btn.onclick = ()=>{

                const name = btn.dataset.name;
                const price = parseInt(btn.dataset.price);

                if(spareparts[name]){
                    spareparts[name].qty++;
                }else{
                    spareparts[name] = {
                        price: price,
                        qty: 1
                    };
                }

                btn.textContent="✔ Ditambahkan";
                setTimeout(()=>btn.textContent="Tambah",800);

                renderCart();
                updateTotal();
            };

        });
}

/* ================= RENDER CART ================= */
function renderCart(){

const box=document.getElementById("cart-items");
const wrap=document.getElementById("cart-box");

if(!box || !wrap) return;

box.innerHTML="";

const keys=Object.keys(spareparts);

if(keys.length===0){
wrap.style.display="none";
return;
}

wrap.style.display="block";

keys.forEach(name=>{

const item=spareparts[name];

const div=document.createElement("div");
div.className="cart-row";

div.innerHTML=`
<span>${name}</span>

<div class="cart-controls">
<button class="minus" data-name="${name}">−</button>
<span>${item.qty}</span>
<button class="plus" data-name="${name}">+</button>
<button class="remove" data-name="${name}">✕</button>
</div>

<span>${rupiah(item.price*item.qty)}</span>
`;

box.appendChild(div);
});

attachCartEvents();
}


function attachCartEvents(){

document.querySelectorAll(".plus").forEach(btn=>{
btn.onclick=()=>{
spareparts[btn.dataset.name].qty++;
renderCart();
updateTotal();
};
});

document.querySelectorAll(".minus").forEach(btn=>{
btn.onclick=()=>{
const item=spareparts[btn.dataset.name];
item.qty--;

if(item.qty<=0)
delete spareparts[btn.dataset.name];

renderCart();
updateTotal();
};
});

document.querySelectorAll(".remove").forEach(btn=>{
btn.onclick=()=>{
delete spareparts[btn.dataset.name];
renderCart();
updateTotal();
};
});
}

/* ================= GPS ================= */
document.getElementById("getLocation").onclick=()=>{
navigator.geolocation.getCurrentPosition(pos=>{
setLocation(pos.coords.latitude,pos.coords.longitude);
});
};

/* ================= SUBMIT ================= */
document.getElementById("checkout").onclick = async () => {

    if(window.sending) return;
    window.sending = true;

    const btn=document.getElementById("checkout");
    btn.disabled=true;
    btn.textContent="Mengirim...";

    const nama=document.getElementById("customer-name").value.trim();
    const alamat=document.getElementById("customer-address").value.trim();
    const phone=document.getElementById("customer-phone").value.trim();
    const brand=document.getElementById("customer-brand").value.trim();
    const problem=document.getElementById("customer-problem").value.trim();
    const method=metode.value;
    const file=document.getElementById("payment-proof")?.files[0];

    if(!nama||!alamat||!phone||!brand||!problem||!method){
        window.sending=false;
        btn.disabled=false;
        btn.textContent="Kirim Permintaan Service";
        return alert("Lengkapi data");
    }

    if(method==="home" && !coordInput.value){
        window.sending=false;
        btn.disabled=false;
        btn.textContent="Kirim Permintaan Service";
        return alert("Lokasi wajib diisi untuk Home Service");
    }

    let spareList="Tidak ada";
    const keys=Object.keys(spareparts);
    if(keys.length){
        spareList=keys.map(n=>{
            const s=spareparts[n];
            return `${n} x${s.qty} (${rupiah(s.price*s.qty)})`;
        }).join(", ");
    }

    /* ================= UPLOAD BUKTI ================= */
    let buktiUrl=null;

    if(file){
        const fileName=Date.now()+"_"+file.name;

        const { error:uploadError } = await db.storage
            .from("bukti-transfer")
            .upload(fileName,file);

        if(uploadError){
            alert("Gagal upload bukti transfer");
            console.error(uploadError);
            window.sending=false;
            btn.disabled=false;
            btn.textContent="Kirim Permintaan Service";
            return;
        }

        const { data:publicUrl } = db.storage
            .from("bukti-transfer")
            .getPublicUrl(fileName);

        buktiUrl=publicUrl.publicUrl;
    }

/* ================= SIMPAN KE SUPABASE ================= */

const spareTotal = Object.values(spareparts)
    .reduce((a,b)=>a+(b.price*b.qty),0);

const total = spareTotal + transportCost;

try {

    const { error } = await db
        .from("service_orders")
        .insert({
            nama,
            alamat,
            phone,
            brand,
            problem,
            metode: method,
            sparepart: spareList,
            total_sparepart: spareTotal,
            transport: transportCost,
            jasa: 0,
            total: total,
            coord: coordInput.value || null,
            status: "pending",
            bukti: buktiUrl
        });

    if(error) throw error;

} catch (err) {

    console.error("Gagal kirim data:", err);
    alert("Gagal kirim data ke server");

    window.sending=false;
    btn.disabled=false;
    btn.textContent="Kirim Permintaan Service";
    return;
}
  
    /* ================= MESSAGE WA ================= */
    let msg=`📱 *SERVICE HP*%0A`;
    msg+=`Nama: ${nama}%0A`;
    msg+=`No HP: ${phone}%0A`;
    msg+=`Merk: ${brand}%0A`;
    msg+=`Keluhan: ${problem}%0A`;
    msg+=`Metode: ${method}%0A`;
    msg+=`Sparepart: ${spareList}%0A`;

    if(method==="home") msg+=`Transport: ${rupiah(transportCost)}%0A`;
    if(method==="paket") msg+=`Pengiriman ke alamat toko%0A`;
    msg+=`Total Estimasi: ${rupiah(total)}%0A`;
    msg+=`%0A(Jasa diinformasikan setelah pengecekan teknisi)`;

    window.open(`https://wa.me/6288803060094?text=${msg}`);

    window.sending=false;
    btn.disabled=false;
    btn.textContent="Kirim Permintaan Service";
};

