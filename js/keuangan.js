"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

let financeChart;

document.addEventListener("DOMContentLoaded", async ()=>{

    if(!db){
        alert("Supabase belum terhubung");
        return;
    }

    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString("id-ID",{
            weekday:"long",
            day:"2-digit",
            month:"long",
            year:"numeric"
        });

    loadFinance();

    document.getElementById("startDate")
        ?.addEventListener("change", loadFinance);

    document.getElementById("endDate")
        ?.addEventListener("change", loadFinance);

    document.getElementById("resetFilter")
        ?.addEventListener("click", ()=>{
            document.getElementById("startDate").value="";
            document.getElementById("endDate").value="";
            loadFinance();
        });
});


/* ================= LOAD DATA ================= */
async function loadFinance(){

    const tbody=document.getElementById("financeTable");

    const { data, error } = await db
        .from("service_orders")
        .select("*")
        .eq("status","selesai")
        .order("created_at",{ascending:false});

    if(error){
        tbody.innerHTML=`<tr><td colspan="4">Error load data</td></tr>`;
        return;
    }

    const rows = data || [];

    const start = document.getElementById("startDate")?.value;
    const end = document.getElementById("endDate")?.value;

    let filteredRows = rows;

    if(start && end){
        filteredRows = rows.filter(o=>{
            const created = new Date(o.created_at)
                .toISOString()
                .split("T")[0];

            return created >= start && created <= end;
        });
    }

    calculateSummary(filteredRows);
    renderTable(filteredRows);
}


/* ================= HITUNG SUMMARY ================= */
function calculateSummary(rows){

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    let totalAll = 0;
    let totalService = 0;
    let totalSparepart = 0;
    let totalModal = 0;

    rows.forEach(o=>{
        totalAll += Number(o.total) || 0;
        totalService += (Number(o.jasa) || 0) + (Number(o.transport) || 0);
        totalSparepart += Number(o.total_sparepart) || 0;
        totalModal += Number(o.modal_sparepart) || 0;
    });

    const totalProfit = totalSparepart - totalModal;
    const margin = totalSparepart > 0
        ? ((totalProfit / totalSparepart) * 100).toFixed(1)
        : 0;

    /* ===== HARI INI ===== */
    const totalToday = rows
        .filter(o => o.created_at?.split("T")[0] === todayStr)
        .reduce((a,b)=>a+(Number(b.total) || 0),0);

    /* ===== MINGGU INI ===== */
    const firstDayOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    firstDayOfWeek.setDate(diff);
    firstDayOfWeek.setHours(0,0,0,0);

    const totalWeek = rows
        .filter(o=>{
            const d = new Date(o.created_at);
            return d >= firstDayOfWeek && d <= today;
        })
        .reduce((a,b)=>a+(Number(b.total) || 0),0);

    /* ===== BULAN INI ===== */
    const monthNow = today.getMonth();
    const yearNow = today.getFullYear();

    const totalMonth = rows
        .filter(o=>{
            const d=new Date(o.created_at);
            return d.getMonth()===monthNow &&
                   d.getFullYear()===yearNow;
        })
        .reduce((a,b)=>a+(Number(b.total) || 0),0);

    /* ===== UPDATE CARD ===== */
    document.getElementById("totalAll").textContent = rupiah(totalAll);
    document.getElementById("totalToday").textContent = rupiah(totalToday);
    document.getElementById("totalWeek").textContent = rupiah(totalWeek);
    document.getElementById("totalMonth").textContent = rupiah(totalMonth);

    // tambahan card (pastikan ada di HTML)
    document.getElementById("totalService").textContent = rupiah(totalService);
    document.getElementById("totalSparepart").textContent = rupiah(totalSparepart);
    document.getElementById("totalModal").textContent = rupiah(totalModal);
    document.getElementById("totalProfit").textContent = rupiah(totalProfit);
    document.getElementById("totalMargin").textContent = margin + "%";

    generateProfitChart(rows);
}


/* ================= GRAFIK LABA BULANAN ================= */
function generateProfitChart(rows){

    const ctx = document.getElementById("financeChart");

    const monthly = {};

    rows.forEach(o=>{
        const d = new Date(o.created_at);
        const key = d.toLocaleDateString("id-ID",{
            month:"short",
            year:"numeric"
        });

        const profit =
            (Number(o.total_sparepart) || 0)
          - (Number(o.modal_sparepart) || 0);

        monthly[key] = (monthly[key] || 0) + profit;
    });

    const labels = Object.keys(monthly);
    const values = Object.values(monthly);

    if(financeChart){
        financeChart.destroy();
    }

    financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Laba Bersih Bulanan',
                data: values
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}


/* ================= RENDER TABLE ================= */
function renderTable(rows){

    const tbody=document.getElementById("financeTable");

    if(rows.length===0){
        tbody.innerHTML=`<tr><td colspan="4">Belum ada pemasukan</td></tr>`;
        return;
    }

    tbody.innerHTML="";

    rows.forEach((row,i)=>{

        const tanggal = new Date(row.created_at)
            .toLocaleDateString("id-ID",{
                day:"2-digit",
                month:"short",
                year:"numeric"
            });

        tbody.innerHTML+=`
        <tr>
            <td>${i+1}</td>
            <td>${row.nama}</td>
            <td>${tanggal}</td>
            <td style="font-weight:600;color:#00a896;">
                ${rupiah(row.total)}
            </td>
        </tr>
        `;
    });
}
