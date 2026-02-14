"use strict";

function getSupabase(){
return window.supabaseClient;
}

/* ================= STATUS TOKO ================= */
async function loadStoreStatus(){
const supabase=getSupabase();

const {data}=await supabase
.from("store_status")
.select("is_open")
.eq("id",1)
.maybeSingle();

updateAdminStatus(data?.is_open);
}

function updateAdminStatus(open){
const msg=document.getElementById("admin-status");

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

tbody.innerHTML=`<tr><td colspan="11">Loading...</td></tr>`;

const {data}=await supabase
.from("service_orders")
.select("*")
.order("created_at",{ascending:false});

if(!data || data.length===0){
tbody.innerHTML=`<tr><td colspan="11">Belum ada data</td></tr>`;
return;
}

tbody.innerHTML="";

data.forEach((row,i)=>{

tbody.innerHTML+=`
<tr>
<td><input type="checkbox" class="row-check" data-id="${row.id}"></td>
<td>${i+1}</td>
<td>${row.nama}</td>
<td>${row.no_hp}</td>
<td>${row.merk_hp}</td>
<td>${row.keluhan}</td>
<td>${row.layanan}</td>
<td>${row.metode}</td>
<td>
<select class="status-select" data-id="${row.id}" data-old="${row.status}">
<option value="pending" ${row.status=="pending"?"selected":""}>Pending</option>
<option value="proses" ${row.status=="proses"?"selected":""}>Proses</option>
<option value="selesai" ${row.status=="selesai"?"selected":""}>Selesai</option>
<option value="batal" ${row.status=="batal"?"selected":""}>Batal</option>
</select>
</td>
<td>${new Date(row.created_at).toLocaleString("id-ID")}</td>
<td>
<button class="hapus" data-id="${row.id}">Hapus</button>
</td>
</tr>
`;
});

}

/* ================= DELETE ================= */
document.addEventListener("click",async e=>{

if(!e.target.classList.contains("hapus"))return;

const id=e.target.dataset.id;
if(!confirm("Hapus data ini?"))return;

await getSupabase()
.from("service_orders")
.delete()
.eq("id",id);

loadOrders();
});

/* ================= UPDATE STATUS ================= */
document.addEventListener("change",async e=>{

if(!e.target.classList.contains("status-select"))return;

const select=e.target;
const id=select.dataset.id;
const val=select.value;

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
const nama=tr.children[2]?.innerText.toLowerCase();
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

if(checked.length===0)return alert("Pilih data dulu");

if(!confirm("Hapus semua data terpilih?"))return;

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
});
