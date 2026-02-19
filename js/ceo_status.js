"use strict";

function getSupabase(){
    return window.supabaseClient;
}

function rupiah(n){
    return "Rp " + Number(n||0).toLocaleString("id-ID");
}

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

const supabase=getSupabase();
if(!supabase) return;

const tbody=document.getElementById("statusTable");

const {data,error}=await supabase
.from("service_orders")
.select("*")
.order("created_at",{ascending:false});

if(error){
tbody.innerHTML=`<tr><td colspan="8">Gagal load data</td></tr>`;
return;
}

if(!data.length){
tbody.innerHTML=`<tr><td colspan="8">Belum ada data</td></tr>`;
return;
}

tbody.innerHTML="";

data.forEach((row,i)=>{

let statusClass="status-pending";
if(row.status==="proses") statusClass="status-proses";
if(row.status==="selesai") statusClass="status-selesai";
if(row.status==="batal") statusClass="status-batal";

const tanggal=new Date(row.created_at)
.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});

tbody.innerHTML+=`
<tr>
<td>${i+1}</td>
<td>${row.nama}</td>
<td>${row.alamat}</td>
<td>${tanggal}</td>
<td><span class="status-badge ${statusClass}">
${row.status}
</span></td>
<td style="color:#009688;font-weight:600">
${rupiah(row.total)}
</td>
<td>
<button class="detail-btn" data-id="${row.id}">
Detail
</button>
</td>
</tr>
`;
});


/* ================= SEARCH ================= */
document.getElementById("searchNama")
.addEventListener("input",e=>{
const keyword=e.target.value.toLowerCase();
document.querySelectorAll("#statusTable tr")
.forEach(tr=>{
const text=tr.innerText.toLowerCase();
tr.style.display=text.includes(keyword)?"":"none";
});
});


/* ================= DETAIL MODAL ================= */
document.addEventListener("click",e=>{
if(!e.target.classList.contains("detail-btn")) return;

const id=parseInt(e.target.dataset.id);
const dataRow=data.find(o=>o.id===id);
if(!dataRow) return;

document.getElementById("d-nama").textContent=dataRow.nama;
document.getElementById("d-alamat").textContent=dataRow.alamat;
document.getElementById("d-brand").textContent=dataRow.brand;
document.getElementById("d-problem").textContent=dataRow.problem;
document.getElementById("d-metode").textContent=dataRow.metode;
document.getElementById("d-sparepart").innerHTML =
  formatSparepart(dataRow.sparepart);
document.getElementById("d-totalspare").textContent=rupiah(dataRow.total_sparepart);
document.getElementById("d-transport").textContent=rupiah(dataRow.transport);
document.getElementById("d-jasa").textContent=rupiah(dataRow.jasa);
document.getElementById("d-total").textContent=rupiah(dataRow.total);
document.getElementById("d-status").textContent=dataRow.status;
document.getElementById("d-tanggal").textContent=
new Date(dataRow.created_at).toLocaleString("id-ID");

// Bukti Transfer (dari user)
document.getElementById("d-bukti").innerHTML = dataRow.bukti
  ? `<a href="${dataRow.bukti}" target="_blank" class="bukti-link">
        <i class="fa-solid fa-receipt"></i> Lihat Bukti Transfer
     </a>`
  : "-";

// Bukti Service Selesai (dari admin)
document.getElementById("d-bukti-service").innerHTML =
  dataRow.bukti_service
    ? `<a href="${dataRow.bukti_service}" target="_blank" class="bukti-link">
          <i class="fa-solid fa-image"></i> Lihat Bukti Service
       </a>`
    : "Service belum selesai";

document.getElementById("detailModal").style.display="flex";
});


document.getElementById("closeModal").onclick=()=>{
document.getElementById("detailModal").style.display="none";
};

});
