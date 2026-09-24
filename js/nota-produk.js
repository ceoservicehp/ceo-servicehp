"use strict";

const client = window.supabaseClient;
let currentData = null;
let currentShipment = null;
let currentPayment = null;

function $(id){ return document.getElementById(id); }
function rupiah(n){ return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
function getId(){ return new URLSearchParams(window.location.search).get("id"); }
function esc(value){ return String(value ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function label(value){ if(!value) return "-"; return String(value).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase()); }
function formatDate(value){ if(!value) return "-"; const d=new Date(value); if(Number.isNaN(d.getTime())) return "-"; return d.toLocaleString("id-ID",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
function latest(arr){ return [...(arr||[])].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null; }
function setText(id,value){ const el=$(id); if(el) el.textContent=value ?? "-"; }
function shippingName(order,shipment){ if(order.shipping_method==="pickup") return "Ambil di Toko"; if(order.payment_method==="cod") return "COD"; const c=String(shipment?.courier||"").trim(); if(/gojek|grab|gosend|grabexpress|instant/i.test(c)) return c?`Kurir Instan (${c})`:"Kurir Instan"; return c?`Kirim Paket (${c})`:"Kirim Paket"; }


function warrantyDate(value){
  if(!value) return "-";
  const d=new Date(String(value).length===10 ? value+"T00:00:00" : value);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
}
function warrantyState(w){
  if(w?.is_active===false) return {key:"nonaktif",label:"Nonaktif"};
  if(!w?.warranty_start || !w?.warranty_end) return {key:"belum",label:"Belum Aktif"};
  const now=new Date(); now.setHours(0,0,0,0);
  const start=new Date(w.warranty_start+"T00:00:00");
  const end=new Date(w.warranty_end+"T23:59:59");
  if(now<start) return {key:"belum",label:"Belum Mulai"};
  if(now>end) return {key:"habis",label:"Habis"};
  return {key:"aktif",label:"Aktif"};
}
function warrantyDuration(w){
  if(w?.duration_value && w?.duration_unit){
    const u={hari:"Hari",bulan:"Bulan",tahun:"Tahun"}[String(w.duration_unit).toLowerCase()] || w.duration_unit;
    return `${w.duration_value} ${u}`;
  }
  return "";
}
function allInvoiceWarranties(data){
  const rows=[];
  (data?.order_items||[]).forEach((item,itemIndex)=>{
    (item.order_item_units||[]).forEach((unit,unitIndex)=>{
      (unit.product_warranties||[]).forEach(w=>rows.push({
        ...w,
        product_name:item.product_name||"Produk",
        variant_name:item.variant_name||"",
        ram:item.ram||"",
        storage:item.storage||"",
        color:item.color||"",
        imei1:unit.imei1||"",
        imei2:unit.imei2||"",
        serial_number:unit.serial_number||"",
        unit_label:`Unit ${unitIndex+1}`,
        item_index:itemIndex
      }));
    });
  });
  return rows;
}
function renderWarranties(data){
  const wrap=$("invoice-warranty-list");
  const section=$("invoice-warranty-section");
  if(!wrap||!section) return;
  const rows=allInvoiceWarranties(data);
  if(!rows.length){
    section.style.display="none";
    return;
  }
  section.style.display="block";
  const groups=new Map();
  rows.forEach(w=>{
    const key=`${w.item_index}|${w.imei1}|${w.imei2}|${w.serial_number}|${w.unit_label}`;
    if(!groups.has(key)) groups.set(key,{meta:w,rows:[]});
    groups.get(key).rows.push(w);
  });
  wrap.innerHTML=[...groups.values()].map(g=>{
    const w=g.meta;
    const variant=[w.variant_name,w.ram?`RAM ${w.ram}`:"",w.storage?`Storage ${w.storage}`:"",w.color].filter(Boolean).join(" · ");
    const identity=[
      `IMEI 1: ${esc(w.imei1||"-")}`,
      w.imei2?`IMEI 2: ${esc(w.imei2)}`:"",
      w.serial_number?`Serial: ${esc(w.serial_number)}`:""
    ].filter(Boolean).join(" · ");
    return `<article class="invoice-warranty-unit">
      <div class="invoice-warranty-unit-head">
        <div><strong>${esc(w.product_name)} — ${esc(w.unit_label)}</strong><span>${esc(variant||"-")}</span></div>
        <small>${identity}</small>
      </div>
      <div class="invoice-warranty-cards">
        ${g.rows.map(x=>{
          const st=warrantyState(x);
          return `<div class="invoice-warranty-card">
            <div class="invoice-warranty-title"><strong><i class="fa-solid ${String(x.warranty_type||"").toLowerCase().includes("service")?"fa-screwdriver-wrench":"fa-shield-halved"}"></i> ${esc(x.warranty_type||"Garansi")}</strong><span class="warranty-status ${st.key}">${st.label}</span></div>
            ${warrantyDuration(x)?`<div class="warranty-duration">${esc(warrantyDuration(x))}</div>`:""}
            <div class="warranty-period"><span>Mulai <b>${warrantyDate(x.warranty_start)}</b></span><i class="fa-solid fa-arrow-right"></i><span>Berakhir <b>${warrantyDate(x.warranty_end)}</b></span></div>
            ${x.warranty_note?`<div class="warranty-note"><i class="fa-regular fa-note-sticky"></i> ${esc(x.warranty_note)}</div>`:""}
          </div>`;
        }).join("")}
      </div>
    </article>`;
  }).join("");
}

async function init(){
  const id=Number(getId());
  if(!id){ showError("ID order tidak valid."); return; }
  const {data,error}=await client.from("orders").select(`*,order_items(*,order_item_units(*,product_warranties(*))),order_payments(*),order_shipments(*)`).eq("id",id).single();
  if(error||!data){ console.error(error); showError("Invoice produk tidak dapat dimuat."); return; }
  currentData=data; currentShipment=latest(data.order_shipments); currentPayment=latest(data.order_payments);
  renderInvoice(data); await loadSignature(); renderQR();
}

function renderInvoice(data){
  const shipment=currentShipment, items=data.order_items||[];
  setText("inv-number", data.order_number || `INV-${String(data.id).padStart(5,"0")}`);
  setText("inv-date", formatDate(data.created_at));
  setText("c-name",data.customer_name||"-"); setText("c-phone",data.customer_whatsapp||"-"); setText("c-email",data.customer_email||"-"); setText("c-address",data.customer_address||"-");
  setText("c-shipping",shippingName(data,shipment)); setText("c-payment-method",label(data.payment_method));
  setText("order-status",label(data.order_status)); setText("order-created",formatDate(data.created_at));
  setText("shipping-courier",data.shipping_method==="pickup"?"-":(shipment?.courier||"-")); setText("shipping-tracking",shipment?.tracking_number||"-");
  setText("shipping-status",data.shipping_method==="pickup"?"Ambil di Toko":label(shipment?.shipping_status||"belum_dikirim"));
  if(data.customer_note){ $("note-section").style.display="block"; setText("c-note",data.customer_note); }

  const ps=String(data.payment_status||"belum_bayar").toLowerCase(), el=$("payment-status");
  el.textContent=label(ps); el.classList.remove("paid","unpaid","partial");
  if(ps==="lunas") el.classList.add("paid"); else if(ps==="dp"||ps==="sebagian") el.classList.add("partial"); else el.classList.add("unpaid");

  renderItems(items); renderSummary(data); renderWarranties(data); renderPaymentState(data);
  $("invoice-loading").style.display="none"; $("invoice-content").style.display="block";
}

function renderItems(items){
  const body=$("invoice-items"); body.innerHTML="";
  if(!items.length){ body.innerHTML=`<tr><td colspan="5" class="muted-text">Tidak ada detail produk.</td></tr>`; return; }
  body.innerHTML=items.map(item=>{
    const variant=[item.variant_name,item.ram?`RAM ${item.ram}`:"",item.storage?`Storage ${item.storage}`:"",item.color].filter(Boolean).join(" · ");
    const units=item.order_item_units||[];
    const unitHtml=units.length?units.map((u,i)=>`<div class="unit-line"><b>Unit ${i+1}</b><br>IMEI 1: ${esc(u.imei1||"-")}${u.imei2?`<br>IMEI 2: ${esc(u.imei2)}`:""}${u.serial_number?`<br>Serial: ${esc(u.serial_number)}`:""}</div>`).join(""):`<span class="muted-text">IMEI belum ditetapkan</span>`;
    return `<tr><td><strong>${esc(item.product_name||"Produk")}</strong><div class="variant-text">${esc(variant||"-")}</div></td><td>${unitHtml}</td><td>${Number(item.quantity||0)}</td><td>${rupiah(item.unit_price)}</td><td><strong>${rupiah(item.subtotal)}</strong></td></tr>`;
  }).join("");
}

function renderSummary(data){
  const subtotal=Number(data.subtotal||0), discount=Number(data.discount||0), shipping=Number(data.shipping_fee||0), total=Number(data.total||Math.max(subtotal-discount,0)+shipping), paid=Number(data.amount_paid||0), remaining=Number(data.remaining_amount ?? Math.max(total-paid,0));
  setText("sub-total",rupiah(subtotal)); setText("discount-total",discount>0?`- ${rupiah(discount)}`:rupiah(0)); setText("shipping-total",rupiah(shipping)); setText("paid-total",rupiah(paid)); setText("grand-total",rupiah(total));
  const row=$("row-remaining"), re=$("remaining-total");
  if(remaining>0){ row.style.display="flex"; row.querySelector("span").textContent="Kurang Bayar"; re.textContent="- "+rupiah(remaining); }
  else if(paid>total){ row.style.display="flex"; row.querySelector("span").textContent="Kembalian"; re.textContent=rupiah(paid-total); }
  else row.style.display="none";
  if(discount===0) $("row-discount").style.display="none"; if(shipping===0&&data.shipping_method==="pickup") $("row-shipping").style.display="none"; if(paid===0) $("row-paid").style.display="none";
}

function renderPaymentState(data){
  const ps=String(data.payment_status||"belum_bayar").toLowerCase(), paid=ps==="lunas", transfer=String(data.payment_method||"").toLowerCase()==="transfer";
  $("downloadPdfBtn").style.display=paid?"inline-flex":"none"; $("rekeningBtn").style.display=!paid?"inline-flex":"none";
  const wm=$("watermark"), stamp=$("digital-stamp"); wm.className="watermark"; stamp.className="digital-stamp";
  if(paid){ wm.textContent="LUNAS"; wm.classList.add("wm-paid"); stamp.textContent="✔ LUNAS"; stamp.classList.add("stamp-paid"); }
  else if(ps==="sebagian"||ps==="dp"){ wm.textContent="SEBAGIAN"; wm.classList.add("wm-partial"); stamp.textContent="PEMBAYARAN SEBAGIAN"; stamp.classList.add("stamp-partial"); }
  else{ wm.textContent="BELUM LUNAS"; wm.classList.add("wm-unpaid"); stamp.textContent="BELUM LUNAS"; stamp.classList.add("stamp-unpaid"); }
}

function renderQR(){ const qr=$("qr"); if(!qr||!window.QRCode) return; qr.innerHTML=""; const invoiceNo = currentData.order_number || `ORD-${String(currentData.id).padStart(5,"0")}`; const url=`${window.location.origin}/verifikasi-produk.html?id=${encodeURIComponent(currentData.id)}&no=${encodeURIComponent(invoiceNo)}`; QRCode.toCanvas(document.createElement("canvas"),url,{width:130,margin:1},(err,c)=>{if(!err) qr.appendChild(c);}); }

async function loadSignature(){
  const paid=[...(currentData?.order_payments||[])].filter(p=>p.payment_status==="paid"&&p.created_by).sort((a,b)=>new Date(b.paid_at||b.created_at||0)-new Date(a.paid_at||a.created_at||0));
  const adminId=paid[0]?.created_by; if(!adminId) return;
  const {data,error}=await client.from("profiles").select("signature_url,full_name").eq("id",adminId).maybeSingle(); if(error||!data) return;
  if(data.full_name) $("ttdName").textContent=data.full_name; if(!data.signature_url) return;
  let url=data.signature_url; if(!url.startsWith("http")){ const {data:d}=client.storage.from("signature_url").getPublicUrl(url); url=d?.publicUrl||""; }
  if(url){ const box=$("ttdImg"); box.style.backgroundImage=`url("${url}")`; box.style.backgroundSize="contain"; box.style.backgroundRepeat="no-repeat"; box.style.backgroundPosition="center"; }
}

function showError(msg){ const l=$("invoice-loading"); l.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i> ${esc(msg)}`; l.classList.add("error"); }
function showRekening(){ const rekening="5855369360"; document.body.insertAdjacentHTML("beforeend",`<div id="rekeningModal" class="rekening-modal"><div class="rekening-box"><h3>Informasi Pembayaran</h3><p class="bank-name">BANK BCA</p><div class="rekening-number">${rekening}</div><p>a.n <strong>IKMAL FALAHI</strong></p><button class="copy-btn" onclick="copyRekening('${rekening}')"><i class="fa-solid fa-copy"></i> Copy Nomor Rekening</button><button class="close-btn" onclick="closeRekeningModal()">Tutup</button></div></div>`); }
function copyRekening(v){ navigator.clipboard.writeText(v); alert("Nomor rekening berhasil disalin"); }
function closeRekeningModal(){ $("rekeningModal")?.remove(); }

window.showRekening=showRekening; window.copyRekening=copyRekening; window.closeRekeningModal=closeRekeningModal;
document.addEventListener("DOMContentLoaded",init);
