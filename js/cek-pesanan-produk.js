"use strict";

const c = window.supabaseClient;
const $ = id => document.getElementById(id);
const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = v => String(v ?? "").replace(/[&<>"']/g, x => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[x]));

const L = {
  menunggu_diproses:"Menunggu",
  menunggu:"Menunggu",
  diproses:"Diproses",
  dikemas:"Dikemas",
  dikirim:"Dikirim",
  dalam_perjalanan:"Dalam Perjalanan",
  selesai:"Selesai",
  dibatalkan:"Batal",
  batal:"Batal",
  belum_bayar:"Belum Bayar",
  sebagian:"Sebagian",
  lunas:"Lunas",
  pickup:"Ambil di Toko",
  instant:"Kurir Instan",
  package:"Kirim Paket",
  cod:"COD Lokal",
  cash:"Cash / Tunai",
  tunai:"Cash / Tunai",
  transfer:"Transfer"
};

const lab = v => L[v] || String(v || "-").replaceAll("_"," ");
const dateID = v => {
  if (!v) return "-";
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString("id-ID", {
    day:"2-digit", month:"long", year:"numeric"
  });
};
const normStatus = v => v === "menunggu" ? "menunggu_diproses" : v === "batal" ? "dibatalkan" : v;

function warrantyState(endDate){
  if(!endDate) return {text:"Belum ditentukan", cls:"neutral"};
  const end = new Date(`${String(endDate).slice(0,10)}T23:59:59`);
  const now = new Date();
  if(Number.isNaN(end.getTime())) return {text:"-", cls:"neutral"};
  if(end >= now){
    const days = Math.max(0, Math.ceil((end-now)/86400000));
    return {text: days === 0 ? "Aktif · berakhir hari ini" : `Aktif · ${days} hari lagi`, cls:"active"};
  }
  return {text:"Masa garansi berakhir", cls:"expired"};
}

function warrantyTitle(w){
  const raw = String(w?.warranty_name || w?.warranty_type || "Garansi");
  const low = raw.toLowerCase();
  if(low.includes("tukar")) return "Garansi Tukar Unit";
  if(low.includes("service") || low.includes("servis")) return "Garansi Service";
  return raw;
}

function warrantyUnit(w, items){
  const imei = w?.imei || w?.imei_number || w?.serial_number || w?.serial || "";
  const item = items.find(i =>
    (w?.order_item_id && String(i.id) === String(w.order_item_id)) ||
    (w?.product_id && String(i.product_id) === String(w.product_id))
  );
  return {imei, item};
}

document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search).get("order");
  if(q) $("orderNumber").value = q;
  $("checkBtn").onclick = check;
  ["orderNumber","phone"].forEach(id => {
    $(id)?.addEventListener("keydown", e => {
      if(e.key === "Enter") check();
    });
  });
});

async function check(){
  const no = $("orderNumber").value.trim();
  const ph = $("phone").value.trim();
  if(!no || !ph) return msg("Nomor pesanan dan WhatsApp wajib diisi.");

  if(!c) return msg("Koneksi sistem belum tersedia. Silakan muat ulang halaman.");

  const b = $("checkBtn");
  const old = b.innerHTML;
  b.disabled = true;
  b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...';

  try{
    const {data,error} = await c.rpc("public_track_product_order", {
      p_order_number:no,
      p_customer_whatsapp:ph
    });
    if(error) throw error;
    if(!data?.success) throw Error(data?.message || "Pesanan tidak ditemukan.");
    render(data);
  }catch(e){
    console.error(e);
    msg(e.message || "Gagal mengambil data pesanan.");
  }finally{
    b.disabled = false;
    b.innerHTML = old;
  }
}

function msg(t){
  $("alert").hidden = false;
  $("alert").textContent = t;
  $("result").hidden = true;
}

