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

    tbody.innerHTML=`<tr><td colspan="17">Loading...</td></tr>`;

    const {data,error}=await supabase
        .from("service_orders")
        .select("*")
        .order("created_at",{ascending:false});

    console.log("Data dari service_orders:", data, error);  // ✅ cek di console

    if(error){
        tbody.innerHTML=`<tr><td colspan="16">Error load data</td></tr>`;
        console.error(error);
        return;
    }

    if(!data || data.length===0){
        tbody.innerHTML=`<tr><td colspan="16">Belum ada pesanan</td></tr>`;
        return;
    }

    allOrders=data;
    renderTable();
}

/* ================= RENDER TABLE ================= */
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
        tbody.innerHTML=`<tr><td colspan="16">Tidak ada data</td></tr>`;
        return;
    }

    tbody.innerHTML="";

    rows.forEach((row,i)=>{
        tbody.innerHTML+=`
        <tr>
            <td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
            <td>${i+1}</td>
            <td>${row.nama ?? "-"}</td>
            <td>${row.phone ?? "-"}</td>
            <td>${row.brand ?? "-"}</td>
            <td>${row.problem ?? "-"}</td>
            <td>${row.sparepart ?? "-"}</td>
            <td>${row.metode ?? "-"}</td>
            <td>${row.transport ?? "0"}</td>
            <td>${row.alamat ?? "-"}</td>
            <td>${row.coord ?? "-"}</td>
            <td>
                ${row.bukti ? `<a href="${row.bukti}" target="_blank">Lihat</a>` : "-"}
            </td>
            <td>
                <select class="status-select" data-id="${row.id}">
                    <option value="pending" ${row.status=="pending"?"selected":""}>Pending</option>
                    <option value="proses" ${row.status=="proses"?"selected":""}>Proses</option>
                    <option value="selesai" ${row.status=="selesai"?"selected":""}>Selesai</option>
                    <option value="batal" ${row.status=="batal"?"selected":""}>Batal</option>
                </select>
            </td>
            <td>${new Date(row.created_at).toLocaleString("id-ID")}</td>
            <td><button class="hapus" data-id="${row.id}">Hapus</button></td>
        </tr>
        `;
    });
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
?.addEventListener("input",e=>{

    const k=e.target.value.toLowerCase();

    document.querySelectorAll("#orderTable tr")
        .forEach(tr=>{
            const nama=tr.children[2]?.innerText.toLowerCase() || "";
            tr.style.display=nama.includes(k)?"":"none";
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

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded",()=>{
    loadOrders();
    loadStoreStatus();

    document.getElementById("btnOpen").onclick=()=>setStore(true);
    document.getElementById("btnClose").onclick=()=>setStore(false);

    document.getElementById("tanggalOtomatis").textContent=
        new Date().toLocaleString("id-ID");

    // ✅ Auto-refresh tiap 5 detik
    setInterval(loadOrders, 5000);
});





