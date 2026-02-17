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

loadFinance();

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

/* ================= TOTAL KESELURUHAN ================= */
const totalAll = rows
.reduce((a,b)=>a+(b.total || 0),0);

/* ================= HARI INI ================= */
const today = new Date();
const todayStr = today.toISOString().split("T")[0];

const totalToday = rows
.filter(o =>
new Date(o.created_at)
.toISOString()
.split("T")[0] === todayStr
)
.reduce((a,b)=>a+(b.total || 0),0);

/* ================= MINGGU INI ================= */
const firstDayOfWeek = new Date(today);
firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Minggu

const totalWeek = rows
.filter(o=>{
const d = new Date(o.created_at);
return d >= firstDayOfWeek && d <= today;
})
.reduce((a,b)=>a+(b.total || 0),0);

/* ================= BULAN INI ================= */
const monthNow = today.getMonth();
const yearNow = today.getFullYear();

const totalMonth = rows
.filter(o=>{
const d=new Date(o.created_at);
return d.getMonth()===monthNow &&
d.getFullYear()===yearNow;
})
.reduce((a,b)=>a+(b.total || 0),0);

/* ================= TAMPILKAN SUMMARY ================= */

document.getElementById("totalAll").textContent = rupiah(totalAll);
document.getElementById("totalToday").textContent = rupiah(totalToday);
document.getElementById("totalWeek").textContent = rupiah(totalWeek);
document.getElementById("totalMonth").textContent = rupiah(totalMonth);

/* ================= RENDER TABLE ================= */

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
