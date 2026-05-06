/* =====================================================================
 * INVOICE PDF GENERATOR — CEO PART & SERVICE
 * ---------------------------------------------------------------------
 * Dibutuhkan (sudah ada di nota.html):
 *   - jsPDF UMD          (window.jspdf.jsPDF)
 *   - jsPDF AutoTable    (pdf.autoTable)
 *   - QRCode (canvas di #qr)
 *
 * Fungsi utama yang dipanggil dari tombol Download:  downloadPDF()
 * ===================================================================== */
"use strict";

/* ================= COLOR PALETTE ================= */
const PDF_COLORS = {
  primary:      [31, 111, 120],   // teal brand
  primaryDark:  [20, 80, 88],
  primaryLight: [0, 194, 199],
  accentSoft:   [235, 245, 247],
  text:         [40, 40, 40],
  textMid:      [110, 110, 110],
  textSoft:     [160, 160, 160],
  border:       [225, 232, 235],
  bgSoft:       [249, 251, 252],
  white:        [255, 255, 255],
  success:      [40, 167, 69],
  danger:       [220, 53, 69],
  warnBg:       [253, 248, 235],
  warnBorder:   [240, 220, 180]
};

/* ================= PAGE GEOMETRY ================= */
const PDF_PAGE = {
  width:    210,
  height:   297,
  margin:   15,
  contentW: 180,
  footerY:  282
};

/* ================= UTILITIES ================= */
function pdfLoadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function pdfRupiah(value) {
  return "Rp " + Number(value || 0).toLocaleString("id-ID");
}

function pdfFormatDate(value, withTime = false) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  if (withTime) {
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric"
  });
}

