"use strict";

function getSupabase(){
    return window.supabaseClient;
}

/* ================= GLOBAL ================= */
let allOrders=[];
let currentFilter="all";
let selectedParts = [];

/* ================= STATUS TOKO ================= */
async function loadStoreStatus(){
    const supabase=getSupabase();
    if(!supabase) return;

    const {data}=await supabase
        .from("store_status")
        .select("is_open")
        .eq("id",1)
        .maybeSingle();

    updateAdminStatus(data?.is_open ?? false);
}

function updateAdminStatus(open){
    const msg=document.getElementById("admin-status");
    if(!msg) return;

    if(open){
        msg.innerHTML="🟢 Layanan Dibuka";
        msg.className="store-status open";
    }else{
        msg.innerHTML="🔴 Layanan Ditutup";
        msg.className="store-status closed";
    }
}

async function setStore(open){
    const supabase=getSupabase();
    if(!supabase) return;

    await supabase
        .from("store_status")
        .update({is_open:open})
        .eq("id",1);

    updateAdminStatus(open);
}

/* ================= LOAD DATA ================= */
async function loadOrders(){
    const supabase=getSupabase();
    const tbody=document.getElementById("orderTable");
    if(!tbody || !supabase) return;

    tbody.innerHTML=`<tr><td colspan="9">Loading...</td></tr>`;

    const {data,error}=await supabase
        .from("service_orders")
        .select("*")
        .order("created_at",{ascending:false});

    // console.log("Data dari service_orders:", data, error);  // ✅ cek di console

    if(error){
        tbody.innerHTML=`<tr><td colspan="9">Error load data</td></tr>`;
        console.error(error);
        return;
    }

    if(!data || data.length===0){
        tbody.innerHTML=`<tr><td colspan="9">Belum ada pesanan</td></tr>`;
        return;
    }

    allOrders=data;
    renderTable();
}

/* ================= LOAD SPAREPART ================= */
async function loadSpareparts(){
  const supabase = getSupabase();
  if(!supabase) return;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending:true });

  if(error){
    console.error(error);
    return;
  }

  const select = document.getElementById("sparepartSelect");
  if(!select) return;

  select.innerHTML = `<option value="">Pilih Sparepart</option>`;

  data.forEach(item=>{
  select.innerHTML += `
    <option value="${item.id}"
      data-nama="${item.nama || item.name}"
      data-harga="${item.harga || item.price}"
      data-stok="${item.stok || item.stock}"
      ${(item.stok || item.stock) <= 0 ? "disabled" : ""}>
      ${(item.nama || item.name)} (Stok: ${(item.stok || item.stock)})
    </option>
  `;
});
}

/* ================= RENDER TABLE ================= */
function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function renderTable(){
    const tbody=document.getElementById("orderTable");
    if(!tbody) return;

    let rows=allOrders;

    if(currentFilter!=="all"){
        rows=allOrders.filter(o =>
            o.metode?.toLowerCase().includes(currentFilter)
        );
    }

    if(rows.length===0){
        tbody.innerHTML=`<tr><td colspan="9">Tidak ada data</td></tr>`;
        return;
    }

    tbody.innerHTML="";

    rows.forEach((row,i)=>{

        let statusClass="status-pending";
        if(row.status==="proses") statusClass="status-proses";
        if(row.status==="selesai") statusClass="status-selesai";
        if(row.status==="batal") statusClass="status-batal";

        const totalKeseluruhan =
            (row.total_sparepart || 0) +
            (row.transport || 0) +
            (row.jasa || 0);


        const tanggal = row.created_at
            ? new Date(row.created_at).toLocaleDateString("id-ID",{
                day:"2-digit",
                month:"short",
                year:"numeric"
            })
            : "-";

        tbody.innerHTML+=`
        <tr>
            <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
            <td>${i+1}</td>
            <td>${row.nama ?? "-"}</td>
            <td>${row.alamat ?? "-"}</td>
            <td>${row.phone ?? "-"}</td>
            <td>${tanggal}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${row.status ?? "pending"}
                </span>
            </td>
            <td style="font-weight:600; color:#009688;">
                ${rupiah(totalKeseluruhan)}
            </td>
            <td>
                <button class="detail-btn" data-id="${row.id}">
                    Detail
                </button>
            </td>
        </tr>
        `;
    });
}

