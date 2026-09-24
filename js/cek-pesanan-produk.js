"use strict";

const c = window.supabaseClient;
const $ = id => document.getElementById(id);
const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g, x => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[x]));

const L = {
  menunggu_diproses:"Menunggu", menunggu:"Menunggu", diproses:"Diproses",
  dikemas:"Dikemas", dikirim:"Dikirim", dalam_perjalanan:"Dalam Perjalanan",
  selesai:"Selesai", dibatalkan:"Batal", batal:"Batal",
  belum_bayar:"Belum Bayar", sebagian:"Sebagian", lunas:"Lunas",
  pickup:"Ambil di Toko", instant:"Kurir Instan", package:"Kirim Paket",
  cod:"COD Lokal", delivery:"Pengiriman",
  cash:"Cash / Tunai", tunai:"Cash / Tunai", transfer:"Transfer"
};
const lab = v => L[v] || String(v || "-").replaceAll("_"," ");
const dateID = v => {
  if(!v) return "-";
  const d=new Date(String(v).length<=10?`${v}T00:00:00`:v);
  return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
};
const normStatus=v=>v==="menunggu"?"menunggu_diproses":v==="batal"?"dibatalkan":v;
const paymentClass=v=>{
  const x=String(v||"").toLowerCase();
  if(x==="lunas") return "paid";
  if(x==="sebagian") return "partial";
  return "unpaid";
};


document.addEventListener("DOMContentLoaded",()=>{
  const q=new URLSearchParams(location.search).get("order");
  if(q) $("orderNumber").value=q;
  $("checkBtn").onclick=check;
  ["orderNumber","phone"].forEach(id=>$(id)?.addEventListener("keydown",e=>{if(e.key==="Enter")check()}));
});

async function check(){
  const no=$("orderNumber").value.trim(), ph=$("phone").value.trim();
  if(!no||!ph) return msg("Nomor pesanan dan WhatsApp wajib diisi.");
  if(!c) return msg("Koneksi sistem belum tersedia. Silakan muat ulang halaman.");
  const b=$("checkBtn"), old=b.innerHTML;
  b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...';
  try{
    const {data,error}=await c.rpc("public_track_product_order",{p_order_number:no,p_customer_whatsapp:ph});
    if(error) throw error;
    if(!data?.success) throw Error(data?.message||"Pesanan tidak ditemukan.");
    render(data);
  }catch(e){console.error(e);msg(e.message||"Gagal mengambil data pesanan.")}
  finally{b.disabled=false;b.innerHTML=old}
}
function msg(t){$("alert").hidden=false;$("alert").textContent=t;$("result").hidden=true}

