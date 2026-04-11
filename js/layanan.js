const client = window.supabaseClient;

let spareparts = {};
let allProducts = []; // simpan semua produk
let currentKeyword = "";
let currentCategory = "";
let transportCost = 0;

let metode,
    mapSection,
    transportSection,
    proof,
    alamatToko,
    resiSection,
    resiInput,
    ekspedisiInput,
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
const TOKO_LAT = -6.166946854281742;   // contoh: Jakarta
const TOKO_LNG = 106.80309915767154;

document.addEventListener("DOMContentLoaded",()=>{

    if(!supabase){
        alert("Supabase belum terhubung");
        return;
    }
/* ===== SEARCH SPAREPART ===== */
document.getElementById("searchSparepart")
?.addEventListener("input", e => {
    currentKeyword = e.target.value;
    renderProducts();
});

/* ===== FILTER KATEGORI ===== */
document.getElementById("filterCategory")
?.addEventListener("change", e => {
    currentCategory = e.target.value;
    renderProducts();
});

    /* ================= AMBIL ELEMENT ================= */
    metode = document.getElementById("service-option");
    mapSection = document.getElementById("map-section");
    transportSection = document.getElementById("transport-section");
    proof = document.getElementById("payment-proof-section");
    alamatToko = document.getElementById("alamat-toko");
    resiSection = document.getElementById("resi-section");
    resiInput = document.getElementById("customer-resi");
    ekspedisiInput = document.getElementById("customer-ekspedisi");

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
            if(resiSection){
                resiSection.style.display="none";
            }

               if(metode.value==="Home Service/Antar & jemput"){
                    mapSection.style.display="block";
                    transportSection.style.display="block";
                    proof.style.display="block";
                    transportRow.style.display="flex";
                
                    if(paymentSection){
                        paymentSection.style.display="block";
                    }
                
                    initMap();
                }


            if(metode.value==="Kirim Paket"){
                alamatToko.style.display="block";
                if(resiSection){
                    resiSection.style.display="block";
                }
            }
            updateTotal();
        });
    }
    
/* ================= METODE PEMBAYARAN ================= */
if(paymentMethod){
    paymentMethod.addEventListener("change", ()=>{

        paymentInfo.innerHTML = "";

        /* ================= TRANSFER ================= */
        if(paymentMethod.value === "Transfer"){
            const rekening = "1234567890";

            paymentInfo.innerHTML = `
                <div style="background:#f5f5f5;padding:12px;border-radius:8px;">
                    <p><b>Transfer ke:</b></p>
                    <p>BCA</p>
                    <p id="rekening-number" style="font-size:16px;font-weight:bold;">
                        ${rekening}
                    </p>
                    <button id="copy-rekening" 
                        style="margin-top:8px;padding:6px 10px;border:none;background:#1f6f78;color:#fff;border-radius:6px;cursor:pointer;">
                        📋 Copy Nomor Rekening
                    </button>
                </div>
            `;

            document.getElementById("copy-rekening").onclick = ()=>{
                navigator.clipboard.writeText(rekening);
                alert("Nomor rekening berhasil disalin!");
            };
        }

        /* ================= QRIS ================= */
        if(paymentMethod.value === "QRIS"){
            paymentInfo.innerHTML = `
                <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
                    <p><b>Scan atau Download QRIS</b></p>
                    <img src="images/qris.jpg" 
                         width="220" 
                         style="margin-top:8px;border-radius:10px;">
                    
                    <br>

                    <a href="images/qris.jpg" 
                       download="QRIS_CEO_Service_HP.jpg"
                       style="display:inline-block;margin-top:10px;
                              padding:6px 12px;
                              background:#1f6f78;
                              color:#fff;
                              border-radius:6px;
                              text-decoration:none;">
                        ⬇ Download QRIS
                    </a>
                </div>
            `;
        }
    });
}

