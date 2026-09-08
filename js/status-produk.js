"use strict";
const client = window.supabaseClient;
const ADMIN_WHATSAPP = "62895379221306";

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const formatDate = v => v ? new Date(v).toLocaleString("id-ID",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "-";

const ORDER_LABELS={menunggu_diproses:"Menunggu Diproses",dikemas:"Dikemas",dikirim:"Dikirim",dalam_perjalanan:"Dalam Perjalanan",selesai:"Selesai",dibatalkan:"Dibatalkan",gagal_dikirim:"Gagal Dikirim"};
const SHIP_LABELS={belum_dikirim:"Belum Dikirim",dikemas:"Dikemas",dikirim:"Dikirim",dalam_perjalanan:"Dalam Perjalanan",terkirim:"Terkirim",gagal:"Gagal"};
const PAY_LABELS={belum_bayar:"Belum Bayar",dp:"DP",sebagian:"Sebagian",lunas:"Lunas",refund:"Refund"};
const METHOD_LABELS={transfer:"Transfer Bank",cash:"Cash / Tunai",cod:"COD"};
const SHIPPING_LABELS={pickup:"Ambil di Toko",instant:"Kurir Instan",package:"Kirim Paket",cod:"COD Lokal",delivery:"Delivery"};

let currentOrder=null;

document.addEventListener("DOMContentLoaded",()=>{
  const q=new URLSearchParams(location.search);
  if(q.get("order")) $("orderNumberInput").value=q.get("order");
  if(q.get("wa")) $("whatsappInput").value=q.get("wa");
  $("statusForm").addEventListener("submit",loadStatus);
  $("newSearchBtn").addEventListener("click",()=>{currentOrder=null;$("resultSection").hidden=true;$("messageBox").hidden=true;$("orderNumberInput").focus();window.scrollTo({top:0,behavior:"smooth"});});
});

async function loadStatus(e){
  e.preventDefault();
  const order=$("orderNumberInput").value.trim();
  const wa=$("whatsappInput").value.trim();
  if(!order||!wa) return showMessage("Nomor pesanan dan WhatsApp wajib diisi.");
  const btn=$("searchBtn"),old=btn.innerHTML;
  btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mencari...';
  $("messageBox").hidden=true;
  try{
    const {data,error}=await client.rpc("get_public_product_order_status",{p_order_number:order,p_customer_whatsapp:wa});
    if(error) throw error;
    if(!data?.success) throw new Error(data?.message||"Pesanan tidak ditemukan.");
    currentOrder=data.order;
    renderOrder(currentOrder);
    history.replaceState({},"",`status-produk.html?order=${encodeURIComponent(currentOrder.order_number)}&wa=${encodeURIComponent(wa)}`);
  }catch(err){
    console.error(err);
    $("resultSection").hidden=true;
    showMessage(err?.message||"Gagal mengambil status pesanan.");
  }finally{btn.disabled=false;btn.innerHTML=old;}
}

function showMessage(msg){const box=$("messageBox");box.hidden=false;box.className="message-box error";box.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i> ${esc(msg)}`;}

function renderOrder(o){
  $("resultOrderNumber").textContent=o.order_number||("#"+o.id);
  $("resultDate").textContent="Dibuat "+formatDate(o.created_at);
  const badge=$("orderStatusBadge");badge.textContent=ORDER_LABELS[o.order_status]||o.order_status||"-";badge.className="status-badge"+(o.order_status==="selesai"?" success":o.order_status==="dibatalkan"||o.order_status==="gagal_dikirim"?" danger":o.order_status==="menunggu_diproses"?" warn":"");
  $("customerName").textContent=o.customer_name||"-";
  $("customerWhatsapp").textContent=maskPhone(o.customer_whatsapp);
  $("customerAddress").textContent=o.customer_address||"-";

  const ship=o.shipment||{};
  $("shippingMethod").textContent=SHIPPING_LABELS[o.shipping_type]||SHIPPING_LABELS[o.shipping_method]||o.shipping_method||"-";
  $("courier").textContent=ship.courier|| (o.shipping_method==="pickup"?"Ambil sendiri":"Menunggu admin");
  $("trackingNumber").textContent=ship.tracking_number||"-";
  $("shippingStatus").textContent=SHIP_LABELS[ship.shipping_status]||ship.shipping_status|| (o.shipping_method==="pickup"?"Pickup":"-");

  const payment=o.payment||{};
  $("paymentMethod").textContent=METHOD_LABELS[o.payment_method]||o.payment_method||"-";
  $("paymentStatus").textContent=PAY_LABELS[o.payment_status]||o.payment_status||"-";
  $("proofStatus").textContent=payment.proof_url ? (payment.payment_status==="paid"?"Terverifikasi":"Sudah masuk") : (o.payment_method==="transfer"?"Belum ada":"Tidak diperlukan");
  $("paymentHint").innerHTML=paymentHint(o,payment);

  $("subtotal").textContent=rupiah(o.subtotal);
  $("discount").textContent=rupiah(o.discount);
  $("shippingFee").textContent=(o.shipping_method==="delivery" && Number(o.shipping_fee||0)===0 && o.shipping_type!=="cod") ? "Menunggu admin" : rupiah(o.shipping_fee);
  $("amountPaid").textContent=rupiah(o.amount_paid);
  $("remainingAmount").textContent=rupiah(o.remaining_amount);
  $("grandTotal").textContent=rupiah(o.total);

  const items=Array.isArray(o.items)?o.items:[];
  $("itemsList").innerHTML=items.length?items.map(item=>{
    const specs=[item.variant_name,item.ram,item.storage,item.color].filter(Boolean).join(" • ");
    return `<div class="item-line"><div><strong>${esc(item.product_name||"Produk HP")}</strong><p>${esc(specs||"Varian standar")}</p><p>Qty: ${Number(item.quantity||1)}</p></div><div class="item-price"><span>${rupiah(item.unit_price)}</span><b>${rupiah(item.subtotal)}</b></div></div>`;
  }).join(""):'<div class="inline-hint">Detail produk tidak tersedia.</div>';

  renderProgress(o);
  const invoice=$("invoiceBtn");
  if(o.payment_status==="lunas"){invoice.hidden=false;invoice.href=`nota-produk.html?id=${encodeURIComponent(o.id)}`;}else{invoice.hidden=true;}
  const msg=`Halo CEO Part & Service, saya ingin menanyakan pesanan ${o.order_number||"#"+o.id}. Status saat ini: ${ORDER_LABELS[o.order_status]||o.order_status}.`;
  $("contactAdminBtn").href=`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  $("resultSection").hidden=false;
  setTimeout(()=>$("resultSection").scrollIntoView({behavior:"smooth",block:"start"}),80);
}

function renderProgress(o){
  const isPickup=o.shipping_method==="pickup";
  const stages=isPickup
    ? [{k:"menunggu_diproses",l:"Menunggu"},{k:"dikemas",l:"Siap Diambil"},{k:"selesai",l:"Selesai"}]
    : [{k:"menunggu_diproses",l:"Menunggu"},{k:"dikemas",l:"Dikemas"},{k:"dikirim",l:"Dikirim"},{k:"dalam_perjalanan",l:"Perjalanan"},{k:"selesai",l:"Selesai"}];
  const rank={menunggu_diproses:0,dikemas:1,dikirim:2,dalam_perjalanan:3,selesai:4};
  let current=rank[o.order_status]??0;
  if(isPickup && o.order_status==="selesai") current=2;
  if(isPickup && o.order_status==="dikemas") current=1;
  const stopped=o.order_status==="dibatalkan"||o.order_status==="gagal_dikirim";
  $("progressSteps").style.gridTemplateColumns=`repeat(${stages.length},1fr)`;
  $("progressSteps").innerHTML=stages.map((s,i)=>`<div class="step ${!stopped&&i<current?"done":!stopped&&i===current?"active":""}"><div class="step-dot">${!stopped&&i<current?'<i class="fa-solid fa-check"></i>':i+1}</div><span>${s.l}</span></div>`).join("");
  $("nextAction").innerHTML=nextActionText(o);
}

function nextActionText(o){
  if(o.order_status==="dibatalkan") return '<b>Pesanan dibatalkan.</b> Hubungi admin jika membutuhkan informasi lebih lanjut.';
  if(o.order_status==="gagal_dikirim") return '<b>Pengiriman mengalami kendala.</b> Silakan hubungi admin untuk penjadwalan atau tindak lanjut.';
  if(o.order_status==="selesai") return '<b>Pesanan selesai.</b> Terima kasih telah berbelanja di CEO Part & Service.';
  if(o.payment_method==="transfer" && o.payment_status!=="lunas"){
    if(o.payment?.proof_url) return '<b>Bukti pembayaran sudah masuk.</b> Saat ini menunggu verifikasi admin atau pelunasan sisa pembayaran.';
    return '<b>Pembayaran belum selesai.</b> Silakan ikuti instruksi transfer dari halaman pesanan berhasil atau hubungi admin.';
  }
  if(o.shipping_method==="delivery" && Number(o.shipping_fee||0)===0 && o.shipping_type!=="cod") return '<b>Menunggu penetapan ongkir.</b> Admin akan menyesuaikan tarif kurir/ekspedisi.';
  if(o.order_status==="menunggu_diproses") return '<b>Pesanan sudah tercatat.</b> Admin akan mulai memproses pesanan Anda.';
  if(o.order_status==="dikemas") return o.shipping_method==="pickup"?'<b>Pesanan siap diambil.</b> Silakan koordinasikan waktu pengambilan dengan admin.':'<b>Pesanan sedang dikemas.</b> Selanjutnya pesanan akan diserahkan ke kurir.';
  if(o.order_status==="dikirim") return '<b>Pesanan sudah dikirim.</b> Pantau nomor resi/kode pengiriman pada bagian Pengiriman.';
  if(o.order_status==="dalam_perjalanan") return '<b>Pesanan dalam perjalanan.</b> Mohon pastikan penerima dapat dihubungi.';
  return 'Status pesanan sedang diperbarui.';
}

function paymentHint(o,p){
  if(o.payment_method==="cod") return 'Pembayaran dilakukan kepada petugas saat barang diterima.';
  if(o.payment_method==="cash") return 'Pembayaran tunai dilakukan saat mengambil barang di toko.';
  if(o.payment_status==="lunas") return '<b>Pembayaran sudah lunas dan terverifikasi.</b>';
  if(p.proof_url && p.payment_status==="pending") return '<b>Bukti transfer menunggu verifikasi admin.</b>';
  if(o.payment_status==="sebagian") return `Masih ada sisa pembayaran sebesar <b>${rupiah(o.remaining_amount)}</b>.`;
  return 'Pembayaran belum terverifikasi.';
}

function maskPhone(v){const d=String(v||"").replace(/\D/g,"");if(d.length<7)return v||"-";return d.slice(0,4)+"****"+d.slice(-3);}
