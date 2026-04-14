"use strict";

function getSupabase(){
    return window.supabaseClient;
}

function rupiah(n){
    return "Rp " + Number(n||0).toLocaleString("id-ID");
}

let globalData = [];

function formatSparepart(sparepartJSON){
  if(!sparepartJSON) return "Tidak ada";

  try{
    const parts = JSON.parse(sparepartJSON);
    if(!Array.isArray(parts) || parts.length === 0){
      return "Tidak ada";
    }

    return parts.map(p => {
      const qty = Number(p.qty || 0);
      const harga = Number(p.harga || 0);
      const total = harga * qty;

      return `
        <div class="sp-item">
          <span class="sp-name">${p.nama}</span>
          <span class="sp-qty">x${qty}</span>
          <span class="sp-total">${rupiah(total)}</span>
        </div>
      `;
    }).join("");

  }catch(e){
    return "Format tidak valid";
  }
}

document.addEventListener("DOMContentLoaded", async ()=>{

const supabase = getSupabase();
if(!supabase) return;

const tbody = document.getElementById("statusTable");

const {data,error} = await supabase
.from("service_orders")
.select("*")
.order("created_at",{ascending:false});

if(error){
  tbody.innerHTML = `<tr><td colspan="8">Gagal load data</td></tr>`;
  return;
}

if(!data.length){
  tbody.innerHTML = `<tr><td colspan="8">Belum ada data</td></tr>`;
  return;
}

globalData = data;

tbody.innerHTML = "";

data.forEach((row,i)=>{

let statusClass = "status-pending";

if(row.status === "proses") statusClass = "status-proses";
if(row.status === "selesai") statusClass = "status-selesai";
if(row.status === "batal") statusClass = "status-batal";

const tanggal = new Date(row.created_at)
.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});

tbody.innerHTML += `
<tr>
<td>${i+1}</td>
<td>${row.nama}</td>
<td>${row.alamat}</td>
<td>${tanggal}</td>

<td>
  <span class="status-badge ${statusClass} status-clickable"
        data-id="${row.id}">
    ${row.status}
  </span>
</td>

<td>
<button class="detail-btn" data-id="${row.id}">
Detail
</button>
</td>
</tr>
`;
});

});

/* ================= SEARCH ================= */
document.getElementById("searchNama")
.addEventListener("input",e=>{
const keyword = e.target.value.toLowerCase();

document.querySelectorAll("#statusTable tr")
.forEach(tr=>{
const text = tr.innerText.toLowerCase();
tr.style.display = text.includes(keyword) ? "" : "none";
});
});

/* ================= GLOBAL CLICK HANDLER ================= */
document.addEventListener("click",(e)=>{

/* ========= DETAIL ========= */
if(e.target.closest(".detail-btn")){

const btn = e.target.closest(".detail-btn");

const id = parseInt(btn.dataset.id);
const dataRow = globalData.find(o=>o.id===id);
if(!dataRow) return;

document.getElementById("d-nama").textContent = dataRow.nama;
document.getElementById("d-alamat").textContent = dataRow.alamat;
document.getElementById("d-brand").textContent = dataRow.brand;
document.getElementById("d-problem").textContent = dataRow.problem;
document.getElementById("d-metode").textContent = dataRow.metode;

document.getElementById("d-status").textContent = dataRow.status;
document.getElementById("d-tanggal").textContent =
new Date(dataRow.created_at).toLocaleString("id-ID");

document.getElementById("detailModal").style.display = "flex";

return;
}

/* ========= STATUS CLICK ========= */
const el = e.target.closest(".status-clickable");
if(!el) return;

const id = parseInt(el.dataset.id);
const dataRow = globalData.find(o=>o.id===id);
if(!dataRow) return;

const status = (dataRow.status || "").toLowerCase();

const popup = document.getElementById("statusPopup");
const text = document.getElementById("popupText");

if(!popup || !text) return;

/* reset animasi */
popup.classList.remove("show");
void popup.offsetWidth;

let message = "";
let icon = "";

if(status === "pending"){
  icon = "fa-solid fa-hourglass";
  message = "Menunggu antrian teknisi";
}
else if(status === "proses"){
  icon = "fa-solid fa-screwdriver-wrench";
  message = "Teknisi sedang bekerja";
}
else if(status === "selesai"){
  icon = "fa-solid fa-circle-check";
  message = "Service selesai, siap diambil";
}
else if(status === "batal"){
  icon = "fa-solid fa-circle-xmark";
  message = "Service dibatalkan";
}

text.innerHTML = `
  <div style="font-size:40px;margin-bottom:10px">
    <i class="${icon}"></i>
  </div>
  <h3>${status.toUpperCase()}</h3>
  <p>${message}</p>
`;

popup.style.display = "flex";
popup.classList.add("show");

});

});

/* ================= CLOSE POPUP ================= */
document.getElementById("closeStatusPopup").onclick = ()=>{
document.getElementById("statusPopup").style.display="none";
};

document.getElementById("statusPopup").onclick = (e)=>{
if(e.target.id === "statusPopup"){
e.target.style.display="none";
}
};
