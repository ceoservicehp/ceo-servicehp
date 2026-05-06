function drawHeader(pdf){

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(22);

  pdf.setTextColor(20,120,120);

  pdf.text("CEO PART & SERVICE", 20, 20);

  pdf.setFontSize(10);

  pdf.setTextColor(90);

  pdf.text("Cellular Engineering Officer", 20, 27);

  pdf.text("ITC Roxy Mas LT.1 No.123 B", 20, 33);

  pdf.text(
    "Jl. KH. Hasyim Ashari No.125, Jakarta Pusat",
    20,
    39
  );

  pdf.setDrawColor(225);

  pdf.line(20, 45, 190, 45);

  return 55;
}

/* ================= DOWNLOAD PDF ================= */

function loadImage(url){
  return new Promise((resolve,reject)=>{

    const img = new Image();

    img.crossOrigin = "Anonymous";

    img.onload = ()=>resolve(img);

    img.onerror = reject;

    img.src = url;
  });
}

async function downloadPDF(){

  if(!currentData) return;

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  let cursorY = 20;

  // ================= HEADER =================

  cursorY = drawHeader(pdf);

  // ================= HELPER =================

  function drawBox(x, y, w, h){

    pdf.setDrawColor(230);
    pdf.setFillColor(250,252,253);

    pdf.roundedRect(
      x,
      y,
      w,
      h,
      4,
      4,
      "FD"
    );
  }

  function formatRupiah(value){
    return "Rp " + Number(value || 0).toLocaleString("id-ID");
  }

 // ================= WATERMARK =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(42);

pdf.setGState(
  new pdf.GState({opacity:0.05})
);

if(
  (currentData.payment_status || "")
  .toLowerCase()
  .includes("lunas")
){

  pdf.setTextColor(0,150,0);

  pdf.text(
    "LUNAS",
    105,
    175,
    {
      align:"center",
      angle:-25
    }
  );

}else{

  pdf.setTextColor(220,0,0);

  pdf.text(
    "BELUM LUNAS",
    105,
    175,
    {
      align:"center",
      angle:-25
    }
  );

}

pdf.setGState(
  new pdf.GState({opacity:1})
);

pdf.setTextColor(40);
  
  // ================= INVOICE INFO =================

  drawBox(145, 14, 45, 22);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(40);

  pdf.text(
    "INV-"+String(currentData.id).padStart(5,"0"),
    152,
    24
  );

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(9);

  pdf.setTextColor(100);

  pdf.text(
    new Date(currentData.created_at)
      .toLocaleString("id-ID"),
    152,
    31
  );

// ================= CUSTOMER & SERVICE =================

cursorY += 6;

const cardGap = 8;
const leftCardX = 15;
const rightCardX = 105;

const cardY = cursorY;

const leftCardW = 82;
const rightCardW = 85;

const cardH = 68;

// card kiri
drawBox(
  leftCardX,
  cardY,
  leftCardW,
  cardH
);

// card kanan
drawBox(
  rightCardX,
  cardY,
  rightCardW,
  cardH
);

// ================= DATA PELANGGAN =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);

pdf.setTextColor(31,111,120);

pdf.text(
  "Data Pelanggan",
  leftCardX + 5,
  cardY + 10
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

pdf.setTextColor(70);

let customerY = cardY + 20;

function drawInfoRow(label,value,y){

  pdf.setTextColor(120);

  pdf.text(label, leftCardX + 5, y);

  pdf.setTextColor(40);

  pdf.text(
    value || "-",
    leftCardX + 32,
    y
  );

}

drawInfoRow(
  "Nama",
  currentData.nama,
  customerY
);

customerY += 8;

drawInfoRow(
  "No HP",
  currentData.phone,
  customerY
);

customerY += 8;

drawInfoRow(
  "Merk HP",
  currentData.brand,
  customerY
);

customerY += 8;

drawInfoRow(
  "Metode",
  currentData.metode,
  customerY
);

// detail kerusakan
customerY += 12;

pdf.setFont("helvetica","bold");

pdf.setTextColor(31,111,120);

pdf.text(
  "Detail Kerusakan",
  leftCardX + 5,
  customerY
);

customerY += 7;

pdf.setFont("helvetica","normal");
pdf.setFontSize(8);

pdf.setTextColor(80);

const problem = pdf.splitTextToSize(
  currentData.problem || "-",
  62
);

pdf.text(
  problem,
  leftCardX + 5,
  customerY
);

// ================= INFORMASI SERVICE =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);

pdf.setTextColor(31,111,120);

pdf.text(
  "Informasi Service",
  rightCardX + 5,
  cardY + 10
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

let serviceY = cardY + 20;

function drawServiceRow(label,value,y){

  pdf.setTextColor(120);

  pdf.text(label, rightCardX + 5, y);

  pdf.setTextColor(40);

  pdf.text(
    value || "-",
    rightCardX + 35,
    y
  );

}

drawServiceRow(
  "Status",
  currentData.status,
  serviceY
);

serviceY += 8;

drawServiceRow(
  "Tgl Masuk",
  new Date(currentData.created_at)
    .toLocaleDateString("id-ID"),
  serviceY
);

serviceY += 8;

drawServiceRow(
  "Tgl Selesai",
  currentData.finished_at
    ? new Date(currentData.finished_at)
        .toLocaleDateString("id-ID")
    : "-",
  serviceY
);

serviceY += 8;

// payment label
pdf.setTextColor(120);

pdf.text(
  "Status Bayar",
  rightCardX + 5,
  serviceY
);

// badge
const isPaid =
  (currentData.payment_status || "")
  .toLowerCase()
  .includes("lunas");

if(isPaid){

  pdf.setFillColor(40,167,69);

}else{

  pdf.setFillColor(220,53,69);

}

pdf.roundedRect(
  rightCardX + 35,
  serviceY - 5,
  30,
  7,
  3,
  3,
  "F"
);

pdf.setFontSize(7);

pdf.setTextColor(255);

pdf.text(
  isPaid ? "LUNAS" : "BELUM",
  rightCardX + 50,
  serviceY,
  {align:"center"}
);

// update cursor
cursorY += cardH + 18;
  
// ================= TABLE =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);

pdf.setTextColor(20,120,120);

pdf.text(
  "Detail Jenis Perbaikan / Sparepart",
  20,
  cursorY
);

let body = [];
let subtotal = 0;

if(currentData.sparepart){

  try{

    const items = JSON.parse(currentData.sparepart);

    items.forEach(item=>{

      const harga = item.harga || 0;
      const qty = item.qty || 0;

      subtotal += harga * qty;

      body.push([
        item.nama || "-",
        qty,
        formatRupiah(harga)
      ]);

    });

  }catch(e){}
}

pdf.autoTable({

  startY: cursorY + 6,

  margin:{
    left:20,
    right:20
  },

  head:[[
    "Jenis Perbaikan / Sparepart",
    "Qty",
    "Harga"
  ]],

  body: body,

  theme: "plain",

  styles:{
    fontSize:9,
    cellPadding:3.5,
    textColor:[60,60,60]
  },

  headStyles:{
    fillColor:[235,245,247],
    textColor:[40,40,40],
    fontStyle:"bold"
  },

  alternateRowStyles:{
    fillColor:[250,250,250]
  }

});

// ================= TABLE BORDER =================

pdf.setDrawColor(230);

pdf.roundedRect(
  15,
  cursorY - 10,
  175,
  (pdf.lastAutoTable.finalY - (cursorY - 10)) + 8,
  4,
  4
);

// ================= TOTAL =================

let finalY = pdf.lastAutoTable.finalY + 6;

const transport = Number(currentData.transport || 0);
const jasa = Number(currentData.jasa || 0);
const dibayar = Number(currentData.amount_paid || 0);

const grand =
  subtotal +
  transport +
  jasa;

const remaining = grand - dibayar;

// total card
drawBox(
  115,
  finalY,
  70,
  32
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(8);

pdf.setTextColor(110);

pdf.text(
  "Subtotal",
  120,
  finalY + 6
);

pdf.text(
  formatRupiah(subtotal),
  176,
  finalY + 6,
  {align:"right"}
);

pdf.text(
  "Transport",
  120,
  finalY + 12
);

pdf.text(
  formatRupiah(transport),
  176,
  finalY + 12,
  {align:"right"}
);

pdf.text(
  "Jasa",
  120,
  finalY + 18
);

pdf.text(
  formatRupiah(jasa),
  176,
  finalY + 18,
  {align:"right"}
);

// line
pdf.setDrawColor(225);

pdf.line(
  120,
  finalY + 21,
  176,
  finalY + 21
);

// total
pdf.setFont("helvetica","bold");
pdf.setFontSize(15);

pdf.setTextColor(20,120,120);

pdf.text(
  "TOTAL",
  120,
  finalY + 30
);

pdf.text(
  formatRupiah(grand),
  176,
  finalY + 30,
  {align:"right"}
);
  
// ================= GARANSI =================

let garansiY = finalY + 28;

drawBox(
  15,
  garansiY - 7,
  175,
  24
);

pdf.setFont("helvetica","bold");
pdf.setFontSize(11);

pdf.setTextColor(20,120,120);

pdf.text(
  "Masa Garansi",
  20,
  garansiY
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

pdf.setTextColor(70);

if(currentData.garansi){

  pdf.text(
    "Berlaku sampai: " +
    new Date(currentData.garansi)
      .toLocaleDateString("id-ID"),
    20,
    garansiY + 7
  );

}else{

  pdf.text(
    "Menyesuaikan jenis perbaikan",
    20,
    garansiY + 7
  );

}

// ================= QR =================

const qrCanvas =
  document.querySelector("#qr canvas");

if(qrCanvas){

  const qrImage =
    qrCanvas.toDataURL("image/png");

  pdf.addImage(
    qrImage,
    "PNG",
    20,
    garansiY + 2,
    20,
    20
  );

  pdf.setFontSize(7);

  pdf.text(
    "Scan Verifikasi",
    20,
    garansiY + 24
  );

}

// ================= TTD =================

pdf.setFont("helvetica","normal");
pdf.setFontSize(9);

pdf.text(
  "Hormat Kami,",
  145,
  garansiY + 5
);

const sigBox =
  document.getElementById("ttdImg");

if(
  sigBox &&
  sigBox.style.backgroundImage
){

  const url = sigBox.style.backgroundImage
    .replace(/^url\(["']?/, '')
    .replace(/["']?\)$/, '');

  try{

    const img = await loadImage(url);

    pdf.addImage(
      img,
      "PNG",
      134,
      garansiY + 2,
      36,
      14
    );

  }catch(e){
    console.log("TTD gagal");
  }

}

pdf.setFont("helvetica","bold");

pdf.text(
  document.getElementById("ttdName")
    .textContent,
  152,
  garansiY + 20,
  {align:"center"}
);

// ================= SYARAT GARANSI =================

let syaratY = garansiY + 26;

drawBox(
  15,
  syaratY - 5,
  175,
  20
);

pdf.setFont("helvetica","bold");
pdf.setFontSize(10);

pdf.setTextColor(20,120,120);

pdf.text(
  "Syarat & Ketentuan Garansi",
  20,
  syaratY
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(7.5);

pdf.setTextColor(90);

const syarat = [
  "• Garansi hanya berlaku sesuai jenis perbaikan.",
  "• Garansi batal jika unit terkena air / benturan.",
  "• Segel rusak membatalkan garansi.",
  "• Nota wajib dibawa saat klaim garansi."
];

pdf.text(
  syarat,
  20,
  syaratY + 6
);

// ================= FOOTER =================

pdf.setFont("helvetica","normal");

pdf.setFontSize(7);

pdf.setTextColor(140);

pdf.text(
  "Terima kasih telah menggunakan layanan CEO PART & SERVICE",
  105,
  280,
  {align:"center"}
);
  
  // ================= SAVE =================

  pdf.save(`Invoice_${currentData.id}.pdf`);
}