function courierTracking(courier, resi, directUrl){
  if(directUrl && /^https?:\/\//i.test(directUrl)) return directUrl;
  const q=encodeURIComponent(resi||"");
  const n=String(courier||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(!resi) return "";
  // Official public tracking destinations where a stable official route is known.
  if(n.includes("jne")) return "https://www.jne.co.id/tracking-package";
  if(n.includes("jnt")||n.includes("jet")) return "https://jet.co.id/track";
  if(n.includes("sicepat")) return "https://www.sicepat.com/checkAwb";
  if(n.includes("anteraja")) return "https://anteraja.id/tracking";
  // Other couriers/instant delivery: don't invent a tracking URL.
  return "";
}

function render(d){
  $("alert").hidden=true;
  const o=d.order||{}, s=d.shipping||{}, it=Array.isArray(d.items)?d.items:[];
  const status=normStatus(o.order_status);
  const steps=["menunggu_diproses","diproses","dikemas","dikirim","dalam_perjalanan","selesai"];
  const cur=steps.indexOf(status), cancelled=status==="dibatalkan";
  const shippingType=o.shipping_type||o.shipping_method||"-";
  const courier=s.courier||o.shipping_provider||"-";
  const resi=s.tracking_number||"-";
  const directTracking=s.tracking_url||s.tracking_link||o.tracking_url||o.tracking_link||"";
  const trackUrl=courierTracking(courier,resi==="-"?"":resi,directTracking);
  const canTrack=shippingType!=="pickup" && trackUrl;

  const products=it.length?it.map(x=>{
    const variant=[x.variant_name,x.ram,x.storage,x.color].filter(Boolean).join(" · ");
    return `<div class="simple-product">
      <div><i class="fa-solid fa-mobile-screen-button"></i><span><b>${esc(x.product_name||"Produk")}</b>${variant?`<small>${esc(variant)}</small>`:""}</span></div>
      <b>${Number(x.quantity||1)}x</b>
    </div>`;
  }).join(""):'<span class="muted">Detail produk tidak tersedia.</span>';

  let deliveryNote="";
  if(shippingType==="pickup") deliveryNote="Pesanan akan diambil langsung di toko. Tracking kurir tidak diperlukan.";
  else if(shippingType==="cod") deliveryNote="Pesanan diantar ke alamat tujuan. Pantau status “Dalam Perjalanan” pada halaman ini.";
  else if(trackUrl) deliveryNote="Nomor resi sudah tersedia. Gunakan tombol Lacak Pengiriman untuk membuka halaman tracking kurir.";
  else if(resi!=="-") deliveryNote="Nomor resi sudah tersedia. Kurir ini belum memiliki link tracking publik otomatis di sistem.";
  else deliveryNote="Informasi resi/tracking akan muncul setelah pesanan diserahkan kepada kurir.";

  $("result").innerHTML=`
    <div class="head">
      <div><small>NO. PESANAN</small><h2>${esc(o.order_number)}</h2><span class="order-date"><i class="fa-regular fa-calendar"></i> ${dateID(o.created_at)}</span></div>
      <b class="${cancelled?"cancelled":""}"><i class="fa-solid ${cancelled?"fa-circle-xmark":"fa-box"}"></i> ${esc(lab(status))}</b>
    </div>

    ${cancelled?`<div class="cancel-box"><i class="fa-solid fa-circle-xmark"></i><div><b>Pesanan dibatalkan</b><span>Proses pesanan ini telah dihentikan.</span></div></div>`:
    `<div class="tracking-title"><i class="fa-solid fa-route"></i><div><b>Perjalanan Pesanan</b><span>Pantau perkembangan pesanan Anda di bawah ini.</span></div></div>
     <div class="timeline">${steps.map((x,i)=>`<div class="${i<=cur?"on":""} ${i===cur?"current":""}"><span>${i<cur?'<i class="fa-solid fa-check"></i>':i+1}</span><small>${lab(x)}</small></div>`).join("")}</div>`}

    <div class="status-message">
      <i class="fa-solid ${status==="selesai"?"fa-circle-check":status==="dalam_perjalanan"?"fa-truck-fast":status==="dikirim"?"fa-truck":status==="dikemas"?"fa-box":status==="diproses"?"fa-gears":"fa-clock"}"></i>
      <div><small>STATUS SAAT INI</small><b>${esc(lab(status))}</b></div>
    </div>

    <div class="tracking-grid">
      <article>
        <div class="section-title"><i class="fa-solid fa-user"></i><h3>Data Pemesan</h3></div>
        <p><span>Nama</span><b>${esc(o.customer_name||"-")}</b></p>
        <p><span>WhatsApp</span><b>${esc(o.customer_whatsapp||"-")}</b></p>
        ${o.customer_email?`<p><span>Email</span><b>${esc(o.customer_email)}</b></p>`:""}
        <p class="address-row"><span>Alamat</span><b>${esc(o.customer_address||"-")}</b></p>
      </article>

      <article>
        <div class="section-title"><i class="fa-solid fa-wallet"></i><h3>Pembayaran</h3></div>
        <p><span>Total Tagihan</span><b>${rp(o.total)}</b></p>
        <p><span>Sudah Dibayar</span><b class="paid-amount">${rp(o.amount_paid)}</b></p>
        <p><span>Sisa Tagihan</span><b class="${Number(o.remaining_amount||0)>0?"remaining-amount":"paid-amount"}">${rp(o.remaining_amount)}</b></p>
        <p><span>Metode Pembayaran</span><b>${esc(lab(o.payment_method||"-"))}</b></p>
        <p><span>Status Pembayaran</span><b><span class="payment-badge ${paymentClass(o.payment_status)}">${esc(lab(o.payment_status))}</span></b></p>
      </article>

      <article>
        <div class="section-title"><i class="fa-solid fa-bag-shopping"></i><h3>Produk Pesanan</h3></div>
        ${products}
      </article>
      <article>
        <div class="section-title"><i class="fa-solid fa-truck-fast"></i><h3>Informasi Pengiriman</h3></div>
        <p><span>Metode Pengiriman</span><b>${esc(lab(shippingType))}</b></p>
        ${shippingType!=="pickup"?`<p><span>Jasa Pengiriman</span><b>${esc(courier)}</b></p>`:""}
        ${shippingType!=="pickup"?`<div class="resi-row"><span>No. Resi / Kode</span><div class="resi-value"><b class="resi">${esc(resi)}</b>${resi!=="-"?`<button type="button" class="copy-resi" data-copy-resi="${esc(resi)}" title="Salin nomor resi"><i class="fa-regular fa-copy"></i><span>Salin</span></button>`:""}</div></div>`:""}
        <div class="delivery-note"><i class="fa-solid fa-circle-info"></i><span>${esc(deliveryNote)}</span></div>
        ${canTrack?`<a class="track-btn" href="${esc(trackUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-location-arrow"></i> Lacak Pengiriman <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`:""}
      </article>
    </div>

    <div class="simple-actions">
      <a href="nota-produk.html?id=${encodeURIComponent(o.id||"")}" target="_blank" rel="noopener"><i class="fa-solid fa-file-invoice"></i> Lihat Invoice</a>
      <button id="checkAgain"><i class="fa-solid fa-rotate"></i> Cek Pesanan Lain</button>
    </div>`;

  $("result").hidden=false;
  $("checkAgain")?.addEventListener("click",()=>{$("result").hidden=true;$("orderNumber").focus();window.scrollTo({top:0,behavior:"smooth"})});
  document.querySelectorAll("[data-copy-resi]").forEach(btn=>btn.addEventListener("click",async()=>{
    const value=btn.dataset.copyResi||"";
    try{
      await navigator.clipboard.writeText(value);
      const old=btn.innerHTML;
      btn.innerHTML='<i class="fa-solid fa-check"></i><span>Tersalin</span>';
      btn.classList.add("copied");
      setTimeout(()=>{btn.innerHTML=old;btn.classList.remove("copied")},1600);
    }catch{
      const ta=document.createElement("textarea"); ta.value=value; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      btn.innerHTML='<i class="fa-solid fa-check"></i><span>Tersalin</span>';
    }
  }));
  $("result").scrollIntoView({behavior:"smooth",block:"start"});
}