/* ================= Render Sparepart ================= */
function renderSelectedParts(){
  const container = document.getElementById("selectedSpareparts");
  container.innerHTML = "";

  selectedParts.forEach((item,index)=>{
    container.innerHTML += `
      <div class="selected-item">
        <span class="sp-name">${item.nama}</span>
        <span class="sp-price">Rp ${Number(item.harga).toLocaleString("id-ID")}</span>

        <input type="number"
          min="1"
          value="${item.qty}"
          class="sp-qty"
          onchange="updateQty(${index}, this.value)">

        <button class="sp-remove"
          onclick="removePart(${index})">
          ✕
        </button>
      </div>
    `;
  });

  document.getElementById("edit-sparepart").value =
    JSON.stringify(selectedParts);
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded",()=>{

    loadOrders();
    loadStoreStatus();
    loadSpareparts();

    document.getElementById("btnOpen").onclick=()=>setStore(true);
    document.getElementById("btnClose").onclick=()=>setStore(false);

    document.getElementById("tanggalOtomatis").textContent=
        new Date().toLocaleString("id-ID");

    /* ================= DETAIL MODAL ================= */

    document.addEventListener("click",e=>{
        if(!e.target.classList.contains("detail-btn")) return;

        const id=parseInt(e.target.dataset.id);
        const data=allOrders.find(o=>o.id===id);
        if(!data) return;

        document.getElementById("edit-id").value=data.id;
        document.getElementById("edit-nama").value=data.nama ?? "";
        document.getElementById("edit-phone").value=data.phone ?? "";
        document.getElementById("edit-alamat").value=data.alamat ?? "";
        document.getElementById("edit-brand").value=data.brand ?? "";
        document.getElementById("edit-problem").value=data.problem ?? "";
        document.getElementById("edit-metode").value=data.metode ?? "";
        // reset dulu
            selectedParts = [];
            
            if(data.sparepart){
              try{
                selectedParts = JSON.parse(data.sparepart);
              }catch(e){
                selectedParts = [];
              }
            }
            
            // render ulang sparepart lama
            renderSelectedParts();
            hitungTotalSparepart();

        document.getElementById("edit-total-sparepart").value=data.total_sparepart ?? 0;
        document.getElementById("edit-transport").value=data.transport ?? 0;
        document.getElementById("edit-jasa").value=data.jasa ?? 0;
        document.getElementById("edit-total").value=data.total ?? 0;
        document.getElementById("edit-status").value=data.status ?? "pending";
        document.getElementById("edit-tanggal").value =
        new Date(data.created_at).toLocaleString("id-ID",{
            weekday:"long",
            day:"2-digit",
            month:"long",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit"
        });
        document.getElementById("edit-coord").value=data.coord ?? "";

        const buktiDiv=document.getElementById("edit-bukti-preview");
        buktiDiv.innerHTML = data.bukti
            ? `<a href="${data.bukti}" target="_blank">Lihat Bukti</a>`
            : "Tidak ada bukti";

        document.getElementById("detailModal").style.display="flex";
    });

    /* CLOSE MODAL */
    document.getElementById("closeModal").onclick=()=>{
        document.getElementById("detailModal").style.display="none";
    };

    /* SAVE EDIT */
    document.getElementById("saveEdit").onclick = async () => {

    const id = parseInt(document.getElementById("edit-id").value);

    const spare = parseInt(document.getElementById("edit-total-sparepart").value) || 0;
    const transport = parseInt(document.getElementById("edit-transport").value) || 0;
    const jasa = parseInt(document.getElementById("edit-jasa").value) || 0;

    const total = spare + transport + jasa;

    const { error } = await getSupabase()
        .from("service_orders")
        .update({
            nama:document.getElementById("edit-nama").value,
            phone:document.getElementById("edit-phone").value,
            alamat:document.getElementById("edit-alamat").value,
            brand:document.getElementById("edit-brand").value,
            problem:document.getElementById("edit-problem").value,
            metode:document.getElementById("edit-metode").value,
            sparepart:document.getElementById("edit-sparepart").value,

            total_sparepart: spare,   // ✅ FIXED
            transport: transport,
            jasa: jasa,
            total: total,

            status:document.getElementById("edit-status").value,
            coord:document.getElementById("edit-coord").value
        })
        .eq("id", id);

    if(error){
        alert("Gagal update");
        console.log(error);
        return;
    }

    document.getElementById("detailModal").style.display="none";
    loadOrders();
};

    /* DELETE */
    document.getElementById("deleteEdit").onclick=async()=>{
        const id=parseInt(document.getElementById("edit-id").value);
        if(!confirm("Hapus data ini?")) return;

        await getSupabase()
            .from("service_orders")
            .delete()
            .eq("id",id);

        document.getElementById("detailModal").style.display="none";
        loadOrders();
    };

});

/* ================= Event Dropdown Sparepart ================= */
document.getElementById("sparepartSelect")
?.addEventListener("change", function(){

  const option = this.options[this.selectedIndex];
  if(!option.value) return;

  const id = option.value;
  const nama = option.dataset.nama;
  const harga = parseInt(option.dataset.harga);
  const stok = parseInt(option.dataset.stok);

  const existing = selectedParts.find(p => p.id === id);

  if(existing){
    if(existing.qty < stok){
      existing.qty += 1;
    }
  } else {
    selectedParts.push({
      id,
      nama,
      harga,
      qty:1
    });
  }

  renderSelectedParts();
  hitungTotalSparepart();

  this.value="";
});

