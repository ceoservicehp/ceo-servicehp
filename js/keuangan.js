"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

document.addEventListener("DOMContentLoaded", async ()=>{

    if(!db){
        alert("Supabase belum terhubung");
        return;
    }

    // tampilkan tanggal hari ini
    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString("id-ID",{
            weekday:"long",
            day:"2-digit",
            month:"long",
            year:"numeric"
        });

    loadFinance();

    // filter tanggal
    document.getElementById("filterTanggal")
    ?.addEventListener("change", filterByDate);

    // reset filter
    document.getElementById("resetFilter")
    ?.addEventListener("click", ()=>{
        document.getElementById("filterTanggal").value="";
        loadFinance();
    });

});

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

    calculateSummary(rows);
    renderTable(rows);
}


/* ================= HITUNG SUMMARY ================= */
function calculateSummary(rows){

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const totalAll = rows.reduce((a,b)=>a+(b.total || 0),0);

    const totalToday = rows
        .filter(o => 
            o.created_at?.split("T")[0] === todayStr
        )
        .reduce((a,b)=>a+(b.total || 0),0);

    // Awal minggu (Senin)
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
        .reduce((a,b)=>a+(b.total || 0),0);

    const monthNow = today.getMonth();
    const yearNow = today.getFullYear();

    const totalMonth = rows
        .filter(o=>{
            const d=new Date(o.created_at);
            return d.getMonth()===monthNow &&
                   d.getFullYear()===yearNow;
        })
        .reduce((a,b)=>a+(b.total || 0),0);

    document.getElementById("totalAll").textContent = rupiah(totalAll);
    document.getElementById("totalToday").textContent = rupiah(totalToday);
    document.getElementById("totalWeek").textContent = rupiah(totalWeek);
    document.getElementById("totalMonth").textContent = rupiah(totalMonth);
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


/* ================= FILTER TANGGAL ================= */
async function filterByDate(e){

    const selected = e.target.value;

    if(!selected){
        loadFinance();
        return;
    }

    const tbody=document.getElementById("financeTable");

    const { data, error } = await db
        .from("service_orders")
        .select("*")
        .eq("status","selesai")
        .gte("created_at", selected + "T00:00:00")
        .lte("created_at", selected + "T23:59:59")
        .order("created_at",{ascending:false});

    if(error){
        tbody.innerHTML=`<tr><td colspan="4">Error filter</td></tr>`;
        return;
    }

    const rows = data || [];

    calculateSummary(rows);
    renderTable(rows);
}
