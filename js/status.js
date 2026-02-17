"use strict";

let resultData = [];

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

document.getElementById("btnSearch").onclick = async () => {

    const supabase = window.supabaseClient;
    const keyword = document.getElementById("searchInput").value.trim();
    const tbody = document.getElementById("statusTable");

    if(!keyword){
        alert("Masukkan No HP atau ID Service");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="7">Mencari...</td></tr>`;

    const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .or(`id.eq.${keyword},phone.eq.${keyword}`)
        .order("created_at",{ascending:false});

    if(error){
        tbody.innerHTML = `<tr><td colspan="7">Gagal mengambil data</td></tr>`;
        return;
    }

    if(!data || data.length===0){
        tbody.innerHTML = `<tr><td colspan="7">Data tidak ditemukan</td></tr>`;
        return;
    }

    resultData = data;
    tbody.innerHTML = "";

    data.forEach((row,i)=>{

        let statusColor="#999";
        if(row.status==="pending") statusColor="#f39c12";
        if(row.status==="proses") statusColor="#3498db";
        if(row.status==="selesai") statusColor="#27ae60";
        if(row.status==="batal") statusColor="#e74c3c";

        tbody.innerHTML+=`
        <tr>
            <td>${i+1}</td>
            <td>${row.nama}</td>
            <td>${row.brand}</td>
            <td>${new Date(row.created_at).toLocaleDateString("id-ID")}</td>
            <td style="color:${statusColor}; font-weight:bold;">
                ${row.status.toUpperCase()}
            </td>
            <td>${rupiah(row.total)}</td>
            <td>
                <button class="detail-btn" data-id="${row.id}">
                    Detail
                </button>
            </td>
        </tr>
        `;
    });

};


/* ================= MODAL ================= */
document.addEventListener("click", e => {

    if(!e.target.classList.contains("detail-btn")) return;

    const id = parseInt(e.target.dataset.id);
    const data = resultData.find(o=>o.id===id);
    if(!data) return;

    document.getElementById("view-nama").value=data.nama;
    document.getElementById("view-phone").value=data.phone;
    document.getElementById("view-brand").value=data.brand;
    document.getElementById("view-status").value=data.status;
    document.getElementById("view-problem").value=data.problem;
    document.getElementById("view-sparepart").value=data.sparepart;
    document.getElementById("view-spareTotal").value=rupiah(data.total_sparepart);
    document.getElementById("view-transport").value=rupiah(data.transport);
    document.getElementById("view-jasa").value=rupiah(data.jasa);
    document.getElementById("view-total").value=rupiah(data.total);
    document.getElementById("view-tanggal").value=
        new Date(data.created_at).toLocaleString("id-ID");

    document.getElementById("detailModal").style.display="flex";
});


document.getElementById("closeModal").onclick=()=>{
    document.getElementById("detailModal").style.display="none";
};
