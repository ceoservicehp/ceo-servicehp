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

  // ================= CUSTOMER & SERVICE SECTION =================

cursorY += 5;

// box kiri
drawBox(15, cursorY, 82, 62);

// box kanan
drawBox(103, cursorY, 87, 62);

// ================= DATA PELANGGAN =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);

pdf.setTextColor(20,120,120);

pdf.text("Data Pelanggan", 20, cursorY + 10);

pdf.setFont("helvetica","normal");
pdf.setFontSize(10);

pdf.setTextColor(70);

let leftY = cursorY + 22;

pdf.text(
  `Nama : ${currentData.nama || "-"}`,
  20,
  leftY
);

leftY += 9;

pdf.text(
  `No HP : ${currentData.phone || "-"}`,
  20,
  leftY
);

leftY += 9;

pdf.text(
  `Merk HP : ${currentData.brand || "-"}`,
  20,
  leftY
);

leftY += 9;

pdf.text(
  `Metode : ${currentData.metode || "-"}`,
  20,
  leftY
);

// detail kerusakan
leftY += 14;

pdf.setFont("helvetica","bold");

pdf.setTextColor(40);

pdf.text(
  "Detail Kerusakan",
  20,
  leftY
);

leftY += 7;

pdf.setFont("helvetica","normal");

pdf.setTextColor(90);

const problem = pdf.splitTextToSize(
  currentData.problem || "-",
  68
);

pdf.text(
  problem,
  20,
  leftY
);

// ================= SERVICE =================

pdf.setFont("helvetica","bold");
pdf.setFontSize(13);

pdf.setTextColor(20,120,120);

pdf.text(
  "Informasi Service",
  108,
  cursorY + 10
);

pdf.setFont("helvetica","normal");
pdf.setFontSize(10);

pdf.setTextColor(70);

let rightY = cursorY + 22;

pdf.text(
  `Status : ${currentData.status || "-"}`,
  108,
  rightY
);

rightY += 9;

pdf.text(
  `Tgl Masuk : ${
    new Date(currentData.created_at)
      .toLocaleDateString("id-ID")
  }`,
  108,
  rightY
);

rightY += 9;

pdf.text(
  `Tgl Selesai : ${
    currentData.finished_at
    ? new Date(currentData.finished_at)
        .toLocaleDateString("id-ID")
    : "-"
  }`,
  108,
  rightY
);

rightY += 9;

pdf.text(
  `Status Bayar : ${
    currentData.payment_status || "Belum Lunas"
  }`,
  108,
  rightY
);

// badge status
rightY += 10;

if(
  (currentData.payment_status || "")
  .toLowerCase()
  .includes("lunas")
){

  pdf.setFillColor(220,255,230);

}else{

  pdf.setFillColor(255,230,230);

}

pdf.roundedRect(
  108,
  rightY - 6,
  42,
  8,
  2,
  2,
  "F"
);

pdf.setFontSize(9);

pdf.setTextColor(40);

pdf.text(
  currentData.payment_status || "Belum Lunas",
  129,
  rightY,
  {align:"center"}
);

