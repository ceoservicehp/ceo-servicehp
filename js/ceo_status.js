"use strict";

function getSupabase(){
  return window.supabaseClient;
}

function rupiah(n){
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

let globalData = [];
let activeStatusFilter = "all";
let searchKeyword = "";

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[char]);
}

function formatDate(value, withTime = false){
  if(!value) return "-";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "-";

  if(withTime){
    return date.toLocaleString("id-ID", {
      day:"2-digit",
      month:"short",
      year:"numeric",
      hour:"2-digit",
      minute:"2-digit"
    });
  }

  return date.toLocaleDateString("id-ID", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
}

function statusClass(status){
  const value = String(status || "pending").toLowerCase();
  if(value === "proses") return "status-proses";
  if(value === "selesai") return "status-selesai";
  if(value === "batal") return "status-batal";
  return "status-pending";
}

function formatSparepart(sparepartJSON){
  if(!sparepartJSON) return "Tidak ada";

  try{
    const parts = JSON.parse(sparepartJSON);
    if(!Array.isArray(parts) || parts.length === 0) return "Tidak ada";

    return parts.map(part => {
      const qty = Number(part.qty || 0);
      const harga = Number(part.harga || 0);
      const total = harga * qty;

      return `
        <div class="sp-item">
          <span class="sp-name">${esc(part.nama)}</span>
          <span class="sp-qty">x${qty}</span>
          <span class="sp-total">${rupiah(total)}</span>
        </div>
      `;
    }).join("");
  }catch(error){
    return "Format tidak valid";
  }
}

function updateStats(){
  const counts = {
    all: globalData.length,
    pending: globalData.filter(row => String(row.status || "").toLowerCase() === "pending").length,
    proses: globalData.filter(row => String(row.status || "").toLowerCase() === "proses").length,
    selesai: globalData.filter(row => String(row.status || "").toLowerCase() === "selesai").length,
    batal: globalData.filter(row => String(row.status || "").toLowerCase() === "batal").length
  };

  const mapping = {
    totalService: counts.all,
    statPending: counts.pending,
    statProses: counts.proses,
    statSelesai: counts.selesai,
    statBatal: counts.batal
  };

  Object.entries(mapping).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if(element) element.textContent = value;
  });
}

function getFilteredData(){
  return globalData.filter(row => {
    const status = String(row.status || "pending").toLowerCase();
    const statusMatch = activeStatusFilter === "all" || status === activeStatusFilter;

    const haystack = [
      row.nama,
      row.alamat,
      row.brand,
      row.problem,
      row.metode,
      row.status
    ].join(" ").toLowerCase();

    const searchMatch = !searchKeyword || haystack.includes(searchKeyword);
    return statusMatch && searchMatch;
  });
}

function renderTable(){
  const tbody = document.getElementById("statusTable");
  if(!tbody) return;

  const rows = getFilteredData();

  if(!rows.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          <i class="fa-regular fa-folder-open"></i> Tidak ada service yang sesuai.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row, index) => `
    <tr data-status="${esc(String(row.status || "pending").toLowerCase())}">
      <td><strong>${index + 1}</strong></td>
      <td>
        <strong>${esc(row.nama || "-")}</strong>
        ${row.phone ? `<small style="display:block;color:#8b989d;margin-top:3px">${esc(row.phone)}</small>` : ""}
      </td>
      <td>${esc(row.alamat || "-")}</td>
      <td>${formatDate(row.created_at)}</td>
      <td>
        <span class="status-badge ${statusClass(row.status)} status-clickable" data-id="${row.id}">
          ${esc(row.status || "pending")}
        </span>
      </td>
      <td>
        <button class="detail-btn" data-id="${row.id}" type="button">
          <i class="fa-solid fa-eye"></i> Detail
        </button>
      </td>
    </tr>
  `).join("");
}

function setupFilters(){
  const searchInput = document.getElementById("searchNama");
  if(searchInput){
    searchInput.addEventListener("input", event => {
      searchKeyword = event.target.value.trim().toLowerCase();
      renderTable();
    });
  }

  document.querySelectorAll(".stat-filter-card").forEach(card => {
    const activate = () => {
      activeStatusFilter = card.dataset.statusFilter || "all";
      document.querySelectorAll(".stat-filter-card").forEach(item => {
        item.classList.toggle("active", item === card);
      });
      renderTable();
    };

    card.addEventListener("click", activate);
    card.addEventListener("keydown", event => {
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        activate();
      }
    });
  });
}

function setupMobileNav(){
  const menuToggle = document.getElementById("menuToggle");
  const topNav = document.getElementById("topNav");
  const navOverlay = document.getElementById("navOverlay");

  if(!menuToggle || !topNav || !navOverlay) return;

  const closeNav = () => {
    topNav.classList.remove("open");
    navOverlay.classList.remove("show");
    menuToggle.setAttribute("aria-expanded", "false");
  };

  menuToggle.addEventListener("click", () => {
    const open = !topNav.classList.contains("open");
    topNav.classList.toggle("open", open);
    navOverlay.classList.toggle("show", open);
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  navOverlay.addEventListener("click", closeNav);
  topNav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeNav));
}

/* ================= LOAD DATA ================= */
document.addEventListener("DOMContentLoaded", async () => {
  setupMobileNav();
  setupFilters();

  const supabase = getSupabase();
  const tbody = document.getElementById("statusTable");

  if(!supabase){
    if(tbody){
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Supabase belum terhubung.</td></tr>`;
    }
    return;
  }

  const { data, error } = await supabase
    .from("service_orders")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.error("Gagal memuat status service:", error);
    if(tbody){
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Gagal memuat data service.</td></tr>`;
    }
    return;
  }

  globalData = data || [];
  updateStats();
  renderTable();
});

