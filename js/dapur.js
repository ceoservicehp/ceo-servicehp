"use strict";

function getSupabase(){
    return window.supabaseClient;
}

/* ================= GLOBAL ================= */
let allOrders=[];
let currentFilter="all";

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

        const totalKeseluruhan = (row.transport || 0) + (row.jasa || 0);

        tbody.innerHTML+=`
        <tr>
            <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
            <td>${i+1}</td>
            <td>${row.nama ?? "-"}</td>
            <td>${row.alamat ?? "-"}</td>
            <td>${row.phone ?? "-"}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${row.status ?? "pending"}
                </span>
            </td>
            <td style="font-weight:600; color:#009688;">
                ${rupiah(totalKeseluruhan)}
            </td>
            
            <td style="font-size:12px; color:#666;">
                ${new Date(row.created_at).toLocaleDateString("id-ID",{
                    day:"2-digit",
                    month:"short",
                    year:"numeric"
                })}
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

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded",()=>{

    loadOrders();
    loadStoreStatus();

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
        document.getElementById("edit-sparepart").value=data.sparepart ?? "";
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
    document.getElementById("saveEdit").onclick=async()=>{

        const id=parseInt(document.getElementById("edit-id").value);

        const transport=parseInt(document.getElementById("edit-transport").value) || 0;
        const jasa=parseInt(document.getElementById("edit-jasa").value) || 0;
        const total=transport+jasa;

        const {error}=await getSupabase()
            .from("service_orders")
            .update({
                nama:document.getElementById("edit-nama").value,
                phone:document.getElementById("edit-phone").value,
                alamat:document.getElementById("edit-alamat").value,
                brand:document.getElementById("edit-brand").value,
                problem:document.getElementById("edit-problem").value,
                metode:document.getElementById("edit-metode").value,
                sparepart:document.getElementById("edit-sparepart").value,
                transport:transport,
                jasa:jasa,
                total:total,
                status:document.getElementById("edit-status").value,
                coord:document.getElementById("edit-coord").value
            })
            .eq("id",id);

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
?.addEventListener("click",async()=>{

    const checked=[...document.querySelectorAll(".row-check:checked")];

    if(checked.length===0)
        return alert("Pilih data dulu");

    if(!confirm("Hapus semua data terpilih?")) return;

    const ids=checked.map(c=>c.dataset.id);

    await getSupabase()
        .from("service_orders")        
        .delete()
        .in("id",ids);

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

        const totalKeseluruhan = (row.transport || 0) + (row.jasa || 0);

        tbody.innerHTML+=`
        <tr>
            <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
            <td>${i+1}</td>
            <td>${row.nama ?? "-"}</td>
            <td>${row.alamat ?? "-"}</td>
            <td>${row.phone ?? "-"}</td>
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


