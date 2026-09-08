"use strict";
const client = window.supabaseClient;
const $ = id => document.getElementById(id);
const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const label = v => String(v || "-").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const fmtDate = v => v ? new Date(v).toLocaleString("id-ID",{dateStyle:"long",timeStyle:"short"}) : "-";
let currentOrder = null;

async function init(){
  const id = Number(new URLSearchParams(location.search).get("id"));
  if(!id){ showError("ID order tidak valid."); return; }
  const {data,error}=await client.from("orders").select(`*,order_items(*,order_item_units(*)),order_payments(*),order_shipments(*)`).eq("id",id).single();
  if(error || !data){ console.error(error); showError("Nota tidak dapat dimuat. Pastikan Anda login sebagai admin."); return; }
  currentOrder=data; render(data); $("pdfBtn").onclick=downloadPDF;
}
function latest(arr){return [...(arr||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}
function shippingName(o,s){ if(o.shipping_method==="pickup") return "Ambil di Toko"; if(o.payment_method==="cod") return "COD"; const c=String(s?.courier||""); if(/gojek|grab|gosend|grabexpress/i.test(c)) return "Kurir Instan"; return c ? `Pengiriman · ${c}` : "Pengiriman"; }
function render(o){
 const items=o.order_items||[], ship=latest(o.order_shipments), pay=latest(o.order_payments);
 const allUnits=items.flatMap(i=>(i.order_item_units||[]));
 $("loading").hidden=true; $("invoiceContent").hidden=false;
 $("invoiceContent").innerHTML=`
 <header class="inv-head"><div class="brand"><img src="images/logo.png" alt="CEO"><div><h1>CEO PART & SERVICE</h1><p>CELLULAR ENGINEERING OFFICER<br>Nota Penjualan Handphone</p></div></div><div class="inv-meta"><h2>INVOICE</h2><strong>${esc(o.order_number||`ORDER-${o.id}`)}</strong><span>${fmtDate(o.created_at)}</span><div class="status-line"><span class="badge ${o.payment_status==='lunas'?'ok':'warn'}">${esc(label(o.payment_status))}</span><span class="badge">${esc(label(o.order_status))}</span></div></div></header>
 <section class="section"><div class="section-title">DATA PEMBELI</div><div class="info-grid"><div class="info-box"><span>Nama / WhatsApp</span><strong>${esc(o.customer_name)}\n${esc(o.customer_whatsapp)}</strong></div><div class="info-box"><span>Pengiriman</span><strong>${esc(shippingName(o,ship))}\n${esc(ship?.tracking_number?`Resi: ${ship.tracking_number}`:'')}</strong></div><div class="info-box"><span>Alamat</span><strong>${esc(o.customer_address||'-')}</strong></div><div class="info-box"><span>Pembayaran</span><strong>${esc(label(o.payment_method))} · ${esc(label(o.payment_status))}</strong></div></div></section>
 <section class="section"><div class="section-title">RINCIAN PRODUK</div><div class="items-wrap"><table class="items"><thead><tr><th>Produk / Unit</th><th>Varian</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead><tbody>${items.map(i=>`<tr><td><strong>${esc(i.product_name)}</strong>${(i.order_item_units||[]).length?`<div class="unit-list">${i.order_item_units.map((u,x)=>`Unit ${x+1}: IMEI ${esc(u.imei1)}${u.imei2?` · IMEI 2 ${esc(u.imei2)}`:''}${u.serial_number?` · SN ${esc(u.serial_number)}`:''}`).join('<br>')}</div>`:'<div class="unit-list">IMEI belum ditetapkan</div>'}</td><td>${esc(i.variant_name||'-')}<br><span class="unit-list">${esc(i.color||'-')} · RAM ${esc(i.ram||'-')} · ${esc(i.storage||'-')}</span></td><td class="num">${Number(i.quantity||0)}</td><td class="num">${rupiah(i.unit_price)}</td><td class="num"><strong>${rupiah(i.subtotal)}</strong></td></tr>`).join('')}</tbody></table></div></section>
 <div class="summary"><div class="sum-row"><span>Subtotal Produk</span><strong>${rupiah(o.subtotal)}</strong></div><div class="sum-row"><span>Diskon</span><strong>- ${rupiah(o.discount)}</strong></div><div class="sum-row"><span>Ongkir</span><strong>${rupiah(o.shipping_fee)}</strong></div><div class="sum-row total"><span>Total Pesanan</span><strong>${rupiah(o.total)}</strong></div><div class="sum-row paid"><span>Sudah Dibayar</span><strong>${rupiah(o.amount_paid)}</strong></div><div class="sum-row remaining"><span>Sisa Pembayaran</span><strong>${rupiah(o.remaining_amount)}</strong></div></div>
 ${allUnits.length < items.reduce((n,i)=>n+Number(i.quantity||0),0) ? '<div class="notice">Catatan admin: sebagian unit/IMEI belum ditetapkan. Nota dapat dicetak ulang setelah penetapan unit selesai.</div>' : ''}
 <footer class="foot"><div><strong>CEO Part & Service</strong><br>Dokumen dibuat dari sistem penjualan CEO.</div><div>Invoice: ${esc(o.order_number||o.id)}<br>Status pembayaran: ${esc(label(o.payment_status))}</div></footer>`;
}
function showError(msg){$("loading").textContent=msg; $("pdfBtn").disabled=true}
async function downloadPDF(){
 if(!currentOrder) return;
 const {jsPDF}=window.jspdf; const o=currentOrder, items=o.order_items||[], ship=latest(o.order_shipments);
 const doc=new jsPDF({unit:"mm",format:"a4"}); let y=18;
 doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("CEO PART & SERVICE",14,y);doc.setFontSize(10);doc.setFont("helvetica","normal");doc.text("Nota Penjualan Handphone",14,y+6);
 doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text("INVOICE",196,y,{align:"right"});doc.setFontSize(9);doc.text(String(o.order_number||`ORDER-${o.id}`),196,y+6,{align:"right"});
 y+=18; doc.setDrawColor(31,111,120);doc.setLineWidth(.8);doc.line(14,y,196,y); y+=8;
 doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text(`Pembeli: ${o.customer_name||'-'}`,14,y);doc.text(`WhatsApp: ${o.customer_whatsapp||'-'}`,14,y+5);doc.text(`Pengiriman: ${shippingName(o,ship)}`,110,y);doc.text(`Pembayaran: ${label(o.payment_method)} / ${label(o.payment_status)}`,110,y+5); y+=14;
 const rows=[]; items.forEach(i=>{ const units=(i.order_item_units||[]).map((u,x)=>`Unit ${x+1}: IMEI ${u.imei1}${u.imei2?` / ${u.imei2}`:''}${u.serial_number?` / SN ${u.serial_number}`:''}`).join("\n") || "IMEI belum ditetapkan"; rows.push([`${i.product_name}\n${units}`,`${i.variant_name||'-'}\n${i.color||'-'} · RAM ${i.ram||'-'} · ${i.storage||'-'}`,String(i.quantity||0),rupiah(i.unit_price),rupiah(i.subtotal)]); });
 doc.autoTable({startY:y,head:[["Produk / Unit","Varian","Qty","Harga","Subtotal"]],body:rows,styles:{fontSize:7,cellPadding:2.2},headStyles:{fillColor:[31,111,120]},columnStyles:{2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}}});
 y=doc.lastAutoTable.finalY+7; const x=112; doc.setFontSize(9); [["Subtotal",o.subtotal],["Diskon",-Number(o.discount||0)],["Ongkir",o.shipping_fee],["TOTAL",o.total],["Sudah Dibayar",o.amount_paid],["Sisa",o.remaining_amount]].forEach(([k,v],idx)=>{doc.setFont("helvetica",idx===3?"bold":"normal");doc.text(String(k),x,y);doc.text(rupiah(v),196,y,{align:"right"});y+=5;});
 doc.setFontSize(7);doc.setTextColor(100);doc.text(`Dibuat ${new Date().toLocaleString('id-ID')} · CEO Part & Service`,14,287);
 doc.save(`${o.order_number||`order-${o.id}`}.pdf`);
}
document.addEventListener("DOMContentLoaded",init);