function pdfSetFill(pdf, rgb)  { pdf.setFillColor(rgb[0], rgb[1], rgb[2]); }
function pdfSetDraw(pdf, rgb)  { pdf.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function pdfSetText(pdf, rgb)  { pdf.setTextColor(rgb[0], rgb[1], rgb[2]); }

function pdfDrawCard(pdf, x, y, w, h, opts = {}) {
  const {
    fill   = PDF_COLORS.bgSoft,
    border = PDF_COLORS.border,
    radius = 3,
    lineW  = 0.2
  } = opts;
  pdfSetFill(pdf, fill);
  pdfSetDraw(pdf, border);
  pdf.setLineWidth(lineW);
  pdf.roundedRect(x, y, w, h, radius, radius, "FD");
}

function pdfAccentBar(pdf, x, y, h = 6, w = 1.6) {
  pdfSetFill(pdf, PDF_COLORS.primary);
  pdf.rect(x, y, w, h, "F");
}

/* ================= HEADER ================= */
function pdfDrawHeader(pdf, data) {
  const m = PDF_PAGE.margin;

  // ----- Brand block -----
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdfSetText(pdf, PDF_COLORS.primary);
  pdf.text("CEO PART & SERVICE", m, 22);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8.5);
  pdfSetText(pdf, PDF_COLORS.primaryLight);
  pdf.text("Cellular Engineering Officer", m, 27.2);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdfSetText(pdf, PDF_COLORS.textMid);
  pdf.text("ITC Roxy Mas Lt.1 No.123 B", m, 32.2);
  pdf.text("Jl. KH. Hasyim Ashari No.125, Jakarta Pusat 10150", m, 36.2);

  // ----- Invoice badge (kanan) -----
  const boxX = 142, boxY = 14, boxW = 53, boxH = 26;
  pdfSetFill(pdf, PDF_COLORS.primary);
  pdf.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "F");

  // Aksen highlight
  pdfSetFill(pdf, PDF_COLORS.primaryLight);
  pdf.roundedRect(boxX, boxY, boxW, 5, 3, 3, "F");
  pdf.rect(boxX, boxY + 2, boxW, 3, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdfSetText(pdf, PDF_COLORS.white);
  pdf.text("INVOICE", boxX + boxW / 2, boxY + 4, { align: "center" });

  pdf.setFontSize(13);
  pdf.text(
    "INV-" + String(data.id).padStart(5, "0"),
    boxX + boxW / 2, boxY + 13,
    { align: "center" }
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(
    pdfFormatDate(data.created_at, true),
    boxX + boxW / 2, boxY + 21,
    { align: "center" }
  );

  // ----- Divider dengan aksen ganda -----
  pdfSetDraw(pdf, PDF_COLORS.primary);
  pdf.setLineWidth(0.6);
  pdf.line(m, 44, PDF_PAGE.width - m, 44);
  pdfSetDraw(pdf, PDF_COLORS.primaryLight);
  pdf.setLineWidth(0.3);
  pdf.line(m, 45.2, PDF_PAGE.width - m, 45.2);

  return 52;
}

/* ================= INFO CARDS (Customer + Service) ================= */
function pdfDrawInfoCards(pdf, y, data, isPaid) {
  const m = PDF_PAGE.margin;
  const gap = 6;
  const cardW = (PDF_PAGE.contentW - gap) / 2;
  const cardH = 70;
  const leftX = m;
  const rightX = m + cardW + gap;

  pdfDrawCard(pdf, leftX, y, cardW, cardH);
  pdfDrawCard(pdf, rightX, y, cardW, cardH);

  // Card titles
  function cardTitle(x, title) {
    pdfAccentBar(pdf, x, y + 4.5, 6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdfSetText(pdf, PDF_COLORS.primary);
    pdf.text(title, x + 4.5, y + 9.5);
  }
  cardTitle(leftX,  "Data Pelanggan");
  cardTitle(rightX, "Informasi Service");

  // Garis pemisah halus di bawah judul card
  pdfSetDraw(pdf, PDF_COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.line(leftX + 4,  y + 12.5, leftX + cardW - 4,  y + 12.5);
  pdf.line(rightX + 4, y + 12.5, rightX + cardW - 4, y + 12.5);

  const padX = 4.5;
  const labelW = 22;

  function infoRow(x, label, value, yPos, valueColor = PDF_COLORS.text) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdfSetText(pdf, PDF_COLORS.textMid);
    pdf.text(label, x + padX, yPos);

    pdf.setFont("helvetica", "bold");
    pdfSetText(pdf, valueColor);
    const txt = pdf.splitTextToSize(
      value || "-",
      cardW - padX * 2 - labelW
    );
    pdf.text(txt, x + padX + labelW, yPos);
    return txt.length;
  }

  // ----- KIRI: Pelanggan -----
  let cy = y + 18;
  const custFields = [
    ["Nama",    data.nama],
    ["No HP",   data.phone],
    ["Alamat",  data.alamat],
    ["Merk HP", data.brand],
    ["Metode",  data.metode]
  ];
  custFields.forEach(([label, val]) => {
    const lines = infoRow(leftX, label, val, cy);
    cy += lines > 1 ? 4 + (lines * 3.4) : 7.2;
    if (cy > y + cardH - 4) return; // safety
  });

  // ----- KANAN: Service -----
  let sy = y + 18;
  infoRow(rightX, "Status",     data.status, sy); sy += 7.2;
  infoRow(rightX, "Tgl Masuk",  pdfFormatDate(data.created_at), sy); sy += 7.2;
  infoRow(rightX, "Tgl Selesai",
    data.tanggal_selesai ? pdfFormatDate(data.tanggal_selesai) : "-", sy);
  sy += 7.2;

  if (data.use_top && data.due_date) {
    infoRow(rightX, "Tempo",
      `${data.top_days || 0} hari (${pdfFormatDate(data.due_date)})`, sy);
    sy += 7.2;
  }

  if (data.garansi) {
    infoRow(rightX, "Garansi", pdfFormatDate(data.garansi), sy);
    sy += 7.2;
  }

  // Payment badge
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdfSetText(pdf, PDF_COLORS.textMid);
  pdf.text("Bayar", rightX + padX, sy);

  const badgeW = 32, badgeH = 6;
  const badgeX = rightX + padX + labelW;
  pdfSetFill(pdf, isPaid ? PDF_COLORS.success : PDF_COLORS.danger);
  pdf.roundedRect(badgeX, sy - 4.3, badgeW, badgeH, 1.5, 1.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdfSetText(pdf, PDF_COLORS.white);
  pdf.text(
    isPaid ? "LUNAS" : "BELUM LUNAS",
    badgeX + badgeW / 2, sy,
    { align: "center" }
  );

  return y + cardH + 6;
}

/* ================= PROBLEM BOX ================= */
function pdfDrawProblemBox(pdf, y, data) {
  const m = PDF_PAGE.margin;
  const w = PDF_PAGE.contentW;

  // Title
  pdfAccentBar(pdf, m, y - 1, 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdfSetText(pdf, PDF_COLORS.primary);
  pdf.text("Detail Kerusakan", m + 4, y + 3);

  // Body
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  const text = pdf.splitTextToSize(data.problem || "-", w - 8);
  const boxH = Math.max(11, text.length * 4.2 + 6);

  pdfDrawCard(pdf, m, y + 5, w, boxH, {
    fill: PDF_COLORS.bgSoft,
    border: PDF_COLORS.border
  });

  pdfSetText(pdf, PDF_COLORS.text);
  pdf.text(text, m + 4, y + 10);

  return y + 5 + boxH + 6;
}

/* ================= ITEMS TABLE ================= */
function pdfDrawItemsTable(pdf, y, data) {
  const m = PDF_PAGE.margin;

  pdfAccentBar(pdf, m, y - 1, 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdfSetText(pdf, PDF_COLORS.primary);
  pdf.text("Detail Jenis Perbaikan / Sparepart", m + 4, y + 3);

  let body = [];
  let subtotal = 0;

  if (data.sparepart) {
    try {
      const items = JSON.parse(data.sparepart);
      items.forEach((item, idx) => {
        const harga = Number(item.harga || 0);
        const qty   = Number(item.qty || 0);
        const total = harga * qty;
        subtotal += total;
        body.push([
          String(idx + 1),
          item.nama || "-",
          String(qty),
          pdfRupiah(harga),
          pdfRupiah(total)
        ]);
      });
    } catch (e) { /* abaikan parse error */ }
  }

  if (body.length === 0) {
    body.push(["-", "Tidak ada item", "-", "-", "-"]);
  }

  pdf.autoTable({
    startY: y + 6,
    margin: { left: m, right: m },
    head: [["#", "Jenis Perbaikan / Sparepart", "Qty", "Harga", "Total"]],
    body: body,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3.2,
      textColor: PDF_COLORS.text,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.1,
      valign: "middle"
    },
    headStyles: {
      fillColor: PDF_COLORS.primary,
      textColor: PDF_COLORS.white,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" }
    },
    alternateRowStyles: { fillColor: [248, 251, 252] },
    didDrawPage: () => {
      // pastikan watermark tidak menutupi konten saat page break
    }
  });

  return { finalY: pdf.lastAutoTable.finalY, subtotal };
}

/* ================= SUMMARY CARD ================= */
function pdfDrawSummary(pdf, y, data, subtotal) {
  const m = PDF_PAGE.margin;
  const transport = Number(data.transport || 0);
  const jasa      = Number(data.jasa || 0);
  const dibayar   = Number(data.amount_paid || 0);
  const grand     = subtotal + transport + jasa;
  const remaining = grand - dibayar;

  // Bangun rows dinamis
  const rows = [];
  rows.push({ label: "Subtotal", value: subtotal });
  if (transport > 0) rows.push({ label: "Transport", value: transport });
  if (jasa > 0)      rows.push({ label: "Jasa",      value: jasa });
  if (dibayar > 0)   rows.push({ label: "Dibayar",   value: dibayar });

  let extraRow = null;
  if (dibayar > 0 && remaining > 0)      extraRow = { label: "Kurang Bayar", value: remaining, color: PDF_COLORS.danger };
  else if (dibayar > 0 && remaining < 0) extraRow = { label: "Kembalian",    value: Math.abs(remaining), color: PDF_COLORS.success };

  const rowH = 6.2;
  const cardW = 80;
  const cardX = PDF_PAGE.width - m - cardW;
  const totalRows = rows.length + (extraRow ? 1 : 0);
  const cardH = 6 + totalRows * rowH + 3 + 11; // padding + rows + sep + grand-total

  // Page break check (pastikan summary muat di halaman ini)
  if (y + cardH > PDF_PAGE.footerY - 10) {
    pdf.addPage();
    y = 20;
  }

  pdfDrawCard(pdf, cardX, y, cardW, cardH, {
    fill: PDF_COLORS.white,
    border: PDF_COLORS.border
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  let cy = y + 7;

  rows.forEach((r) => {
    pdfSetText(pdf, PDF_COLORS.textMid);
    pdf.text(r.label, cardX + 4, cy);
    pdfSetText(pdf, PDF_COLORS.text);
    pdf.text(pdfRupiah(r.value), cardX + cardW - 4, cy, { align: "right" });
    cy += rowH;
  });

  if (extraRow) {
    pdf.setFont("helvetica", "bold");
    pdfSetText(pdf, extraRow.color);
    pdf.text(extraRow.label, cardX + 4, cy);
    pdf.text(pdfRupiah(extraRow.value), cardX + cardW - 4, cy, { align: "right" });
    cy += rowH;
    pdf.setFont("helvetica", "normal");
  }

  // Separator
  cy += 0.5;
  pdfSetDraw(pdf, PDF_COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(cardX + 3, cy, cardX + cardW - 3, cy);
  cy += 3;

  // Grand total — pill
  pdfSetFill(pdf, PDF_COLORS.primary);
  pdf.roundedRect(cardX + 2, cy, cardW - 4, 8.5, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdfSetText(pdf, PDF_COLORS.white);
  pdf.text("TOTAL", cardX + 6, cy + 5.8);
  pdf.text(pdfRupiah(grand), cardX + cardW - 6, cy + 5.8, { align: "right" });

  return y + cardH + 6;
}

/* ================= SIGNATURE & QR ================= */
async function pdfDrawSignatureSection(pdf, y) {
  const m = PDF_PAGE.margin;
  const blockH = 48;

  // Page break safety
  if (y + blockH > PDF_PAGE.footerY - 10) {
    pdf.addPage();
    y = 20;
  }

  // Card pembungkus
  pdfDrawCard(pdf, m, y, PDF_PAGE.contentW, blockH, {
    fill: PDF_COLORS.white,
    border: PDF_COLORS.border
  });

  // ===== KIRI: QR =====
  const qrCanvas = document.querySelector("#qr canvas");
  if (qrCanvas) {
    try {
      const qrImage = qrCanvas.toDataURL("image/png");
      pdf.addImage(qrImage, "PNG", m + 6, y + 5, 28, 28);
    } catch (e) { /* skip */ }
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdfSetText(pdf, PDF_COLORS.primary);
  pdf.text("Scan untuk Verifikasi", m + 6 + 14, y + 38, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdfSetText(pdf, PDF_COLORS.textMid);
  pdf.text("Validasi keaslian nota", m + 6 + 14, y + 42, { align: "center" });

  // ===== TENGAH: garis vertikal halus =====
  pdfSetDraw(pdf, PDF_COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.line(PDF_PAGE.width / 2, y + 5, PDF_PAGE.width / 2, y + blockH - 5);

  // ===== KANAN: TTD =====
  const sigCenterX = PDF_PAGE.width - m - 32;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdfSetText(pdf, PDF_COLORS.text);
  pdf.text("Hormat Kami,", sigCenterX, y + 7, { align: "center" });

  // Signature image
  const sigBox = document.getElementById("ttdImg");
  if (sigBox && sigBox.style.backgroundImage) {
    const url = sigBox.style.backgroundImage
      .replace(/^url\(["']?/, "")
      .replace(/["']?\)$/, "");
    try {
      const img = await pdfLoadImage(url);
      pdf.addImage(img, "PNG", sigCenterX - 18, y + 9, 36, 18);
    } catch (e) { /* skip */ }
  }

  // Garis tanda tangan
  pdfSetDraw(pdf, PDF_COLORS.textSoft);
  pdf.setLineWidth(0.3);
  pdf.line(sigCenterX - 25, y + 30, sigCenterX + 25, y + 30);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdfSetText(pdf, PDF_COLORS.primary);
  const ttdName = document.getElementById("ttdName")?.textContent?.trim()
                  || "CEO - PART & SERVICE";
  pdf.text(ttdName, sigCenterX, y + 35, { align: "center" });

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.5);
  pdfSetText(pdf, PDF_COLORS.textMid);
  pdf.text("Cellular Engineering Officer", sigCenterX, y + 39.5, { align: "center" });

  return y + blockH + 5;
}

/* ================= TERMS & WARRANTY ================= */
function pdfDrawTerms(pdf, y, data) {
  const m = PDF_PAGE.margin;
  const w = PDF_PAGE.contentW;

  const syarat = [
    "Garansi hanya berlaku untuk kerusakan yang sama dengan perbaikan sebelumnya.",
    "Segel atau label garansi wajib dalam kondisi utuh.",
    "Tidak berlaku jika perangkat terkena air atau cairan.",
    "Kerusakan fisik (jatuh, retak, tekanan, dll) tidak termasuk garansi.",
    "Tidak berlaku jika unit telah dibongkar atau diperbaiki pihak lain.",
    "Nota wajib dibawa sebagai bukti saat melakukan klaim garansi."
  ];

  // Hitung tinggi
  let lineCount = 0;
  syarat.forEach(s => {
    const wrapped = pdf.splitTextToSize(s, w - 14);
    lineCount += wrapped.length;
  });
  const boxH = 14 + lineCount * 4 + 6;

  // Page break check
  if (y + boxH > PDF_PAGE.footerY - 6) {
    pdf.addPage();
    y = 20;
  }

  pdfDrawCard(pdf, m, y, w, boxH, {
    fill: PDF_COLORS.warnBg,
    border: PDF_COLORS.warnBorder
  });

  // Title
  pdfAccentBar(pdf, m + 3, y + 3.5, 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdfSetText(pdf, PDF_COLORS.primary);
  pdf.text("Syarat & Ketentuan Garansi", m + 7, y + 7.5);

  // Garansi info
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdfSetText(pdf, PDF_COLORS.textMid);
  const garansiInfo = data.garansi
    ? "Masa garansi berlaku sampai " + pdfFormatDate(data.garansi) + "."
    : "Masa garansi menyesuaikan jenis perbaikan.";
  pdf.text(garansiInfo, m + 7, y + 12);

  // Syarat list
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.8);
  pdfSetText(pdf, [70, 70, 70]);

  let cy = y + 18;
  syarat.forEach((s, i) => {
    pdf.setFont("helvetica", "bold");
    pdfSetText(pdf, PDF_COLORS.primary);
    pdf.text(`${i + 1}.`, m + 7, cy);

    pdf.setFont("helvetica", "normal");
    pdfSetText(pdf, [70, 70, 70]);
    const wrapped = pdf.splitTextToSize(s, w - 18);
    pdf.text(wrapped, m + 12, cy);
    cy += 4 * wrapped.length;
  });

  return y + boxH + 4;
}

/* ================= WATERMARK (per-page) ================= */
function pdfDrawWatermark(pdf, isPaid) {
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(80);
    pdf.setGState(new pdf.GState({ opacity: 0.06 }));
    pdfSetText(pdf, isPaid ? PDF_COLORS.success : PDF_COLORS.danger);
    pdf.text(
      isPaid ? "LUNAS" : "BELUM LUNAS",
      PDF_PAGE.width / 2,
      PDF_PAGE.height / 2,
      { align: "center", angle: -22 }
    );
    pdf.setGState(new pdf.GState({ opacity: 1 }));
  }
}

/* ================= FOOTER (per-page) ================= */
function pdfDrawFooter(pdf, data) {
  const totalPages = pdf.internal.getNumberOfPages();
  const m = PDF_PAGE.margin;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    // Garis atas footer
    pdfSetDraw(pdf, PDF_COLORS.border);
    pdf.setLineWidth(0.2);
    pdf.line(m, PDF_PAGE.footerY, PDF_PAGE.width - m, PDF_PAGE.footerY);

    // Pesan terima kasih
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);
    pdfSetText(pdf, PDF_COLORS.textMid);
    pdf.text(
      "Terima kasih telah mempercayakan layanan Anda kepada CEO PART & SERVICE",
      PDF_PAGE.width / 2,
      PDF_PAGE.footerY + 4,
      { align: "center" }
    );

    // Meta footer kiri
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdfSetText(pdf, PDF_COLORS.textSoft);
    pdf.text(
      "ceo-servicehp.vercel.app  ·  INV-" + String(data.id).padStart(5, "0"),
      m,
      PDF_PAGE.footerY + 9
    );

    // Halaman X dari Y kanan
    pdf.text(
      `Halaman ${i} dari ${totalPages}`,
      PDF_PAGE.width - m,
      PDF_PAGE.footerY + 9,
      { align: "right" }
    );
  }
}

/* ================= MAIN — downloadPDF ================= */
async function downloadPDF() {
  if (typeof currentData === "undefined" || !currentData) {
    alert("Data invoice belum siap. Silakan tunggu sebentar.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Library jsPDF belum termuat.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  // PDF metadata
  pdf.setProperties({
    title:    "Invoice INV-" + String(currentData.id).padStart(5, "0"),
    subject:  "Invoice Service HP — CEO PART & SERVICE",
    author:   "CEO PART & SERVICE",
    keywords: "invoice, service, hp, ceo",
    creator:  "ceo-servicehp.vercel.app"
  });

  const isPaid = (currentData.payment_status || "")
    .toLowerCase()
    .includes("lunas");

  // ===== Render sequence =====
  let y = pdfDrawHeader(pdf, currentData);
  y = pdfDrawInfoCards(pdf, y, currentData, isPaid);
  y = pdfDrawProblemBox(pdf, y, currentData);

  const tableResult = pdfDrawItemsTable(pdf, y, currentData);
  y = tableResult.finalY + 6;

  y = pdfDrawSummary(pdf, y, currentData, tableResult.subtotal);
  y = await pdfDrawSignatureSection(pdf, y);
  y = pdfDrawTerms(pdf, y, currentData);

  // Watermark & footer terakhir (apply ke semua halaman)
  pdfDrawWatermark(pdf, isPaid);
  pdfDrawFooter(pdf, currentData);

  // ===== Save =====
  const safeName = (currentData.nama || "Customer")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  const fileName =
    `Invoice_INV-${String(currentData.id).padStart(5, "0")}_${safeName}.pdf`;

  pdf.save(fileName);
}

/* Expose ke global agar bisa dipanggil dari tombol di nota.html */
window.downloadPDF = downloadPDF;