function render(d){
  $("alert").hidden = true;

  const o = d.order || {};
  const s = d.shipping || {};
  const w = Array.isArray(d.warranties) ? d.warranties : [];
  const it = Array.isArray(d.items) ? d.items : [];
  const status = normStatus(o.order_status);

  const steps = [
    "menunggu_diproses","diproses","dikemas",
    "dikirim","dalam_perjalanan","selesai"
  ];
  const cur = steps.indexOf(status);
  const cancelled = status === "dibatalkan";

  const invoiceUrl = `nota-produk.html?id=${encodeURIComponent(o.id || "")}`;

  const productRows = it.length ? it.map(x => {
    const imei = x.imei || x.imei_number || x.serial_number || x.serial || "";
    const variant = [x.variant_name, x.ram, x.storage, x.color].filter(Boolean).join(" · ");
    return `<div class="product-row">
      <div class="product-main">
        <b>${esc(x.product_name || "Produk")}</b>
        ${variant ? `<small>${esc(variant)}</small>` : ""}
        ${imei ? `<small class="imei"><i class="fa-solid fa-barcode"></i> IMEI/Serial: ${esc(imei)}</small>` : ""}
      </div>
      <div class="product-price">
        <small>${Number(x.quantity || 1)} × ${rp(x.unit_price)}</small>
        <b>${rp(Number(x.unit_price || 0) * Number(x.quantity || 1))}</b>
      </div>
    </div>`;
  }).join("") : '<span class="muted">Detail produk tidak tersedia.</span>';

  const warrantyRows = w.length ? w.map(x => {
    const st = warrantyState(x.end_date);
    const unit = warrantyUnit(x,it);
    const imei = unit.imei || unit.item?.imei || unit.item?.imei_number || unit.item?.serial_number || "";
    return `<div class="warranty-item">
      <div class="warranty-icon"><i class="fa-solid fa-shield-halved"></i></div>
      <div class="warranty-info">
        <div class="warranty-top">
          <b>${esc(warrantyTitle(x))}</b>
          <span class="warranty-status ${st.cls}">${esc(st.text)}</span>
        </div>
        ${unit.item?.product_name ? `<small>${esc(unit.item.product_name)}</small>` : ""}
        ${imei ? `<small><i class="fa-solid fa-barcode"></i> IMEI/Serial: ${esc(imei)}</small>` : ""}
        <div class="warranty-dates">
          <span><small>Mulai</small><b>${dateID(x.start_date)}</b></span>
          <i class="fa-solid fa-arrow-right"></i>
          <span><small>Berakhir</small><b>${dateID(x.end_date)}</b></span>
        </div>
      </div>
    </div>`;
  }).join("") : `<div class="warranty-empty">
    <i class="fa-solid fa-shield"></i>
    <div><b>Garansi belum diatur</b><small>Informasi garansi akan tampil setelah admin menetapkannya pada pesanan.</small></div>
  </div>`;

  const due = o.due_date ? `<p><span>Jatuh Tempo</span><b>${dateID(o.due_date)}</b></p>` : "";
  const note = o.payment_note || o.notes || o.note || "";

  $("result").innerHTML = `
    <div class="head">
      <div>
        <small>NO. PESANAN</small>
        <h2>${esc(o.order_number)}</h2>
        <span class="order-date"><i class="fa-regular fa-calendar"></i> ${dateID(o.created_at)}</span>
      </div>
      <b class="${cancelled ? "cancelled" : ""}">${esc(lab(status))}</b>
    </div>

    ${cancelled ? `
      <div class="cancel-box">
        <i class="fa-solid fa-circle-xmark"></i>
        <div><b>Pesanan dibatalkan</b><span>Proses pesanan ini telah dihentikan.</span></div>
      </div>` : `
      <div class="timeline">
        ${steps.map((x,i) => `<div class="${i <= cur ? "on" : ""} ${i === cur ? "current" : ""}">
          <span>${i < cur ? '<i class="fa-solid fa-check"></i>' : i+1}</span>
          <small>${lab(x)}</small>
        </div>`).join("")}
      </div>`}

    <div class="summary-strip">
      <div><small>Total Pesanan</small><b>${rp(o.total)}</b></div>
      <div><small>Status Pembayaran</small><b>${esc(lab(o.payment_status))}</b></div>
      <div><small>Metode Pengiriman</small><b>${esc(lab(o.shipping_method))}</b></div>
    </div>

    <div class="cards">
      <article class="wide">
        <div class="section-title"><i class="fa-solid fa-mobile-screen-button"></i><h3>Detail Produk</h3></div>
        ${productRows}
      </article>

      <article>
        <div class="section-title"><i class="fa-solid fa-wallet"></i><h3>Pembayaran</h3></div>
        <p><span>Metode</span><b>${esc(lab(o.payment_method || "-"))}</b></p>
        <p><span>Total Tagihan</span><b>${rp(o.total)}</b></p>
        <p><span>Sudah Dibayar</span><b>${rp(o.amount_paid)}</b></p>
        <p class="remaining"><span>Sisa Tagihan</span><b>${rp(o.remaining_amount)}</b></p>
        ${due}
        <p><span>Status</span><b class="pay-status">${esc(lab(o.payment_status))}</b></p>
        ${note ? `<div class="note"><b>Catatan</b><span>${esc(note)}</span></div>` : ""}
      </article>

      <article>
        <div class="section-title"><i class="fa-solid fa-truck-fast"></i><h3>Pengiriman</h3></div>
        <p><span>Metode</span><b>${esc(lab(o.shipping_method))}</b></p>
        <p><span>Jasa Pengiriman</span><b>${esc(s.courier || o.shipping_provider || "-")}</b></p>
        <p><span>No. Resi / Kode</span><b class="tracking">${esc(s.tracking_number || "-")}</b></p>
        ${o.shipping_cost != null ? `<p><span>Biaya Pengiriman</span><b>${rp(o.shipping_cost)}</b></p>` : ""}
      </article>

      <article class="wide warranty-card">
        <div class="section-title">
          <i class="fa-solid fa-shield-halved"></i>
          <div><h3>Garansi Produk</h3><small>Garansi Tukar Unit & Garansi Service</small></div>
        </div>
        <div class="warranty-list">${warrantyRows}</div>
        <div class="claim">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <b>Informasi Klaim Garansi</b>
            <span>Simpan invoice dan nomor pesanan. Saat mengajukan klaim, sertakan nama pembeli, WhatsApp, IMEI/serial unit bila tersedia, penjelasan kendala, serta foto/video kondisi produk. Klaim akan diverifikasi berdasarkan masa dan ketentuan garansi.</span>
          </div>
        </div>
      </article>
    </div>

    <div class="result-actions">
      <a class="invoice-btn" href="${invoiceUrl}" target="_blank" rel="noopener">
        <i class="fa-solid fa-file-invoice"></i> Lihat Invoice
      </a>
      <button type="button" class="check-again" id="checkAgain">
        <i class="fa-solid fa-rotate"></i> Cek Pesanan Lain
      </button>
    </div>
  `;

  $("result").hidden = false;
  $("checkAgain")?.addEventListener("click", () => {
    $("result").hidden = true;
    $("orderNumber").focus();
    window.scrollTo({top:0,behavior:"smooth"});
  });
  $("result").scrollIntoView({behavior:"smooth", block:"start"});
}