/* ================= CLICK HANDLER ================= */
document.addEventListener("click", event => {
  const detailButton = event.target.closest(".detail-btn");

  if(detailButton){
    const id = Number(detailButton.dataset.id);
    const dataRow = globalData.find(order => Number(order.id) === id);
    if(!dataRow) return;

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if(element) element.textContent = value ?? "-";
    };

    setText("d-nama", dataRow.nama || "-");
    setText("d-alamat", dataRow.alamat || "-");
    setText("d-brand", dataRow.brand || dataRow.tipe_model || "-");
    setText("d-problem", dataRow.problem || "-");
    setText("d-metode", dataRow.metode || "-");
    setText("d-perbaikan", dataRow.jenis_perbaikan || "Informasi tidak tersedia");
    setText("d-status", String(dataRow.status || "-").toUpperCase());
    setText("d-tanggal", formatDate(dataRow.created_at, true));

    const masuk = document.getElementById("p-masuk");
    const proses = document.getElementById("p-proses");
    const selesai = document.getElementById("p-selesai");

    if(masuk) masuk.textContent = formatDate(dataRow.created_at, true);

    if(proses){
      proses.textContent = dataRow.status === "pending"
        ? "-"
        : formatDate(dataRow.updated_at || dataRow.created_at, true);
    }

    if(selesai){
      selesai.textContent = dataRow.tanggal_selesai
        ? formatDate(dataRow.tanggal_selesai, true)
        : "-";
    }

    const stepMasuk = document.getElementById("step-masuk");
    const stepProses = document.getElementById("step-proses");
    const stepSelesai = document.getElementById("step-selesai");

    [stepMasuk, stepProses, stepSelesai].forEach(step => step?.classList.remove("completed"));
    stepMasuk?.classList.add("completed");

    const status = String(dataRow.status || "").toLowerCase();
    if(status === "proses") stepProses?.classList.add("completed");
    if(status === "selesai"){
      stepProses?.classList.add("completed");
      stepSelesai?.classList.add("completed");
    }

    const selesaiElement = document.getElementById("d-selesai");
    if(selesaiElement){
      selesaiElement.textContent = dataRow.tanggal_selesai
        ? formatDate(dataRow.tanggal_selesai, true)
        : "Belum selesai";
    }

    const buktiService = document.getElementById("d-bukti-service");
    if(buktiService){
      if(dataRow.bukti_service){
        buktiService.innerHTML = `
          <a href="${esc(dataRow.bukti_service)}" target="_blank" rel="noopener">
            <i class="fa-solid fa-image"></i> Lihat Foto Hasil Service
          </a>
        `;
      }else if(status === "selesai"){
        buktiService.innerHTML = `<span>Teknisi tidak mengunggah foto hasil service.</span>`;
      }else{
        buktiService.innerHTML = `<span><i class="fa-regular fa-clock"></i> Dokumentasi tersedia setelah pengerjaan selesai.</span>`;
      }
    }

    const detailModal = document.getElementById("detailModal");
    if(detailModal){
      detailModal.style.display = "flex";
      detailModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    return;
  }

  const statusElement = event.target.closest(".status-clickable");
  if(!statusElement) return;

  const id = Number(statusElement.dataset.id);
  const dataRow = globalData.find(order => Number(order.id) === id);
  if(!dataRow) return;

  const status = String(dataRow.status || "").toLowerCase();
  const popup = document.getElementById("statusPopup");
  const popupText = document.getElementById("popupText");
  if(!popup || !popupText) return;

  const configs = {
    pending:{icon:"fa-solid fa-hourglass-half", message:"Menunggu antrian teknisi"},
    proses:{icon:"fa-solid fa-screwdriver-wrench", message:"Teknisi sedang mengerjakan perangkat"},
    selesai:{icon:"fa-solid fa-circle-check", message:"Service selesai dan siap ditindaklanjuti"},
    batal:{icon:"fa-solid fa-circle-xmark", message:"Service dibatalkan"}
  };

  const config = configs[status] || {icon:"fa-solid fa-circle-info", message:"Status service sedang diperbarui"};

  popupText.innerHTML = `
    <div><i class="${config.icon}"></i></div>
    <h3>${esc(status.toUpperCase() || "STATUS")}</h3>
    <p>${esc(config.message)}</p>
  `;

  popup.className = `status-popup ${status}`;
  popup.style.display = "flex";
  popup.setAttribute("aria-hidden", "false");
});

/* ================= CLOSE DETAIL MODAL ================= */
function closeDetailModal(){
  const detailModal = document.getElementById("detailModal");
  if(!detailModal) return;
  detailModal.style.display = "none";
  detailModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function closeStatusPopup(){
  const popup = document.getElementById("statusPopup");
  if(!popup) return;
  popup.style.display = "none";
  popup.setAttribute("aria-hidden", "true");
}

window.addEventListener("DOMContentLoaded", () => {
  const closeModalButton = document.getElementById("closeModal");
  const detailModal = document.getElementById("detailModal");
  const closePopupButton = document.getElementById("closeStatusPopup");
  const statusPopup = document.getElementById("statusPopup");

  closeModalButton?.addEventListener("click", closeDetailModal);
  detailModal?.addEventListener("click", event => {
    if(event.target === detailModal) closeDetailModal();
  });

  closePopupButton?.addEventListener("click", closeStatusPopup);
  statusPopup?.addEventListener("click", event => {
    if(event.target === statusPopup) closeStatusPopup();
  });

  document.addEventListener("keydown", event => {
    if(event.key === "Escape"){
      closeDetailModal();
      closeStatusPopup();
    }
  });
});
