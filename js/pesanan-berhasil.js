"use strict";
const ADMIN_WHATSAPP = "62895379221306";
const KEY = "ceoProductOrderSuccess";
function rupiah(n){return "Rp "+Number(n||0).toLocaleString("id-ID")}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function labelShipping(v){return ({pickup:"Ambil di Toko",instant:"Kurir Instan",package:"Kirim Paket",cod:"COD Lokal"})[v]||v||"-"}
function labelPayment(v){return ({transfer:"Transfer Bank",cash:"Cash / Tunai",cod:"COD"})[v]||v||"-"}
document.addEventListener("DOMContentLoaded",()=>{
 let data=null;try{data=JSON.parse(sessionStorage.getItem(KEY)||"null")}catch(_){ }
 if(!data){document.querySelector(".success-card").innerHTML='<div class="empty"><i class="fa-solid fa-circle-exclamation"></i><h1>Data pesanan tidak ditemukan</h1><p>Silakan kembali ke katalog dan buat pesanan baru.</p><a href="produk-public.html">Kembali ke Produk</a></div>';return}
 document.getElementById("orderNumber").textContent=data.order_number||"-";
 const specs=[data.variant_name,data.ram,data.storage,data.color].filter(Boolean).join(" • ");
 document.getElementById("itemInfo").innerHTML=`<strong>${esc(data.product_name)}</strong><p>${esc(specs||"Varian standar")}</p><p>${Number(data.quantity||1)} × ${rupiah(data.unit_price)}</p>`;
 document.getElementById("shippingInfo").innerHTML=`<strong>${esc(labelShipping(data.shipping_method))}</strong><p>${esc(data.shipping_provider||"")}</p>${data.distance_km?`<p>Jarak ± ${Number(data.distance_km).toFixed(2)} km</p>`:""}`;
 document.getElementById("subtotal").textContent=rupiah(data.subtotal);
 document.getElementById("shippingFee").textContent=data.shipping_fee_pending?"Menunggu konfirmasi":rupiah(data.shipping_fee);
 document.getElementById("total").textContent=data.shipping_fee_pending?rupiah(data.subtotal)+" + ongkir":rupiah(data.total);
 if(data.shipping_fee_pending) document.getElementById("totalLabel").textContent="Total Sementara";
 const pay=document.getElementById("paymentPanel");
 if(data.payment_method==="transfer"){
   const bank=data.bank||{};
   const warning=data.shipping_fee_pending?'<div class="warning"><i class="fa-solid fa-triangle-exclamation"></i><b>Jangan transfer dulu.</b> Tunggu admin mengonfirmasi ongkir dan total final.</div>':'<div class="notice"><i class="fa-solid fa-circle-info"></i> Silakan transfer sesuai total pesanan dan cantumkan nomor pesanan saat konfirmasi.</div>';
   pay.innerHTML=`<h2><i class="fa-solid fa-building-columns"></i> Transfer Bank</h2><div class="bank"><span>${esc(bank.name||"BCA")}</span><strong id="bankNumber">${esc(bank.account||"5855369360")}</strong><small>a.n. ${esc(bank.account_name||"Ikmal Falahi")}</small><button id="copyBankBtn"><i class="fa-regular fa-copy"></i> Salin Nomor Rekening</button></div>${warning}<div class="status">Status Pembayaran <b>BELUM BAYAR</b></div>`;
   document.getElementById("copyBankBtn")?.addEventListener("click",()=>copyText(bank.account||"5855369360","Nomor rekening"));
 } else if(data.payment_method==="cash"){
   pay.innerHTML='<h2><i class="fa-solid fa-money-bill-wave"></i> Cash / Tunai</h2><div class="notice">Pembayaran dilakukan saat mengambil unit di toko.</div><div class="status">Status Pembayaran <b>BELUM BAYAR</b></div>';
 } else {
   pay.innerHTML='<h2><i class="fa-solid fa-hand-holding-dollar"></i> COD</h2><div class="notice">Bayarkan total COD kepada petugas saat barang diterima.</div><div class="status">Status Pembayaran <b>BELUM BAYAR</b></div>';
 }
 document.getElementById("copyOrderBtn").addEventListener("click",()=>copyText(data.order_number,"Nomor pesanan"));
 document.getElementById("whatsappBtn").addEventListener("click",()=>{
   const totalText=data.shipping_fee_pending?`${rupiah(data.subtotal)} + ongkir (menunggu konfirmasi)`:rupiah(data.total);
   const msg=`Halo CEO Part & Service, saya telah membuat pesanan.\n\n🧾 *${data.order_number}*\n👤 ${data.customer_name}\n📱 ${data.product_name}${specs?`\nVarian: ${specs}`:""}\nQty: ${data.quantity}\n🚚 ${labelShipping(data.shipping_method)}\n💳 ${labelPayment(data.payment_method)}\n💰 ${totalText}\n\nMohon pesanan saya diproses. Terima kasih.`;
   window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`,"_blank");
 });
});
async function copyText(text,label){try{await navigator.clipboard.writeText(text);alert(`${label} berhasil disalin.`)}catch(_){alert(`${label}: ${text}`)}}