// update cursor
cursorY += 78;
  
  // ================= TABLE =================
  pdf.setFont("helvetica","bold");
  pdf.setFontSize(13);

  pdf.setTextColor(20,120,120);

  pdf.text(
    "Detail Jenis Perbaikan / Sparepart",
    20,
    141
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

    startY: 148,

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
      fontSize:10,
      cellPadding:4,
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
    130,
    175,
    (pdf.lastAutoTable.finalY - 130) + 10,
    4,
    4
  );
  
  // ================= TOTAL =================

  let finalY = pdf.lastAutoTable.finalY + 15;

  const transport = Number(currentData.transport || 0);
  const jasa = Number(currentData.jasa || 0);
  const dibayar = Number(currentData.amount_paid || 0);

  const grand =
    subtotal +
    transport +
    jasa;

  const remaining = grand - dibayar;

  drawBox(118, finalY - 6, 67, 38);

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.setTextColor(90);

  pdf.text("Subtotal", 118, finalY + 4);
  pdf.text(formatRupiah(subtotal), 165, finalY + 4, {align:"right"});

  pdf.text("Transport", 118, finalY + 12);
  pdf.text(formatRupiah(transport), 165, finalY + 12, {align:"right"});

  pdf.text("Jasa", 118, finalY + 20);
  pdf.text(formatRupiah(jasa), 165, finalY + 20, {align:"right"});

  pdf.setDrawColor(220);
  pdf.line(118, finalY + 24, 182, finalY + 24);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(14);

  pdf.setTextColor(20,120,120);

  pdf.text("TOTAL", 118, finalY + 33);

  pdf.text(
    formatRupiah(grand),
    182,
    finalY + 33,
    {align:"right"}
  );

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(9);

  pdf.setTextColor(100);

  if(remaining > 0){

    pdf.text(
      "Kurang Bayar : " + formatRupiah(remaining),
      118,
      finalY + 40
    );

  }else if(remaining < 0){

    pdf.text(
      "Kembalian : " + formatRupiah(Math.abs(remaining)),
      118,
      finalY + 40
    );

  }else{

    pdf.text(
      "Pembayaran Lunas",
      118,
      finalY + 40
    );

  }

  // ================= GARANSI =================

  let garansiY = finalY + 50;

  drawBox(15, garansiY - 10, 175, 28);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(12);

  pdf.setTextColor(20,120,120);

  pdf.text("Masa Garansi", 20, garansiY);

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.setTextColor(70);

  if(currentData.garansi){

    pdf.text(
      "Berlaku sampai: " +
      new Date(currentData.garansi)
        .toLocaleDateString("id-ID"),
      20,
      garansiY + 10
    );

  }else{

    pdf.text(
      "Menyesuaikan jenis perbaikan",
      20,
      garansiY + 10
    );

  }

  // ================= QR =================

  const qrCanvas = document.querySelector("#qr canvas");

  if(qrCanvas){

    const qrImage = qrCanvas.toDataURL("image/png");

    pdf.addImage(
      qrImage,
      "PNG",
      20,
      garansiY + 20,
      26,
      26
    );

    pdf.setFontSize(9);

    pdf.text(
      "Scan untuk Verifikasi",
      20,
      garansiY + 43
    );

  }

  // ================= TTD =================

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(10);

  pdf.text(
    "Hormat Kami,",
    145,
    garansiY + 28
  );

  const sigBox = document.getElementById("ttdImg");

  if(sigBox && sigBox.style.backgroundImage){

    const url = sigBox.style.backgroundImage
      .replace(/^url\(["']?/, '')
      .replace(/["']?\)$/, '');

    try{

      const img = await loadImage(url);

      pdf.addImage(
        img,
        "PNG",
        135,
        garansiY + 24,
        40,
        18
      );

    }catch(e){
      console.log("TTD gagal");
    }

  }

  pdf.setFont("helvetica","bold");

  pdf.text(
    document.getElementById("ttdName").textContent,
    155,
    garansiY + 48,
    {align:"center"}
  );

  // ================= SYARAT GARANSI =================

  let syaratY = garansiY + 50;

  drawBox(15, syaratY - 8, 175, 24);

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(11);

  pdf.setTextColor(20,120,120);

  pdf.text(
    "Syarat & Ketentuan Garansi",
    20,
    syaratY
  );

  pdf.setFont("helvetica","normal");
  pdf.setFontSize(9);

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
    syaratY + 10
  );

  // ================= FOOTER =================

  pdf.setFont("helvetica","normal");

  pdf.setFontSize(8);

  pdf.setTextColor(140);

  pdf.text(
    "Terima kasih telah menggunakan layanan CEO PART & SERVICE",
    105,
    290,
    {align:"center"}
  );
  
  // ================= SAVE =================

  pdf.save(`Invoice_${currentData.id}.pdf`);
}
