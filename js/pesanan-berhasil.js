"use strict";
const client=window.supabaseClient;
const ADMIN_WHATSAPP="62895379221306";
const KEY="ceoProductOrderSuccess";
const PROOF_BUCKET="bukti-pembayaran-produk";
const MAX_PROOF_SIZE=5*1024*1024;
const ALLOWED_PROOF_TYPES=["image/jpeg","image/png","image/webp","application/pdf"];
const rupiah=n=>"Rp "+Number(n||0).toLocaleString("id-ID");
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const labelShipping=v=>({pickup:"Ambil di Toko",instant:"Kurir Instan",package:"Kirim Paket",cod:"COD Lokal"})[v]||v||"-";
const labelPayment=v=>({transfer:"Transfer Bank",cash:"Cash / Tunai"})[v]||v||"-";
let currentOrder=null;

function proofUploaderHTML(title="Upload Bukti Transfer"){
 return `<div class="proof-box" id="proofBox"><div class="proof-head"><i class="fa-solid fa-receipt"></i><div><strong>${title}</strong><small>JPG, PNG, WEBP, atau PDF • maksimal 5 MB</small></div></div><label class="proof-picker" for="proofInput"><i class="fa-solid fa-cloud-arrow-up"></i><span id="proofFileName">Pilih bukti pembayaran</span></label><input type="file" id="proofInput" accept="image/jpeg,image/png,image/webp,application/pdf" hidden><button type="button" id="uploadProofBtn" class="proof-submit" disabled><i class="fa-solid fa-upload"></i> Kirim Bukti Transfer</button><div id="proofResult" class="proof-result" hidden></div><p class="proof-note">Bukti pembayaran akan diverifikasi admin dan tidak otomatis mengubah status menjadi Lunas.</p></div>`;
}
document.addEventListener("DOMContentLoaded",()=>{
 let data=null; try{data=JSON.parse(sessionStorage.getItem(KEY)||"null")}catch(_){}
 if(!data){document.querySelector(".success-card").innerHTML='<div class="empty"><i class="fa-solid fa-circle-exclamation"></i><h1>Data pesanan tidak ditemukan</h1><p>Silakan kembali ke katalog dan buat pesanan baru.</p><a href="produk-public.html">Kembali ke Produk</a></div>';return}
 currentOrder=data;
 const specs=[data.variant_name,data.ram,data.storage,data.color].filter(Boolean).join(" • ");
 document.getElementById("orderNumber").textContent=data.order_number||"-";
 document.getElementById("itemInfo").innerHTML=`<strong>${esc(data.product_name)}</strong><p>${esc(specs||"Varian standar")}</p><p>${Number(data.quantity||1)} × ${rupiah(data.unit_price)}</p>`;
 document.getElementById("shippingInfo").innerHTML=`<strong>${esc(labelShipping(data.shipping_method))}</strong><p>${esc(data.shipping_provider||"")}</p>${data.distance_km?`<p>Jarak ± ${Number(data.distance_km).toFixed(2)} km</p>`:""}`;
 document.getElementById("subtotal").textContent=rupiah(data.subtotal);
 document.getElementById("shippingFee").textContent=data.shipping_fee_pending?"Menunggu konfirmasi":rupiah(data.shipping_fee);
 document.getElementById("total").textContent=data.shipping_fee_pending?`${rupiah(data.subtotal)} + ongkir`:rupiah(data.total);
 if(data.shipping_fee_pending) document.getElementById("totalLabel").textContent="Total Sementara";

 const pay=document.getElementById("paymentPanel"), bank=data.bank||{};
 if(data.payment_method==="cash"&&data.shipping_method==="pickup"){
   pay.innerHTML='<h2><i class="fa-solid fa-money-bill-wave"></i> Cash / Tunai</h2><div class="notice">Pembayaran dilakukan saat mengambil produk di toko. Admin akan memperbarui status pembayaran setelah uang diterima.</div><div class="status">Status Pembayaran <b>BELUM BAYAR</b></div>';
 }else if(data.payment_method==="transfer"){
   let instruction="", uploaderTitle="Upload Bukti Transfer";
   if(data.shipping_method==="cod"){
     instruction=`<div class="notice"><i class="fa-solid fa-circle-info"></i> Untuk COD Lokal, <b>ongkir wajib dibayar terlebih dahulu</b>. Pembayaran harga produk mengikuti kesepakatan dengan pihak CEO Part & Service.</div>`;
     uploaderTitle="Upload Bukti Transfer Ongkir / Pembayaran";
   }else if(data.shipping_method==="instant"||data.shipping_method==="package"){
     instruction=`<div class="notice"><i class="fa-solid fa-handshake"></i> Pesanan sudah tercatat. Anda <b>tidak diwajibkan langsung melunasi harga produk</b>. Biaya pengiriman dan pembayaran produk akan dikonfirmasi oleh pihak CEO Part & Service sesuai kesepakatan.</div>`;
   }else{
     instruction=`<div class="notice"><i class="fa-solid fa-circle-info"></i> Untuk Ambil di Toko dengan metode Transfer, pembayaran dapat dilakukan ke rekening berikut dan bukti pembayaran dapat dikirim untuk diverifikasi admin.</div>`;
   }
   pay.innerHTML=`<h2><i class="fa-solid fa-building-columns"></i> Transfer Bank</h2><div class="bank"><span>${esc(bank.name||"BCA")}</span><strong id="bankNumber">${esc(bank.account||"5855369360")}</strong><small>a.n. ${esc(bank.account_name||"Ikmal Falahi")}</small><button id="copyBankBtn"><i class="fa-regular fa-copy"></i> Salin Nomor Rekening</button></div>${instruction}<div class="status">Status Pembayaran <b id="paymentStatusText">BELUM BAYAR</b></div>${proofUploaderHTML(uploaderTitle)}`;
   setupProofUpload();
   document.getElementById("copyBankBtn")?.addEventListener("click",()=>copyText(bank.account||"5855369360","Nomor rekening"));
 }
 document.getElementById("trackOrderBtn").href=`cek-pesanan-produk.html?order=${encodeURIComponent(data.order_number||"")}`;
 document.getElementById("copyOrderBtn").onclick=()=>copyText(data.order_number,"Nomor pesanan");
 document.getElementById("whatsappBtn").onclick=()=>{
   const totalText=data.shipping_fee_pending?`${rupiah(data.subtotal)} + ongkir menunggu konfirmasi`:rupiah(data.total);
   const track=`${location.origin}${location.pathname.replace(/[^/]+$/,"")}cek-pesanan-produk.html?order=${encodeURIComponent(data.order_number||"")}`;
   const msg=`Halo CEO Part & Service, saya telah membuat pesanan produk.\n\n*INFORMASI PESANAN*\nNo. Pesanan: ${data.order_number}\nNama: ${data.customer_name||"-"}\nProduk: ${data.product_name}${specs?`\nVarian: ${specs}`:""}\nQty: ${data.quantity||1}\nPengiriman: ${labelShipping(data.shipping_method)}\nMetode Pembayaran: ${labelPayment(data.payment_method)}\nTotal: ${totalText}\n\nCek pesanan: ${track}\n\nMohon pesanan saya diperiksa dan diproses. Terima kasih.`;
   window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`,"_blank");
 };
});
function setupProofUpload(){
 const input=document.getElementById("proofInput"),button=document.getElementById("uploadProofBtn"),name=document.getElementById("proofFileName");
 if(!input||!button)return;
 input.onchange=()=>{const f=input.files?.[0];button.disabled=true;if(!f){name.textContent="Pilih bukti pembayaran";return}if(!ALLOWED_PROOF_TYPES.includes(f.type)){alert("Format bukti harus JPG, PNG, WEBP, atau PDF.");input.value="";return}if(f.size>MAX_PROOF_SIZE){alert("Ukuran bukti maksimal 5 MB.");input.value="";return}name.textContent=f.name;button.disabled=false};
 button.onclick=uploadProof;
}
async function uploadProof(){
 const input=document.getElementById("proofInput"),button=document.getElementById("uploadProofBtn"),result=document.getElementById("proofResult"),file=input?.files?.[0];
 if(!currentOrder||!file||!client)return;
 const original=button.innerHTML;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
 try{
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const safeOrder=String(currentOrder.order_number||currentOrder.order_id).replace(/[^a-zA-Z0-9_-]/g,"_");
  const path=`${currentOrder.order_id}/${safeOrder}_${Date.now()}.${ext}`;
  const {error:up}=await client.storage.from(PROOF_BUCKET).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type}); if(up)throw up;
  const {data,error}=await client.rpc("submit_product_payment_proof",{p_order_number:currentOrder.order_number,p_customer_whatsapp:currentOrder.customer_whatsapp,p_proof_path:path});
  if(error){await client.storage.from(PROOF_BUCKET).remove([path]);throw error}
  if(!data?.success){await client.storage.from(PROOF_BUCKET).remove([path]);throw new Error(data?.message||"Bukti pembayaran gagal disimpan.")}
  result.hidden=false;result.className="proof-result success";result.innerHTML='<i class="fa-solid fa-circle-check"></i><div><strong>Bukti berhasil dikirim</strong><span>Menunggu verifikasi admin.</span></div>';
  document.getElementById("paymentStatusText").textContent="MENUNGGU VERIFIKASI";input.disabled=true;button.disabled=true;button.innerHTML='<i class="fa-solid fa-check"></i> Bukti Terkirim';
 }catch(err){result.hidden=false;result.className="proof-result error";result.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><div><strong>Gagal mengirim bukti</strong><span>${esc(err?.message||"Silakan coba lagi.")}</span></div>`;button.disabled=false;button.innerHTML=original}
}
async function copyText(text,label){try{await navigator.clipboard.writeText(text);alert(`${label} berhasil disalin.`)}catch(_){alert(`${label}: ${text}`)}}