/* ================= Hitung Total Sparepart ================= */
function hitungTotalSparepart(){
  let total = 0;

  selectedParts.forEach(item=>{

    const harga = parseInt(item.harga) || 0;
    const qty   = parseInt(item.qty) || 0;

    total += harga * qty;
  });

  document.getElementById("edit-total-sparepart").value = total || 0;
}

/* ================= Update QTY & Remove Part ================= */
function updateQty(index,value){
  let qty = parseInt(value);
  if(isNaN(qty) || qty < 1){
    qty = 1;
  }
  selectedParts[index].qty = qty;
  hitungTotalSparepart();
  renderSelectedParts();
}


function removePart(index){
  selectedParts.splice(index,1);
  renderSelectedParts();
  hitungTotalSparepart();
}

/* ================= TAB FILTER ================= */
document.addEventListener("click",e=>{
    if(!e.target.classList.contains("tab")) return;

    document.querySelectorAll(".tab")
        .forEach(t=>t.classList.remove("active"));

    e.target.classList.add("active");

    currentFilter=e.target.dataset.filter;
    renderTable();
});

/* ================= DELETE ================= */
document.addEventListener("click",async e=>{
    if(!e.target.classList.contains("hapus")) return;

    const id=e.target.dataset.id;
    if(!confirm("Hapus data ini?")) return;

    await getSupabase()
        .from("service_orders")      
        .delete()
        .eq("id",id);

    loadOrders();
});

/* ================= UPDATE STATUS ================= */
document.addEventListener("change",async e=>{
    if(!e.target.classList.contains("status-select")) return;

    const id=e.target.dataset.id;
    const val=e.target.value;

    await getSupabase()
        .from("service_orders")       
        .update({status:val})
        .eq("id",id);
});

/* ================= SEARCH ================= */
document.getElementById("searchNama")
?.addEventListener("input", e => {

    const keyword = e.target.value.toLowerCase();

    document.querySelectorAll("#orderTable tr")
        .forEach(tr => {

            const namaCell = tr.children[2];
            if(!namaCell) return;

            const nama = namaCell.innerText.toLowerCase();

            tr.style.display = nama.includes(keyword) ? "" : "none";
        });
});

/* ================= CHECK ALL ================= */
document.getElementById("checkAll")
?.addEventListener("change",e=>{
    document.querySelectorAll(".row-check")
        .forEach(cb=>cb.checked=e.target.checked);
});

/* ================= DELETE SELECTED ================= */
document.getElementById("hapusTerpilih")
?.addEventListener("click", async () => {

    const checked = [...document.querySelectorAll(".row-check:checked")];

    console.log("Checked:", checked);

    if (checked.length === 0) {
        alert("Pilih data dulu");
        return;
    }

    if (!confirm("Hapus semua data terpilih?")) return;

    const ids = checked.map(c => parseInt(c.dataset.id));

    console.log("IDs yang akan dihapus:", ids);

    const { data, error } = await getSupabase()
        .from("service_orders")
        .delete()
        .in("id", ids)
        .select();

    console.log("Delete result:", data);
    console.log("Delete error:", error);

    if (error) {
        alert("Gagal menghapus");
        return;
    }

    loadOrders();
});

/* ================= FILTER TANGGAL ================= */
document.getElementById("filterTanggal")
?.addEventListener("change", e => {

    const selected = e.target.value;

    if(!selected){
        renderTable();
        return;
    }

    const filtered = allOrders.filter(o => {

        const created = new Date(o.created_at)
            .toISOString()
            .split("T")[0];

        return created === selected;
    });

    const tbody = document.getElementById("orderTable");
    tbody.innerHTML = "";

    if(filtered.length === 0){
        tbody.innerHTML = `<tr><td colspan="9">Tidak ada data</td></tr>`;
        return;
    }

    filtered.forEach((row,i)=>{

        let statusClass="status-pending";
        if(row.status==="proses") statusClass="status-proses";
        if(row.status==="selesai") statusClass="status-selesai";
        if(row.status==="batal") statusClass="status-batal";

        const totalKeseluruhan =
          (row.total_sparepart || 0) +
          (row.transport || 0) +
          (row.jasa || 0);

        const tanggal = row.created_at
            ? new Date(row.created_at).toLocaleDateString("id-ID",{
                day:"2-digit",
                month:"short",
                year:"numeric"
            })
            : "-";

        tbody.innerHTML+=`
        <tr>
            <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
            <td>${i+1}</td>
            <td>${row.nama ?? "-"}</td>
            <td>${row.alamat ?? "-"}</td>
            <td>${row.phone ?? "-"}</td>
            <td>${tanggal}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${row.status ?? "pending"}
                </span>
            </td>
            <td style="font-weight:600; color:#009688;">
                ${rupiah(totalKeseluruhan)}
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

/* ================= CETAK DATA ================= */
document.getElementById("cetakTanggal")
?.addEventListener("click", () => {

    window.print();

});