/* ================= ALAMAT ================= */
  const copyAlamatBtn = document.getElementById("copy-alamat");
    const alamatText = document.getElementById("alamat-text");
    
    if(copyAlamatBtn && alamatText){
        copyAlamatBtn.addEventListener("click", ()=>{
            navigator.clipboard.writeText(alamatText.textContent.trim())
            .then(()=>{
                copyAlamatBtn.textContent = "✅ Berhasil Disalin";
                setTimeout(()=>{
                    copyAlamatBtn.textContent = "📋 Copy Alamat";
                },1500);
            })
            .catch(()=>{
                alert("Gagal menyalin alamat");
            });
        });
    }
    
    loadProducts();
    loadCategoriesFilter();

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
function smoothMoveMarker(lat, lng){

    if(!mapInstance || !marker) return;

    const start = marker.getLatLng();
    const end = L.latLng(lat, lng);

    const duration = 600;
    const startTime = performance.now();

    function animate(time){
        const progressRaw = Math.min((time - startTime) / duration, 1);
        const progress = 1 - Math.pow(1 - progressRaw, 3); // easing

        const currentLat = start.lat + (end.lat - start.lat) * progress;
        const currentLng = start.lng + (end.lng - start.lng) * progress;

        marker.setLatLng([currentLat, currentLng]);

        if(progressRaw < 1){
            requestAnimationFrame(animate);
        } else {

            // 🔥 Hitung ongkir setelah sampai
            coordInput.value = lat + "," + lng;

            const jarak = hitungJarak(lat, lng);
            const res = hitungOngkir(jarak);

            transportCost = res.biaya;
            ongkir.value = rupiah(res.biaya);
            distanceInfo.textContent = "Jarak " + res.km + " KM";

            updateTotal();

            // Bounce
            if(marker._icon){
                marker._icon.classList.add("bounce");
                setTimeout(()=>{
                    marker._icon.classList.remove("bounce");
                },600);
            }
        }
    }

    requestAnimationFrame(animate);

    mapInstance.flyTo([lat, lng], 15, {
        duration: 0.8
    });
}
/* ================= MAP ================= */
function initMap(){
    if(mapInstance) return;

    mapInstance = L.map("map").setView([TOKO_LAT, TOKO_LNG], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(mapInstance);

    const customIcon = L.divIcon({
        className: "custom-marker",
        html: `<i class="fa-solid fa-location-dot"></i>`,
        iconSize: [30,30],
        iconAnchor: [15,30]
    });

    marker = L.marker([TOKO_LAT, TOKO_LNG], { icon: customIcon }).addTo(mapInstance);

    mapInstance.on("click", e => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        smoothMoveMarker(lat, lng);
    });
}

