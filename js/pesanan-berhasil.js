"use strict";

const client = window.supabaseClient;
const ADMIN_WHATSAPP = "62895379221306";
const KEY = "ceoProductOrderSuccess";
const PROOF_BUCKET = "bukti-pembayaran-produk";
const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function rupiah(n){return "Rp "+Number(n||0).toLocaleString("id-ID")}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function labelShipping(v){return ({pickup:"Ambil di Toko",instant:"Kurir Instan",package:"Kirim Paket",cod:"COD Lokal"})[v]||v||"-"}
function labelPayment(v){return ({transfer:"Transfer Bank",cash:"Cash / Tunai",cod:"COD"})[v]||v||"-"}

let currentOrder = null;

function proofUploaderHTML(){
 return `
 <div class="proof-box" id="proofBox">
   <div class="proof-head"><i class="fa-solid fa-receipt"></i><div><strong>Upload Bukti Transfer</strong><small>JPG, PNG, WEBP, atau PDF • maksimal 5 MB</small></div></div>
   <label class="proof-picker" for="proofInput" id="proofPicker"><i class="fa-solid fa-cloud-arrow-up"></i><span id="proofFileName">Pilih bukti pembayaran</span></label>
   <input type="file" id="proofInput" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
   <button type="button" id="uploadProofBtn" class="proof-submit" disabled><i class="fa-solid fa-upload"></i> Kirim Bukti Transfer</button>
   <div id="proofResult" class="proof-result" hidden></div>
   <p class="proof-note">Bukti yang dikirim <b>tidak otomatis membuat pembayaran Lunas</b>. Admin akan memverifikasinya terlebih dahulu.</p>
 </div>`;
}

document.addEventListener("DOMContentLoaded",()=>{
 let data=null;try{data=JSON.parse(sessionStorage.getItem(KEY)||"null")}catch(_){ }
 if(!data){document.querySelector(".success-card").innerHTML='<div class="empty"><i class="fa-solid fa-circle-exclamation"></i><h1>Data pesanan tidak ditemukan</h1><p>Silakan kembali ke katalog dan buat pesanan baru.</p><a href="produk-public.html">Kembali ke Produk</a></div>';return}
 currentOrder=data;
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
   const paymentInstruction = data.shipping_fee_pending
     ? `<div class="notice"><i class="fa-solid fa-circle-info"></i> Pesanan sudah berhasil dibuat. Silakan transfer pembayaran produk sebesar <b>${rupiah(data.subtotal)}</b> sekarang, lalu upload bukti di bawah ini. Ongkir akan ditambahkan admin setelah tarif kurir/ekspedisi dikonfirmasi. Jika ada sisa setelah ongkir ditetapkan, status pembayaran otomatis menjadi <b>Sebagian</b> sampai sisa dilunasi.</div>`
     : `<div class="notice"><i class="fa-solid fa-circle-info"></i> Silakan transfer <b>${rupiah(data.total)}</b>, lalu upload bukti pembayaran di bawah ini.</div>`;

   pay.innerHTML=`<h2><i class="fa-solid fa-building-columns"></i> Transfer Bank</h2><div class="bank"><span>${esc(bank.name||"BCA")}</span><strong id="bankNumber">${esc(bank.account||"5855369360")}</strong><small>a.n. ${esc(bank.account_name||"Ikmal Falahi")}</small><button id="copyBankBtn"><i class="fa-regular fa-copy"></i> Salin Nomor Rekening</button></div>${paymentInstruction}<div class="status">Status Pembayaran <b id="paymentStatusText">BELUM BAYAR</b></div>${proofUploaderHTML()}`;
   setupProofUpload();
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

function setupProofUpload(){
 const input=document.getElementById("proofInput");
 const button=document.getElementById("uploadProofBtn");
 const name=document.getElementById("proofFileName");
 if(!input||!button) return;
 input.addEventListener("change",()=>{
   const file=input.files?.[0];
   button.disabled=true;
   if(!file){name.textContent="Pilih bukti pembayaran";return}
   if(!ALLOWED_PROOF_TYPES.includes(file.type)){alert("Format bukti harus JPG, PNG, WEBP, atau PDF.");input.value="";name.textContent="Pilih bukti pembayaran";return}
   if(file.size>MAX_PROOF_SIZE){alert("Ukuran bukti maksimal 5 MB.");input.value="";name.textContent="Pilih bukti pembayaran";return}
   name.textContent=file.name;
   button.disabled=false;
 });
 button.addEventListener("click",uploadProof);
}

async function uploadProof(){
 const input=document.getElementById("proofInput");
 const button=document.getElementById("uploadProofBtn");
 const result=document.getElementById("proofResult");
 const file=input?.files?.[0];
 if(!currentOrder||!file||!client) return;
 const original=button.innerHTML;
 button.disabled=true; button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
 try{
   const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
   const safeOrder=String(currentOrder.order_number||currentOrder.order_id).replace(/[^a-zA-Z0-9_-]/g,"_");
   const path=`${currentOrder.order_id}/${safeOrder}_${Date.now()}.${ext}`;
   const {error:uploadError}=await client.storage.from(PROOF_BUCKET).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
   if(uploadError) throw uploadError;
   const {data,error}=await client.rpc("submit_product_payment_proof",{
     p_order_number:currentOrder.order_number,
     p_customer_whatsapp:currentOrder.customer_whatsapp,
     p_proof_path:path
   });
   if(error){await client.storage.from(PROOF_BUCKET).remove([path]);throw error}
   if(!data?.success){await client.storage.from(PROOF_BUCKET).remove([path]);throw new Error(data?.message||"Bukti pembayaran gagal disimpan.")}
   result.hidden=false; result.className="proof-result success"; result.innerHTML='<i class="fa-solid fa-circle-check"></i><div><strong>Bukti transfer berhasil dikirim</strong><span>Menunggu verifikasi pembayaran oleh admin.</span></div>';
   document.getElementById("paymentStatusText").textContent="MENUNGGU VERIFIKASI";
   input.disabled=true; button.disabled=true; button.innerHTML='<i class="fa-solid fa-check"></i> Bukti Terkirim';
   currentOrder.payment_status="menunggu_verifikasi";
   currentOrder.proof_submitted=true;
   sessionStorage.setItem(KEY,JSON.stringify(currentOrder));
 }catch(err){
   console.error("Upload bukti transfer gagal:",err);
   result.hidden=false; result.className="proof-result error"; result.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><div><strong>Gagal mengirim bukti</strong><span>${esc(err?.message||"Silakan coba lagi.")}</span></div>`;
   button.disabled=false; button.innerHTML=original;
 }
}

async function copyText(text,label){try{await navigator.clipboard.writeText(text);alert(`${label} berhasil disalin.`)}catch(_){alert(`${label}: ${text}`)}}
