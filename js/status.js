"use strict";

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

document.getElementById("btnSearch").onclick = async () => {

    const supabase = window.supabaseClient;
    const keyword = document.getElementById("searchInput").value.trim();
    const resultBox = document.getElementById("resultBox");

    if(!keyword){
        alert("Masukkan No HP atau ID Service");
        return;
    }

    resultBox.innerHTML = "Mencari data...";

    let query;

    if(!isNaN(keyword)){
        // jika angka → bisa ID atau nomor HP
        query = supabase
            .from("service_orders")
            .select("*")
            .or(`id.eq.${keyword},phone.eq.${keyword}`)
            .order("created_at", { ascending: false });
    } else {
        query = supabase
            .from("service_orders")
            .select("*")
            .eq("phone", keyword)
            .order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if(error){
        resultBox.innerHTML = "Gagal mengambil data.";
        console.error(error);
        return;
    }

    if(!data || data.length === 0){
        resultBox.innerHTML = "Data tidak ditemukan.";
        return;
    }

    resultBox.innerHTML = "";

    data.forEach(order => {

        let statusColor = "#999";
        if(order.status === "pending") statusColor = "#f39c12";
        if(order.status === "proses") statusColor = "#3498db";
        if(order.status === "selesai") statusColor = "#27ae60";
        if(order.status === "batal") statusColor = "#e74c3c";

        const tanggal = new Date(order.created_at)
            .toLocaleString("id-ID");

        resultBox.innerHTML += `
            <div class="status-card">
                <h3>ID Service: ${order.id}</h3>
                <p><b>Nama:</b> ${order.nama}</p>
                <p><b>Merk:</b> ${order.brand}</p>
                <p><b>Keluhan:</b> ${order.problem}</p>
                <p><b>Sparepart:</b> ${order.sparepart || "-"}</p>

                <hr>

                <p>Total Sparepart: ${rupiah(order.total_sparepart)}</p>
                <p>Transport: ${rupiah(order.transport)}</p>
                <p>Jasa: ${rupiah(order.jasa)}</p>
                <h3>Total: ${rupiah(order.total)}</h3>

                <p>Status:
                    <span style="color:${statusColor}; font-weight:bold;">
                        ${order.status.toUpperCase()}
                    </span>
                </p>

                <small>Tanggal Masuk: ${tanggal}</small>
            </div>
        `;
    });

};