/* ================= LOAD PRODUK DARI DATABASE ================= */
async function loadProducts(){

    const { data, error } = await client
        .from("products")
        .select(`
            *,
            categories(name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if(error){
        console.error("Gagal load produk:", error);
        return;
    }

    allProducts = data || [];
    renderProducts();
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

/* ================= LOAD KATEGORI FILTER ================= */
async function loadCategoriesFilter(){

    const { data, error } = await client
        .from("categories")
        .select("name")
        .eq("is_active", true)
        .order("name");

    if(error){
        console.error("Gagal load kategori:", error);
        return;
    }

    const select = document.getElementById("filterCategory");

    if(!select) return;

    select.innerHTML = `
        <option value="all">Semua Kategori</option>
    `;

    data.forEach(cat=>{
        select.innerHTML += `
            <option value="${cat.name}">
                ${cat.name}
            </option>
        `;
    });

    currentCategory = "all";
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

/* ================= Render Products================= */
function renderProducts(){

    const container = document.getElementById("products-container");
    container.innerHTML = "";

    let filtered = allProducts.filter(p => {

        const matchName = p.name
            .toLowerCase()
            .includes(currentKeyword.toLowerCase());

        const matchCategory =
            currentCategory === "all" ||
            currentCategory === "" ||
            p.categories?.name === currentCategory;

        return matchName && matchCategory;
    });

    if(filtered.length === 0){
        container.innerHTML = "<p>Tidak ada produk ditemukan</p>";
        return;
    }

    filtered.forEach((p)=>{

        const hargaTampil = p.promo_price && p.promo_price > 0
            ? p.promo_price
            : p.price;

        const div = document.createElement("div");
        div.className = "product-card";

        div.innerHTML = `
            <img src="${p.image_url || ''}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="no-img">
                <i class="fa-solid fa-image"></i>
            </div>
            <h4>${p.name}</h4>
            <p>${rupiah(hargaTampil)}</p>
            <button data-name="${p.name}"
                    data-price="${hargaTampil}">
                Tambah
            </button>
        `;

        container.appendChild(div);
    });

    attachProductEvents();
}

/* ================= GPS ================= */
document.getElementById("getLocation").onclick=()=>{
navigator.geolocation.getCurrentPosition(pos=>{
const lat = pos.coords.latitude;
const lng = pos.coords.longitude;

smoothMoveMarker(lat, lng);
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

    if(method==="Home Service" && !coordInput.value){
        window.sending=false;
        btn.disabled=false;
        btn.textContent="Kirim Permintaan Service";
        return alert("Lokasi wajib diisi untuk Home Service");
    }

    if(method==="Kirim Paket"){
        if(!ekspedisiInput.value){
            window.sending=false;
            btn.disabled=false;
            btn.textContent="Kirim Permintaan Service";
            return alert("Pilih ekspedisi terlebih dahulu");
        }
    
        if(!resiInput.value.trim()){
            window.sending=false;
            btn.disabled=false;
            btn.textContent="Kirim Permintaan Service";
            return alert("Nomor resi wajib diisi");
        }
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

        const { error:uploadError } = await client.storage
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

        const { data:publicUrl } = client.storage
            .from("bukti-transfer")
            .getPublicUrl(fileName);

        buktiUrl=publicUrl.publicUrl;
    }

/* ================= SIMPAN KE SUPABASE ================= */

const spareTotal = Object.values(spareparts)
    .reduce((a,b)=>a+(b.price*b.qty),0);

const total = spareTotal + transportCost;

try {

    const { error } = await client
        .from("service_orders")
        .insert({
        nama,
        alamat,
        phone,
        brand,
        problem,
        metode: method,
        ekspedisi: method==="Kirim Paket" ? ekspedisiInput.value : null,
        resi: method==="Kirim Paket" ? resiInput.value.trim() : null,
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

    let lokasiMap = "-";
    
    if (method === "Home Service" && coordInput.value) {
        const [lat, lng] = coordInput.value.split(",");
        lokasiMap = `https://www.google.com/maps?q=${lat},${lng}`;
    }
    
    let msg = `📱 *SERVICE HP*\n`;
    msg += `=====================\n`;
    msg += `Nama: ${nama}\n`;
    msg += `No HP: ${phone}\n`;
    msg += `Merk Hp: ${brand}\n`;
    msg += `Keluhan: ${problem}\n`;
    msg += `Metode Service: ${method}\n`;
    
    if (method === "Home Service") {
        msg += `📍 Lokasi: ${lokasiMap}\n`;
        msg += `Transport: ${rupiah(transportCost)}\n`;
    }
    
    if (method === "Kirim Paket" && ekspedisiInput && resiInput) {
    msg += `Ekspedisi: ${ekspedisiInput.value}\n`;
    msg += `Nomor Resi: ${resiInput.value.trim()}\n`;
    msg += `Pengiriman ke alamat toko\n`;
    }
    
    msg += `Sparepart: ${spareList}\n`;
    msg += `---------------------\n`;
    msg += `Total Estimasi: ${rupiah(total)}\n`;
    msg += `\n(Jasa diinformasikan setelah pengecekan teknisi)`;
    
    window.open(
        `https://wa.me/628138892098?text=${encodeURIComponent(msg)}`,
        "_blank"
    );
    
    window.sending=false;
    btn.disabled=false;
    btn.textContent="Kirim Permintaan Service";
};

