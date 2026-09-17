"use strict";

const client = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}
function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}
/* ================= FORMAT SPAREPART ================= */
function formatSparepart(sparepartJSON){

    if(!sparepartJSON) return "-";

    try{
        const parts = JSON.parse(sparepartJSON);
        if(!Array.isArray(parts) || parts.length === 0){
            return "-";
        }
        return parts.map(p => {
            const qty = Number(p.qty || 0);
            const harga = Number(p.harga || 0);
            const total = harga * qty;
            return `
            <div style="font-size:13px">
                ${p.nama} x${qty} 
                <span style="color:#2980b9;">
                (${rupiah(harga)})
                </span>
            </div>
            `;
        }).join("");

    }catch(e){
        return "-";
    }
}

/* ================= GLOBAL DATA ================= */

let currentTab = "income";
let incomeData = [];
let expenseData = [];
let debtData = [];
let laptopData = [];
let fullLaptopData = [];
let fullDroneData = [];
let ujangData = [];
let fullUjangData = [];
let fullKasbonData = [];
let kasbonGroupedData = [];

let summaryIncomeData = [];
let summaryExpenseData = [];

let filteredIncomeData = [];
let filteredExpenseData = [];

let currentPage = 1;
let pageSize = 10;
let totalRows = 0;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async ()=>{

    if(!client){
        alert("Supabase belum terhubung");
        return;
    }

    await checkFinanceAccess();

    const tanggalEl = document.getElementById("tanggalOtomatis");

    if(tanggalEl){
        const now = new Date();
        tanggalEl.textContent = "Tanggal: " +
        now.toLocaleDateString("id-ID",{
            weekday:"long",
            day:"2-digit",
            month:"long",
            year:"numeric"
        });
    }

    setupTabs();
    setupFilters();
    setupExpenseForm();
    setupKasbonNames();
    loadKasbonMasterNames();
    setupExportButtons();

    await loadSummaryData();
    await loadFinance();
});


/* ================= ROLE LOCK ================= */
async function checkFinanceAccess(){

    const { data: { user } } = await client.auth.getUser();

    if(!user){
        window.location.href = "login.html";
        return;
    }

    const { data } = await client
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

    if(!data || !data.is_active){
        alert("Akun belum aktif.");
        window.location.href = "dapur.html";
        return;
    }

    if(data.role !== "admin" && data.role !== "superadmin"){
        alert("Halaman keuangan hanya untuk admin.");
        window.location.href = "dapur.html";
    }
}

/* ================= TAB SYSTEM ================= */
function setupTabs(){
    document.querySelectorAll(".tab").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            document.querySelectorAll(".tab")
                .forEach(b=>b.classList.remove("active"));

            btn.classList.add("active");
            currentTab = btn.dataset.tab;
            currentPage = 1;
            loadFinance();
        });
    });
}


/* ================= FILTER SYSTEM ================= */
function setupFilters(){

    document.querySelectorAll(".quick-filter button")
    .forEach(btn=>{
        btn.addEventListener("click", ()=>{
            applyQuickFilter(btn.dataset.range);
        });
    });

    document.getElementById("applyFilter")
        ?.addEventListener("click", loadFinance);

    document.getElementById("resetFilter")
        ?.addEventListener("click", ()=>{
            document.getElementById("startDate").value="";
            document.getElementById("endDate").value="";
            loadFinance();
        });
}


function applyQuickFilter(type){

    const today = new Date();
    let start, end;

    if(type==="today"){
        start = end = localDate(today);
    }

   if(type==="week"){
    const first = new Date(today);
    const day = first.getDay() || 7;

    first.setDate(first.getDate() - day + 1);

    start = localDate(first);
    end = localDate(today);
}
    
    if(type==="month"){
        const first = new Date(today.getFullYear(), today.getMonth(), 1);

        start = localDate(first);
        end = localDate(today);
    }

    document.getElementById("startDate").value = start;
    document.getElementById("endDate").value = end;

    loadFinance();
}


/* ================= KOLABORASI UJANG ================= */
function getUjangShare(row){
    const total = Number(row?.total || 0);
    const transport = Number(row?.transport || 0);
    const modalSparepart = Number(row?.modal_sparepart || 0);

    const storedDasar = row?.bagi_hasil_dasar;
    const dasar = storedDasar === null || storedDasar === undefined
        ? Math.max(0, total - transport - modalSparepart)
        : Number(storedDasar || 0);

    const sumber = String(row?.sumber_pelanggan || "CEO").toUpperCase();
    const persenUjang = row?.persen_ujang === null || row?.persen_ujang === undefined
        ? (sumber === "UJANG" ? 65 : 50)
        : Number(row.persen_ujang || 0);
    const persenCeo = row?.persen_ceo === null || row?.persen_ceo === undefined
        ? (100 - persenUjang)
        : Number(row.persen_ceo || 0);

    const bagianUjang = row?.bagian_ujang === null || row?.bagian_ujang === undefined
        ? Math.round(dasar * persenUjang / 100)
        : Number(row.bagian_ujang || 0);
    const bagianCeo = row?.bagian_ceo === null || row?.bagian_ceo === undefined
        ? Math.round(dasar * persenCeo / 100)
        : Number(row.bagian_ceo || 0);

    return { total, transport, modalSparepart, dasar, sumber, persenUjang, persenCeo, bagianUjang, bagianCeo };
}

function updateUjangSummary(rows = []){
    const summary = rows.reduce((acc, row)=>{
        const calc = getUjangShare(row);
        acc.dasar += calc.dasar;
        acc.ujang += calc.bagianUjang;
        acc.ceo += calc.bagianCeo;
        return acc;
    }, { dasar:0, ujang:0, ceo:0 });

    const unitEl = document.getElementById("ujangTotalUnit");
    const dasarEl = document.getElementById("ujangTotalDasar");
    const ujangEl = document.getElementById("ujangTotalBagian");
    const ceoEl = document.getElementById("ceoTotalBagian");

    if(unitEl) unitEl.textContent = `${rows.length} Unit`;
    if(dasarEl) dasarEl.textContent = rupiah(summary.dasar);
    if(ujangEl) ujangEl.textContent = rupiah(summary.ujang);
    if(ceoEl) ceoEl.textContent = rupiah(summary.ceo);
}


function deviceCategory(row){
    return String(row?.kategori_perangkat || "HP").trim().toUpperCase();
}
function isLaptop(row){ return deviceCategory(row) === "LAPTOP"; }
function isDrone(row){ return deviceCategory(row) === "DRONE"; }
function isLaptopOrDrone(row){ return isLaptop(row) || isDrone(row); }
function isHpService(row){ return !isLaptopOrDrone(row); }
function isUjangJob(row){ return String(row?.teknisi || "").trim().toUpperCase() === "UJANG"; }

/* Pemasukan yang benar-benar menjadi hak CEO.
   - Teknisi CEO: pemasukan CEO mengikuti pembayaran pelanggan.
   - Teknisi UJANG: pemasukan CEO HANYA bagian/hak CEO dari laba service.
     Pengembalian modal sparepart (baik modal UJANG maupun modal CEO) tidak
     dihitung sebagai pendapatan/laba CEO pada card dan tabel pemasukan.
   - Jika pembayaran pelanggan belum penuh, hak CEO diakui proporsional
     terhadap pembayaran yang sudah diterima agar tidak melebihi kas masuk. */
function getCeoRecognizedIncome(row){
    const paid = Math.max(0, Number(row?.amount_paid || 0));
    if(!isUjangJob(row)) return paid;

    const calc = getUjangShare(row);
    const total = Math.max(0, Number(row?.total || calc.total || 0));
    const hakCeo = Math.max(0, Number(calc.bagianCeo || 0));

    if(total <= 0 || paid <= 0) return 0;

    const rasioTerbayar = Math.min(1, paid / total);
    return Math.round(hakCeo * rasioTerbayar);
}

function updateDeviceSummary(prefix, rows = []){
    if(prefix !== "laptop") return;
    let billing=0, capital=0, profit=0, bmn=0;
    rows.forEach(row=>{
        const f=row._device_finance;
        billing += f ? Number(f.total_tagihan||0) : Number(row.total||0);
        if(f){ capital += Number(f.modal_teknisi||0); profit += Number(f.keuntungan_ceo||0); bmn += Number(f.hak_bmn||0); }
    });
    const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=rupiah(val)};
    set("laptopTotalBilling",billing); set("laptopTotalCapital",capital); set("laptopTotalProfit",profit); set("laptopTotalBmn",bmn);
}



/* ================= KASBON TIM CEO ================= */
let kasbonMasterNames = [];
let filteredKasbonView = [];

function normalizeKasbonName(value = ""){
    return String(value || "").replace(/^\s*kasbon\s*[-:–—]?\s*/i, "").replace(/\s+/g, " ").trim();
}
function getKasbonPerson(row){
    const manualName = normalizeKasbonName(row?.title);
    return { name: manualName || "Nama tidak terbaca", key:(manualName || "UNKNOWN").toLocaleLowerCase("id-ID") };
}
function applyKasbonNameFilter(){
    const selected = String(document.getElementById("kasbonNameFilter")?.value || "").toLocaleLowerCase("id-ID");
    filteredKasbonView = fullKasbonData.filter(row => !selected || getKasbonPerson(row).key === selected);
    updateKasbonSummary(filteredKasbonView);
}
function updateKasbonSummary(rows = []){
    const total = rows.reduce((sum,row)=>sum + Number(row.amount || 0),0);
    const set = (id, value) => { const el=document.getElementById(id); if(el) el.textContent=value; };
    set("kasbonTotalAmount", rupiah(total));
    set("kasbonTotalTransactions", `${rows.length} Transaksi`);
}
function refreshKasbonFilterOptions(){
    const select=document.getElementById("kasbonNameFilter"); if(!select) return;
    const current=select.value;
    const names=new Map();
    fullKasbonData.forEach(row=>{ const p=getKasbonPerson(row); if(p.name && p.name!=="Nama tidak terbaca") names.set(p.key,p.name); });
    kasbonMasterNames.forEach(row=>{ const n=String(row.name||"").trim(); if(n) names.set(n.toLocaleLowerCase("id-ID"),n); });
    select.innerHTML='<option value="">Semua Nama</option>'+[...names.entries()].sort((a,b)=>a[1].localeCompare(b[1],'id')).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
    if([...select.options].some(o=>o.value===current)) select.value=current;
}
async function loadKasbonMasterNames(){
    const {data,error}=await client.from("kasbon_members").select("id,name,created_at").order("name");
    if(error){ console.error("Gagal memuat master nama Kasbon:",error); kasbonMasterNames=[]; return; }
    kasbonMasterNames=data||[]; refreshKasbonFilterOptions(); refreshKasbonExpenseSelect(); renderKasbonNameList();
}
function refreshKasbonExpenseSelect(){
    const select=document.getElementById("kasbonNameSelect"); if(!select) return;
    const current=select.value;
    select.innerHTML='<option value="">Pilih Nama</option>'+kasbonMasterNames.map(r=>`<option value="${r.id}" data-name="${String(r.name||'').replace(/"/g,'&quot;')}">${r.name}</option>`).join('');
    if([...select.options].some(o=>o.value===current)) select.value=current;
}
function renderKasbonNameList(){
    const box=document.getElementById("kasbonNameList"); if(!box) return;
    if(!kasbonMasterNames.length){ box.innerHTML='<div class="empty-kasbon-names">Belum ada nama. Tambahkan nama tim yang dapat mengambil kasbon.</div>'; return; }
    box.innerHTML=kasbonMasterNames.map(r=>`<div class="kasbon-name-row"><span>${r.name}</span><button type="button" class="btn-small danger" data-delete-kasbon-name="${r.id}" data-name="${String(r.name||'').replace(/"/g,'&quot;')}"><i class="fa-solid fa-trash"></i> Hapus</button></div>`).join('');
}
function setupKasbonNames(){
    const modal=document.getElementById("kasbonNamesModal");
    const close=()=>{ if(modal) modal.style.display='none'; };
    document.getElementById("manageKasbonNamesBtn")?.addEventListener("click",async()=>{ if(modal) modal.style.display='flex'; await loadKasbonMasterNames(); });
    document.getElementById("closeKasbonNamesModal")?.addEventListener("click",close);
    document.getElementById("closeKasbonNamesModalBottom")?.addEventListener("click",close);
    document.getElementById("addKasbonNameBtn")?.addEventListener("click",async()=>{
        const input=document.getElementById("newKasbonName"); const name=String(input?.value||'').replace(/\s+/g,' ').trim();
        if(!name) return alert('Isi nama terlebih dahulu.');
        if(name.toUpperCase()==='UJANG') return alert('UJANG bukan bagian dari Tim CEO.');
        const {error}=await client.from('kasbon_members').insert({name});
        if(error){ alert(error.code==='23505'?'Nama tersebut sudah ada.':'Gagal menambahkan nama Kasbon.'); return; }
        input.value=''; await loadKasbonMasterNames();
    });
    document.getElementById("kasbonNameList")?.addEventListener("click",async(e)=>{
        const btn=e.target.closest('[data-delete-kasbon-name]'); if(!btn) return;
        if(!confirm(`Hapus ${btn.dataset.name} dari pilihan nama Kasbon? Riwayat transaksi lama tidak akan terhapus.`)) return;
        const {error}=await client.from('kasbon_members').delete().eq('id',btn.dataset.deleteKasbonName);
        if(error){ alert('Gagal menghapus nama Kasbon.'); return; }
        await loadKasbonMasterNames();
    });
    document.getElementById("kasbonNameFilter")?.addEventListener("change",()=>{ currentPage=1; applyKasbonNameFilter(); totalRows=filteredKasbonView.length; updatePagination(); renderByTab(); });
}

/* ================= LOAD DATA ================= */
async function loadFinance(){
    const start = (currentPage - 1) * pageSize;
    const startDate = document.getElementById("startDate")?.value;
    const endDate = document.getElementById("endDate")?.value;

    let incomeQuery = client
        .from("service_orders")
        .select("*")
        .eq("status","selesai")
        .order("tanggal_selesai",{ascending:false});

    if(startDate && endDate){
        incomeQuery = incomeQuery
            .gte("tanggal_selesai", startDate + "T00:00:00")
            .lte("tanggal_selesai", endDate + "T23:59:59");
    }

    const { data:fullIncome, error:incomeError } = await incomeQuery;
    if(incomeError) console.error("Gagal mengambil pemasukan:", incomeError);

    const allFinished = fullIncome || [];
    filteredIncomeData = allFinished;

    // Pemisahan lini usaha
    const hpRows = allFinished.filter(isHpService);
    fullLaptopData = allFinished.filter(isLaptopOrDrone);
    if(fullLaptopData.length){
        const ids=fullLaptopData.map(r=>r.id);
        const {data:deviceFinance,error:deviceFinanceError}=await client.from("laptop_drone_finance").select("*").in("service_order_id",ids);
        if(deviceFinanceError) console.error("Gagal mengambil perhitungan Laptop & Drone:",deviceFinanceError);
        const map=new Map((deviceFinance||[]).map(x=>[String(x.service_order_id),x]));
        fullLaptopData.forEach(r=>r._device_finance=map.get(String(r.id))||null);
    }
    fullDroneData = [];
    fullUjangData = allFinished.filter(isUjangJob);

    incomeData = hpRows.slice(start, start + pageSize);
    laptopData = fullLaptopData.slice(start, start + pageSize);
        ujangData = fullUjangData.slice(start, start + pageSize);

    updateLaptopAndDroneCards();
    updateUjangSummary(fullUjangData);

    let expenseQuery = client
        .from("expenses")
        .select(`*, profiles:honor_user_id(full_name,position)`)
        .order("created_at",{ascending:false});

    if(startDate && endDate){
        expenseQuery = expenseQuery
            .gte("created_at", startDate + "T00:00:00")
            .lte("created_at", endDate + "T23:59:59");
    }

    const { data:fullExpense, error:expenseError } = await expenseQuery;
    if(expenseError) console.error("Gagal mengambil pengeluaran:", expenseError);
    filteredExpenseData = fullExpense || [];
    expenseData = filteredExpenseData.slice(start, start + pageSize);

    // Kasbon tetap berasal dari expenses. Tabel menampilkan setiap transaksi.
    fullKasbonData = filteredExpenseData.filter(row => {
        const isKasbon = String(row.category || "").trim().toLowerCase() === "kasbon";
        if(!isKasbon) return false;
        return getKasbonPerson(row).name.trim().toUpperCase() !== "UJANG";
    });
    refreshKasbonFilterOptions();
    applyKasbonNameFilter();

    const hpDebt = hpRows.filter(row => Number(row.remaining_amount || 0) > 0);
    debtData = hpDebt;

    if(currentTab === "income") totalRows = hpRows.length;
    else if(currentTab === "expense") totalRows = filteredExpenseData.length;
    else if(currentTab === "kasbon") totalRows = filteredKasbonView.length;
    else if(currentTab === "debt"){
        totalRows = hpDebt.length;
        incomeData = hpDebt.slice(start, start + pageSize);
    }
    else if(currentTab === "laptop") totalRows = fullLaptopData.length;
    else if(currentTab === "ujang") totalRows = fullUjangData.length;

    const totalPages = Math.ceil(totalRows / pageSize);
    if(currentPage > totalPages) currentPage = totalPages || 1;

    updatePagination();
    renderByTab(incomeData, expenseData, laptopData, ujangData);

    // Card utama HANYA Service HP. Laptop & Drone tidak masuk.
    updateFinanceCards(hpRows, filteredExpenseData);
}

function updateLaptopAndDroneCards(){
    updateDeviceSummary("laptop", fullLaptopData);
}

/* ================= LOAD SUMMARY (UNTUK CARD) ================= */
async function loadSummaryData(){

    const { data:income } = await client
        .from("service_orders")
        .select("*")
        .eq("status","selesai");

    const { data:expense } = await client
        .from("expenses")
        .select("*");

    summaryIncomeData = income || [];
    summaryExpenseData = expense || [];
    
    updateFinanceCards(summaryIncomeData.filter(isHpService), summaryExpenseData);
}

function updatePagination(){

    const totalPages = Math.ceil(totalRows / pageSize);
    const pageNumbers = document.getElementById("pageNumbers");

    if(!pageNumbers) return;

    pageNumbers.innerHTML = "";

    const maxVisible = 5; // jumlah tombol maksimal
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if(endPage - startPage < maxVisible - 1){
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    /* halaman pertama */
    if(startPage > 1){

        const firstBtn = document.createElement("button");
        firstBtn.textContent = 1;
        firstBtn.addEventListener("click",()=>{
            currentPage = 1;
            loadFinance();
        });

        pageNumbers.appendChild(firstBtn);

        if(startPage > 2){
            const dots = document.createElement("span");
            dots.textContent = "...";
            pageNumbers.appendChild(dots);
        }
    }

    /* halaman tengah */
    for(let i = startPage; i <= endPage; i++){

        const btn = document.createElement("button");
        btn.textContent = i;

        if(i === currentPage){
            btn.classList.add("active");
        }

        btn.addEventListener("click",()=>{
            currentPage = i;
            loadFinance();
        });

        pageNumbers.appendChild(btn);
    }

    /* halaman terakhir */
    if(endPage < totalPages){

        if(endPage < totalPages - 1){
            const dots = document.createElement("span");
            dots.textContent = "...";
            pageNumbers.appendChild(dots);
        }

        const lastBtn = document.createElement("button");
        lastBtn.textContent = totalPages;

        lastBtn.addEventListener("click",()=>{
            currentPage = totalPages;
            loadFinance();
        });

        pageNumbers.appendChild(lastBtn);
    }

    /* prev next */

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");

    if(prevBtn) prevBtn.disabled = currentPage === 1;
    if(nextBtn) nextBtn.disabled = currentPage === totalPages;
}
document.getElementById("prevPage")
    ?.addEventListener("click",()=>{
        if(currentPage > 1){
            
            currentPage--;
            loadFinance();
        }
    });

document.getElementById("nextPage")
    ?.addEventListener("click",()=>{
        
        const totalPages = Math.ceil(totalRows / pageSize);
        
        if(currentPage < totalPages){
            currentPage++;
            loadFinance();
        }
    });

document.getElementById("pageSize")
?.addEventListener("change",function(){

pageSize = Number(this.value);
currentPage = 1;

loadFinance();

});

/* ================= UPDATE FINANCE CARDS ================= */
function updateFinanceCards(income, expense){

    const totalIncome = income.reduce((sum,row)=>
        sum + getCeoRecognizedIncome(row),0);

    const totalExpense = expense.reduce((sum,row)=>
        sum + (Number(row.amount) || 0),0);

    const profit = totalIncome - totalExpense;

    const margin = totalIncome > 0
        ? ((profit / totalIncome) * 100).toFixed(1)
        : 0;

    const totalDebt = income
        .filter(row => (row.remaining_amount || 0) > 0)
        .reduce((sum,row)=> sum + Number(row.remaining_amount),0);

    const incomeEl = document.getElementById("totalIncome");
    const expenseEl = document.getElementById("totalExpense");
    const profitEl = document.getElementById("totalProfit");
    const marginEl = document.getElementById("totalMargin");
    const debtEl = document.getElementById("totalDebt");

    if(incomeEl) incomeEl.textContent = rupiah(totalIncome);
    if(expenseEl) expenseEl.textContent = rupiah(totalExpense);
    if(profitEl) profitEl.textContent = rupiah(profit);
    if(marginEl) marginEl.textContent = margin + "%";
    if(debtEl) debtEl.textContent = rupiah(totalDebt);
}

/* ================= RENDER TABLE ================= */
function renderByTab(income = incomeData, expense = expenseData, laptop = laptopData, ujang = ujangData){

    const incomeWrapper = document.getElementById("incomeTableWrapper");
    const expenseWrapper = document.getElementById("expenseTableWrapper");
    const debtWrapper = document.getElementById("debtTableWrapper");
    const kasbonWrapper = document.getElementById("kasbonTableWrapper");
    const laptopWrapper = document.getElementById("laptopTableWrapper");
    const ujangWrapper = document.getElementById("ujangTableWrapper");

    if(incomeWrapper) incomeWrapper.style.display = "none";
    if(expenseWrapper) expenseWrapper.style.display = "none";
    if(debtWrapper) debtWrapper.style.display = "none";
    if(kasbonWrapper) kasbonWrapper.style.display = "none";
    if(laptopWrapper) laptopWrapper.style.display = "none";
    if(ujangWrapper) ujangWrapper.style.display = "none";

    /* ================= INCOME ================= */
   if(currentTab === "income"){

    if(incomeWrapper) incomeWrapper.style.display = "block";
    if(expenseWrapper) expenseWrapper.style.display = "none";

    const tbody = document.getElementById("incomeTable");
    tbody.innerHTML = "";

   income.forEach((row,i)=>{

    const sparepartList = formatSparepart(row.sparepart); // ← WAJIB ADA
    const total = Number(row.total || 0);
    const dibayar = Number(row.amount_paid || 0);
    let sisa = Number(row.remaining_amount || 0);
    
    let kembalian = 0;
    const hakUjang = isUjangJob(row) ? getUjangShare(row).bagianUjang : 0;
    const pemasukanCeo = getCeoRecognizedIncome(row);
    
    if(dibayar > total){
        kembalian = dibayar - total;
        sisa = 0;
    }

    tbody.innerHTML += `
    <tr>

        <td>${(currentPage - 1) * pageSize + i + 1}</td>
        <td>${row.nama || "-"}</td>
        <td>${row.alamat || "-"}</td>
        <td>${row.metode || "-"}</td>
        <td>
        ${row.created_at
        ? new Date(row.created_at).toLocaleDateString("id-ID")
        : "-"}
        </td>
        <td>${row.status || "-"}</td>
        <td>
        ${row.tanggal_selesai
        ? new Date(row.tanggal_selesai).toLocaleDateString("id-ID")
        : "-"}
        </td>
        <td>${sparepartList}</td>
        
        <td style="color:#27ae60;font-weight:600;">
        ${rupiah(dibayar)}
        </td>
        
        <td style="color:#b97800;font-weight:600;">
        ${hakUjang > 0 ? rupiah(hakUjang) : "-"}
        </td>

        <td style="color:#16804a;font-weight:700;">
        ${rupiah(pemasukanCeo)}
        </td>
        
        <td style="color:#e74c3c;font-weight:600;">
        ${rupiah(sisa)}
        </td>
        
        <td style="font-size:14px;color:#000;font-weight:600;">
        ${rupiah(total)}
        </td>
    </tr>
    `;
});

}

    /* ================= EXPENSE ================= */
    else if(currentTab === "expense"){

    if(expenseWrapper) expenseWrapper.style.display = "block";
    if(incomeWrapper) incomeWrapper.style.display = "none";

    const tbody = document.getElementById("expenseTable");
    tbody.innerHTML = "";

    expense.forEach((row,i)=>{

        const penerima = row.profiles?.full_name || "-";
        const price = row.price || 0;
        const qty = row.qty || 1;
        const total = row.amount || 0;

        tbody.innerHTML += `
        <tr>
            <td>${(currentPage - 1) * pageSize + i + 1}</td>
            <td>${row.title}</td>
            <td>${row.category}</td>
            <td>${penerima}</td>
            <td>${rupiah(price)}</td>
            <td>${qty}</td>
            <td style="color:#e74c3c;font-weight:600;">
                ${rupiah(total)}
            </td>
            <td>${row.notes || "-"}</td>
            <td>${new Date(row.created_at).toLocaleDateString("id-ID")}</td>
        </tr>`;
    });
    }


    /* ================= KASBON ================= */
    else if(currentTab === "kasbon"){
        if(kasbonWrapper) kasbonWrapper.style.display = "block";
        const tbody=document.getElementById("kasbonTable"); if(!tbody) return;
        tbody.innerHTML="";
        const start=(currentPage-1)*pageSize;
        const rows=filteredKasbonView.slice(start,start+pageSize);
        if(!rows.length){ tbody.innerHTML=`<tr><td colspan="6">Belum ada transaksi kasbon pada filter ini.</td></tr>`; return; }
        rows.forEach((row,i)=>{ const person=getKasbonPerson(row); tbody.innerHTML += `<tr>
            <td>${start+i+1}</td>
            <td>${new Date(row.created_at).toLocaleDateString("id-ID")}</td>
            <td><strong>${person.name}</strong></td>
            <td>${row.title || "-"}</td>
            <td>${row.notes || "-"}</td>
            <td style="font-weight:700;color:#b45309;">${rupiah(row.amount)}</td>
        </tr>`; });
    }

/* ================= DEBT ================= */
    else if(currentTab === "debt"){
        if(debtWrapper) debtWrapper.style.display = "block";
        
        const tbody = document.getElementById("debtTable");
        tbody.innerHTML = "";

/* ambil data yang masih ada sisa pembayaran */
        const debt = income;
        
        if(debt.length === 0){
            tbody.innerHTML = `<tr><td colspan="11">Tidak ada piutang</td></tr>`;
            return;
        }
        
    debt.forEach((row,i)=>{
        
        const sparepartList = formatSparepart(row.sparepart);
        
        const total = row.total || 0;
        const dibayar = row.amount_paid || 0;
        const sisa = row.remaining_amount || 0;
        
    tbody.innerHTML += `
    <tr>
        <td>${(currentPage - 1) * pageSize + i + 1}</td>
        <td>${row.nama || "-"}</td>
        <td>${row.alamat || "-"}</td>
        <td>${row.metode || "-"}</td>

        <td>
        ${row.created_at
        ? new Date(row.created_at).toLocaleDateString("id-ID")
        : "-"}
        </td>
        
        <td style="color:#e67e22;font-weight:600;">
        ${row.payment_status || "-"}
        </td>
        
        <td style="color:#e74c3c;font-weight:600;">
        ${row.due_date
        ? new Date(row.due_date).toLocaleDateString("id-ID")
        : "-"}
        </td>

        <td>${sparepartList}</td>

        <td style="color:#27ae60;font-weight:600;">
        ${rupiah(dibayar)}
        </td>
        
        <td style="color:#e74c3c;font-weight:600;">
        ${rupiah(sisa)}
        </td>
        
        <td style="font-weight:600;">
        ${rupiah(total)}
        </td>    
    </tr>
    `;
    });
}

/* ================= LAPTOP ================= */
else if(currentTab === "laptop"){
    if(laptopWrapper) laptopWrapper.style.display = "block";
    const tbody=document.getElementById("laptopTable"); if(!tbody) return; tbody.innerHTML="";
    if(!laptop.length){ tbody.innerHTML='<tr><td colspan="11">Tidak ada service Laptop & Drone pada periode ini.</td></tr>'; return; }
    laptop.forEach((row,i)=>{
        const f=row._device_finance;
        const device=[row.kategori_perangkat,row.tipe_model||row.brand].filter(Boolean).join(" · ")||"-";
        const date=row.tanggal_selesai?new Date(row.tanggal_selesai).toLocaleDateString("id-ID"):"-";
        tbody.innerHTML += `<tr>
          <td>${(currentPage-1)*pageSize+i+1}</td>
          <td><strong>${row.nama||"-"}</strong><small class="device-row-sub">${device}</small></td>
          <td>${date}</td>
          <td>${f?rupiah(f.modal_teknisi):'<span class="calc-empty">Belum diatur</span>'}</td>
          <td class="device-profit-cell">${f?rupiah(f.keuntungan_ceo):"-"}</td>
          <td>${f?rupiah(f.harga_ceo):"-"}</td>
          <td>${f?`${rupiah(f.hak_bmn)} <small>(${Number(f.bmn_percent)}%)</small>`:"-"}</td>
          <td>${f?`${rupiah(f.ppn_amount)} <small>(${Number(f.ppn_percent)}%)</small>`:"-"}</td>
          <td><strong>${f?rupiah(f.total_tagihan):rupiah(row.total||0)}</strong>${f&&Number(row.total||0)!==Number(f.total_tagihan||0)?`<small class="device-row-sub warn">Dapur: ${rupiah(row.total||0)}</small>`:""}</td>
          <td>${rupiah(row.amount_paid||0)}</td>
          <td><button type="button" class="btn-small device-calc-btn" data-device-order="${row.id}"><i class="fa-solid fa-calculator"></i> ${f?"Edit":"Atur"}</button></td>
        </tr>`;
    });
}

/* ================= UJANG ================= */
else if(currentTab === "ujang"){
    if(ujangWrapper) ujangWrapper.style.display = "block";

    const tbody = document.getElementById("ujangTable");
    if(!tbody) return;

    tbody.innerHTML = "";

    if(!ujang.length){
        tbody.innerHTML = `<tr><td colspan="12" class="empty-ujang">Belum ada service selesai yang dikerjakan UJANG pada periode ini.</td></tr>`;
        return;
    }

    ujang.forEach((row, i)=>{
        const calc = getUjangShare(row);
        const perangkat = [row.kategori_perangkat, row.tipe_model || row.brand]
            .filter(Boolean).join(" · ") || "-";
        const sourceClass = calc.sumber === "UJANG" ? "source-ujang" : "source-ceo";

        tbody.innerHTML += `
        <tr>
            <td>${(currentPage - 1) * pageSize + i + 1}</td>
            <td class="ujang-customer"><strong>${row.nama || "-"}</strong></td>
            <td>${perangkat}</td>
            <td><span class="source-badge ${sourceClass}">${calc.sumber}</span></td>
            <td>${row.tanggal_selesai ? new Date(row.tanggal_selesai).toLocaleDateString("id-ID") : "-"}</td>
            <td>${rupiah(calc.total)}</td>
            <td>${rupiah(calc.transport)}</td>
            <td>${rupiah(calc.modalSparepart)}</td>
            <td class="share-base">${rupiah(calc.dasar)}</td>
            <td><span class="split-badge">${calc.persenUjang}% / ${calc.persenCeo}%</span></td>
            <td class="share-ujang">${rupiah(calc.bagianUjang)}</td>
            <td class="share-ceo">${rupiah(calc.bagianCeo)}</td>
        </tr>`;
    });
}
    
}

async function loadExpenseCategories(){

    const { data } = await client
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

    const select = document.getElementById("expCategory");
    if(!select) return;

    select.innerHTML = "";

    data?.forEach(cat=>{
        select.innerHTML += `
            <option value="${cat.name}">
                ${cat.name}
            </option>
        `;
    });
}

async function loadHonorUsers(){

    const { data } = await client
        .from("profiles")
        .select("id, full_name, position")
        .order("full_name");

    const select = document.getElementById("honorUserSelect");
    if(!select) return;

    select.innerHTML = `<option value="">Pilih Penerima</option>`;

    data?.forEach(user=>{
        select.innerHTML += `
            <option value="${user.id}" data-name="${user.full_name || ""}">
                ${user.full_name} (${user.position || "-"})
            </option>
        `;
    });
}

/* ================= EXPENSE MODAL ================= */
function setupExpenseForm(){

    const modal = document.getElementById("expenseModal");

    /* ================= HITUNG TOTAL OTOMATIS ================= */
    const priceInput = document.getElementById("expPrice");
    const qtyInput = document.getElementById("expQty");
    const totalInput = document.getElementById("expAmount");

    function updateTotal(){
        const price = Number(priceInput?.value) || 0;
        const qty = Number(qtyInput?.value) || 0;
        if(totalInput){
            totalInput.value = price * qty;
        }
    }

    priceInput?.addEventListener("input", updateTotal);
    qtyInput?.addEventListener("input", updateTotal);

   document.getElementById("addExpenseBtn")
    ?.addEventListener("click", async ()=>{
    
        modal.style.display = "flex";
    
        document.getElementById("expQty").value = 1;
    
        document.getElementById("honorUserWrapper").style.display = "none";
        document.getElementById("kasbonNameWrapper").style.display = "none";
        document.getElementById("honorUserSelect").value = "";
        document.getElementById("kasbonNameSelect").value = "";
        await loadExpenseCategories();
        await loadHonorUsers();
        await loadKasbonMasterNames();
    });

    /* ===== DETECT HONOR / KASBON ===== */
    document.getElementById("expCategory")?.addEventListener("change", function(){
        const selected=String(this.value||'').trim().toLowerCase();
        const honorWrapper=document.getElementById("honorUserWrapper");
        const kasbonWrapper=document.getElementById("kasbonNameWrapper");
        if(honorWrapper) honorWrapper.style.display = selected==='honor' ? 'block' : 'none';
        if(kasbonWrapper) kasbonWrapper.style.display = selected==='kasbon' ? 'block' : 'none';
        if(selected!=='honor') document.getElementById("honorUserSelect").value='';
        if(selected!=='kasbon') document.getElementById("kasbonNameSelect").value='';
        if(selected==='kasbon') refreshKasbonExpenseSelect();
    });
    document.getElementById("kasbonNameSelect")?.addEventListener("change",function(){
        const name=String(this.selectedOptions?.[0]?.dataset?.name||'').trim();
        if(name) document.getElementById("expTitle").value=`Kasbon ${name}`;
    });

    document.getElementById("saveExpense")
    ?.addEventListener("click", async ()=>{

        const title = document.getElementById("expTitle").value;
        const category = document.getElementById("expCategory").value;
        const price = document.getElementById("expPrice").value;
        const qty = document.getElementById("expQty").value;
        const amount = document.getElementById("expAmount").value;
        const notes = document.getElementById("expNotes").value;
        const honorUserId = document.getElementById("honorUserSelect")?.value || null;
        const kasbonName = String(document.getElementById("kasbonNameSelect")?.selectedOptions?.[0]?.dataset?.name || "").trim();

        if(!title || !amount){
            alert("Isi semua data.");
            return;
        }

        const normalizedCategory = String(category || "").trim().toUpperCase();
        if(normalizedCategory === "HONOR" && !honorUserId){ alert("Pilih penerima honor."); return; }
        if(normalizedCategory === "KASBON" && !kasbonName){ alert("Pilih nama Kasbon."); return; }
        if(normalizedCategory === "KASBON" && kasbonName.toUpperCase()==="UJANG"){ alert("UJANG bukan bagian dari Tim CEO."); return; }

        const { data: { user } } = await client.auth.getUser();

        const isHonor = category?.toLowerCase() === "honor";
        const isKasbon = category?.toLowerCase() === "kasbon";
        const finalTitle = isKasbon ? `Kasbon ${kasbonName}` : title;
        
        const { error } = await client
            .from("expenses")
            .insert([{
            title: finalTitle,
            category,
            price,
            qty,
            amount,
            notes,
            created_by: user.id,
            honor_user_id: isHonor ? honorUserId : null
        }]);

        if(error){
            alert("Gagal simpan pengeluaran.");
            return;
        }

        modal.style.display="none";
        await loadSummaryData();
        await loadFinance();
    });

   // ================= CLOSE MODAL =================
function closeExpenseModal(){
    if(modal){
        modal.style.display = "none";
    }

    document.getElementById("expTitle").value = "";
    document.getElementById("expAmount").value = "";
    document.getElementById("expNotes").value = "";
    document.getElementById("honorUserSelect").value = "";
    document.getElementById("honorUserWrapper").style.display = "none";
    if(document.getElementById("kasbonNameSelect")) document.getElementById("kasbonNameSelect").value = "";
    if(document.getElementById("kasbonNameWrapper")) document.getElementById("kasbonNameWrapper").style.display = "none";
}

document.getElementById("closeModal")
?.addEventListener("click", closeExpenseModal);

document.getElementById("expenseModal")
?.addEventListener("click", (e)=>{
    if(e.target.id === "expenseModal"){
        closeExpenseModal();
    }
});
}

/* ================= TAMBAH KATEGORI ================= */
document.getElementById("addCategoryBtn")
?.addEventListener("click", async ()=>{

  const name = prompt("Nama kategori baru:");
  if(!name) return;

  // cek apakah sudah ada
  const { data: existing } = await client
    .from("expense_categories")
    .select("*")
    .ilike("name", name)
    .maybeSingle();

  if(existing){
    // kalau ada → aktifkan lagi
    const { error } = await client
      .from("expense_categories")
      .update({ is_active: true })
      .eq("id", existing.id);

    if(error){
      alert("Gagal mengaktifkan kategori.");
      return;
    }

    alert("Kategori diaktifkan kembali.");
  } 
  else {
    // kalau belum ada → insert baru
    const { error } = await client
      .from("expense_categories")
      .insert([{ name, is_active:true }]);

    if(error){
      alert("Gagal tambah kategori");
      return;
    }

    alert("Kategori berhasil ditambahkan");
  }

  loadExpenseCategories();
});

/* ================= HAPUS KATEGORI ================= */
document.getElementById("deleteCategoryBtn")
?.addEventListener("click", async ()=>{

  const select = document.getElementById("expCategory");
  const selected = select.value;

  if(!selected){
    alert("Pilih kategori dulu.");
    return;
  }

  if(!confirm("Yakin hapus kategori ini?")) return;

  const { error } = await client
    .from("expense_categories")
    .update({ is_active:false })
    .eq("name", selected);

  if(error){
    alert("Gagal hapus kategori");
    return;
  }

  alert("Kategori berhasil dinonaktifkan");
  loadExpenseCategories();
});

/* ================= EXPORT ================= */
function setupExportButtons(){

    document.getElementById("exportExcel")
    ?.addEventListener("click", exportToCSV);

    document.getElementById("exportPDF")
    ?.addEventListener("click", generatePDF);
}

function formatSparepartCSV(sparepartJSON){

    if(!sparepartJSON) return "-";

    try{
        const parts = JSON.parse(sparepartJSON);

        if(!Array.isArray(parts)) return "-";

        return parts.map(p => 
            `${p.nama} x${p.qty} (${rupiah(p.harga)})`
        ).join(" | ");

    }catch{
        return "-";
    }
} 

function exportToCSV(){
    const start = document.getElementById("startDate")?.value;
    const end = document.getElementById("endDate")?.value;
    
    const isFilterActive = start && end;

const exportIncome = (isFilterActive
    ? filteredIncomeData
    : summaryIncomeData).filter(isHpService);

const exportExpense = isFilterActive
    ? filteredExpenseData
    : summaryExpenseData;

    let rows = [];
    let fileName = "laporan_keuangan.csv";

    if(currentTab==="income"){

        rows.push([
            "No",
            "Nama",
            "Alamat",
            "Metode",
            "Tanggal Masuk",
            "Status",
            "Tanggal Selesai",
            "Sparepart",
            "Dibayar Pelanggan",
            "Hak UJANG",
            "Pemasukan CEO",
            "Sisa",
            "Total"
        ]);

       exportIncome.forEach((o,i)=>{

        const total = Number(o.total || 0);
        const dibayar = Number(o.amount_paid || 0);
    
        const kembalian =
            dibayar > total
                ? dibayar - total
                : 0;
    
        rows.push([
            i+1,
            o.nama,
            o.alamat,
            o.metode,
            new Date(o.created_at).toLocaleDateString("id-ID"),
            o.status,
            o.tanggal_selesai
                ? new Date(o.tanggal_selesai).toLocaleDateString("id-ID")
                : "-",
            formatSparepartCSV(o.sparepart),
            dibayar,
            isUjangJob(o) ? getUjangShare(o).bagianUjang : 0,
            getCeoRecognizedIncome(o),
            o.remaining_amount,
            total
        ]);
    });
        fileName = "laporan_pemasukan.csv";
    }

    else if(currentTab==="expense"){

        rows.push([
            "No",
            "Judul",
            "Kategori",
            "Penerima",
            "Harga",
            "Qty",
            "Total",
            "Tanggal"
        ]);

        exportExpense.forEach((o,i)=>{
            rows.push([
                i+1,
                o.title,
                o.category,
                o.profiles?.full_name || "-",
                o.price,
                o.qty,
                o.amount,
                new Date(o.created_at).toLocaleDateString("id-ID")
            ]);
        });

        fileName = "laporan_pengeluaran.csv";
    }

    else if(currentTab==="debt"){

    rows.push([
        "No",
        "Nama",
        "Alamat",
        "Metode",
        "Tanggal Masuk",
        "Status Pembayaran",
        "Jatuh Tempo",
        "Sparepart",
        "Sudah Dibayar",
        "Sisa",
        "Total"
    ]);

    const debtData = (isFilterActive
    ? filteredIncomeData
    : summaryIncomeData
    ).filter(
        o => Number(o.remaining_amount || 0) > 0
    );
    
    debtData.forEach((o,i)=>{
        rows.push([
            i+1,
            o.nama,
            o.alamat,
            o.metode,
            new Date(o.created_at).toLocaleDateString("id-ID"),
            o.payment_status || "-",
            o.due_date
                ? new Date(o.due_date).toLocaleDateString("id-ID")
                : "-",
            formatSparepartCSV(o.sparepart),
            o.amount_paid,
            o.remaining_amount,
            o.total
        ]);
    });

    fileName = "laporan_piutang.csv";
}

else if(currentTab === "laptop"){
    const source = (isFilterActive ? filteredIncomeData : summaryIncomeData)
        .filter(isLaptopOrDrone);
    rows.push(["No","Nama","No HP","Alamat","Perangkat","Tanggal Masuk","Tanggal Selesai","Sparepart","Dibayar","Sisa","Total"]);
    source.forEach((o,i)=>rows.push([
        i+1,o.nama||"-",o.phone||"-",o.alamat||"-",o.tipe_model||o.brand||"-",
        o.created_at ? new Date(o.created_at).toLocaleDateString("id-ID") : "-",
        o.tanggal_selesai ? new Date(o.tanggal_selesai).toLocaleDateString("id-ID") : "-",
        formatSparepartCSV(o.sparepart),o.amount_paid||0,o.remaining_amount||0,o.total||0
    ]));
    fileName = "laporan_service_laptop_drone.csv";
}

else if(currentTab === "ujang"){
    rows.push([
        "No", "Pelanggan", "No HP", "Perangkat", "Sumber Pelanggan",
        "Tanggal Selesai", "Total Tagihan", "Transport", "Modal Sparepart",
        "Dasar Bagi Hasil", "Persen UJANG", "Persen CEO", "Bagian UJANG", "Bagian CEO"
    ]);

    const exportUjang = (isFilterActive ? filteredIncomeData : summaryIncomeData)
        .filter(o => String(o.teknisi || "").toUpperCase() === "UJANG");

    exportUjang.forEach((o,i)=>{
        const calc = getUjangShare(o);
        rows.push([
            i+1,
            o.nama || "-",
            o.phone || "-",
            [o.kategori_perangkat, o.tipe_model || o.brand].filter(Boolean).join(" - ") || "-",
            calc.sumber,
            o.tanggal_selesai ? new Date(o.tanggal_selesai).toLocaleDateString("id-ID") : "-",
            calc.total,
            calc.transport,
            calc.modalSparepart,
            calc.dasar,
            calc.persenUjang,
            calc.persenCeo,
            calc.bagianUjang,
            calc.bagianCeo
        ]);
    });

    fileName = "laporan_bagi_hasil_ujang.csv";
}

    let csv = "data:text/csv;charset=utf-8,";
    rows.forEach(r => {
    csv += r.map(v => `"${v}"`).join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ================= EXPORT PDF ================= */
function generatePDF(){
    window.print();
}

/* ================= LOGOUT ================= */
async function logout(){

  if(!client) return;

  await client.auth.signOut();
  localStorage.removeItem("userRole");
  window.location.href = "login.html";
}

document.getElementById("logoutBtn")
?.addEventListener("click", logout);

/* ================= MOBILE NAV PREMIUM ================= */
document.addEventListener("DOMContentLoaded", function(){

  const toggle = document.getElementById("menuToggle");
  const nav = document.querySelector(".top-nav");
  const overlay = document.getElementById("navOverlay");

  if(!toggle || !nav || !overlay) return;

  function openNav(){
    nav.classList.add("active");
    overlay.classList.add("active");
    document.body.classList.add("nav-open");
  }

  function closeNav(){
    nav.classList.remove("active");
    overlay.classList.remove("active");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", function(e){
    e.stopPropagation();
    if(nav.classList.contains("active")){
      closeNav();
    } else {
      openNav();
    }
  });

  overlay.addEventListener("click", closeNav);

  document.querySelectorAll(".nav-btn").forEach(function(btn){
    btn.addEventListener("click", closeNav);
  });

});

/* ================= BUKU BESAR MODAL UJANG ================= */
let ujangCapitalBalance = 0;
let ujangCapitalLedgerRows = [];
let ujangCapitalPage = 1;
const ujangCapitalPageSize = 5;

function ujangCapitalLabel(type){
    return ({
        MODAL_AWAL:"Modal Awal", MODAL_MASUK:"Tambah Modal", MODAL_SPAREPART:"Pemakaian Sparepart",
        PENGEMBALIAN_MODAL:"Pengembalian Modal", PENYESUAIAN:"Penyesuaian", PENARIKAN:"Penarikan"
    })[type] || type || "-";
}

function setCapitalText(id, value){ const el=document.getElementById(id); if(el) el.textContent=rupiah(value); }

function renderUjangCapitalLedger(){
    const tbody=document.getElementById("ujangCapitalLedger");
    const pageNumbers=document.getElementById("ujangCapitalPageNumbers");
    const prevBtn=document.getElementById("ujangCapitalPrevPage");
    const nextBtn=document.getElementById("ujangCapitalNextPage");
    if(!tbody) return;

    const rows=ujangCapitalLedgerRows;
    const totalPages=Math.max(1,Math.ceil(rows.length/ujangCapitalPageSize));
    if(ujangCapitalPage>totalPages) ujangCapitalPage=totalPages;
    if(ujangCapitalPage<1) ujangCapitalPage=1;

    if(!rows.length){
        tbody.innerHTML='<tr><td colspan="6">Belum ada mutasi modal UJANG.</td></tr>';
        if(pageNumbers) pageNumbers.innerHTML="";
        if(prevBtn) prevBtn.disabled=true;
        if(nextBtn) nextBtn.disabled=true;
        return;
    }

    // Data disimpan terbaru -> terlama. Saldo setiap baris adalah saldo sesudah transaksi tersebut.
    const totalBalance=rows.reduce((sum,r)=>sum+Number(r.signed_amount||0),0);
    let balanceAfter=totalBalance;
    const rowsWithBalance=rows.map(r=>{
        const item={...r,balance_after:balanceAfter};
        balanceAfter-=Number(r.signed_amount||0);
        return item;
    });

    const start=(ujangCapitalPage-1)*ujangCapitalPageSize;
    const pageRows=rowsWithBalance.slice(start,start+ujangCapitalPageSize);
    tbody.innerHTML=pageRows.map(r=>{
        const signed=Number(r.signed_amount||0);
        return `<tr><td>${r.created_at?new Date(r.created_at).toLocaleString("id-ID"):"-"}</td><td><span class="capital-ledger-type">${ujangCapitalLabel(r.transaction_type)}</span></td><td>${r.note||"-"}${r.service_order_id?`<small style="display:block">Order #${r.service_order_id}</small>`:""}</td><td class="capital-in">${signed>0?rupiah(signed):"-"}</td><td class="capital-out">${signed<0?rupiah(Math.abs(signed)):"-"}</td><td>${rupiah(r.balance_after)}</td></tr>`;
    }).join("");

    if(pageNumbers){
        pageNumbers.innerHTML="";
        for(let i=1;i<=totalPages;i++){
            const btn=document.createElement("button");
            btn.type="button";
            btn.textContent=i;
            if(i===ujangCapitalPage) btn.classList.add("active");
            btn.addEventListener("click",()=>{ujangCapitalPage=i;renderUjangCapitalLedger();});
            pageNumbers.appendChild(btn);
        }
    }
    if(prevBtn) prevBtn.disabled=ujangCapitalPage===1;
    if(nextBtn) nextBtn.disabled=ujangCapitalPage===totalPages;
}

async function loadUjangCapital(){
    const tbody=document.getElementById("ujangCapitalLedger");
    if(!tbody) return;
    tbody.innerHTML='<tr><td colspan="6">Memuat buku besar modal...</td></tr>';

    const { data:ledger, error } = await client.from("ujang_capital_ledger")
        .select("id,service_order_id,transaction_type,signed_amount,note,created_at")
        .order("created_at",{ascending:false}).order("id",{ascending:false});

    if(error){
        console.error("Gagal memuat ujang_capital_ledger:", error);
        tbody.innerHTML=`<tr><td colspan="6" class="capital-error">Gagal memuat buku besar: ${error.message || "query ledger gagal"}</td></tr>`;
        return;
    }

    const rows=ledger || [];
    ujangCapitalLedgerRows=rows;
    ujangCapitalPage=1;
    ujangCapitalBalance=rows.reduce((sum,r)=>sum+Number(r.signed_amount||0),0);
    const totalIn=rows.filter(r=>["MODAL_AWAL","MODAL_MASUK"].includes(r.transaction_type) || (r.transaction_type==="PENYESUAIAN" && Number(r.signed_amount)>0)).reduce((s,r)=>s+Math.max(0,Number(r.signed_amount||0)),0);
    const totalWithdraw=rows.filter(r=>r.transaction_type==="PENARIKAN").reduce((s,r)=>s+Math.abs(Number(r.signed_amount||0)),0);
    const used=rows.filter(r=>r.transaction_type==="MODAL_SPAREPART").reduce((s,r)=>s+Math.abs(Math.min(0,Number(r.signed_amount||0))),0)
        - rows.filter(r=>r.transaction_type==="PENGEMBALIAN_MODAL").reduce((s,r)=>s+Math.max(0,Number(r.signed_amount||0)),0);

    setCapitalText("ujangCapitalBalance",ujangCapitalBalance); setCapitalText("ujangCapitalModalBalance",ujangCapitalBalance);
    setCapitalText("ujangCapitalIn",totalIn); setCapitalText("ujangCapitalWithdraw",totalWithdraw); setCapitalText("ujangCapitalUsed",Math.max(0,used));
    renderUjangCapitalLedger();
}

document.getElementById("ujangCapitalPrevPage")?.addEventListener("click",()=>{
    if(ujangCapitalPage>1){ujangCapitalPage--;renderUjangCapitalLedger();}
});
document.getElementById("ujangCapitalNextPage")?.addEventListener("click",()=>{
    const totalPages=Math.max(1,Math.ceil(ujangCapitalLedgerRows.length/ujangCapitalPageSize));
    if(ujangCapitalPage<totalPages){ujangCapitalPage++;renderUjangCapitalLedger();}
});

function openUjangCapitalModal(){
    const modal=document.getElementById("ujangCapitalModal"); if(!modal) return;
    setCapitalText("ujangCapitalModalBalance",ujangCapitalBalance);
    document.getElementById("ujangCapitalAmount").value=""; document.getElementById("ujangCapitalNote").value="";
    const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset()); document.getElementById("ujangCapitalDate").value=now.toISOString().slice(0,16);
    modal.style.display="flex";
}
function closeUjangCapitalModal(){ const m=document.getElementById("ujangCapitalModal"); if(m)m.style.display="none"; }

async function saveUjangCapitalMutation(){
    const action=document.getElementById("ujangCapitalAction")?.value;
    const amount=Number(document.getElementById("ujangCapitalAmount")?.value||0);
    const note=document.getElementById("ujangCapitalNote")?.value?.trim();
    const dateValue=document.getElementById("ujangCapitalDate")?.value;
    if(amount<=0){ alert("Nominal harus lebih dari 0."); return; }
    if(!note){ alert("Catatan transaksi wajib diisi."); return; }
    if(["PENARIKAN","PENYESUAIAN_KELUAR"].includes(action) && amount>ujangCapitalBalance){ alert(`Saldo modal UJANG tidak cukup. Tersedia ${rupiah(ujangCapitalBalance)}.`); return; }
    const btn=document.getElementById("saveUjangCapital"); if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';}
    const transactionAt=dateValue ? new Date(dateValue).toISOString() : new Date().toISOString();
    const {error}=await client.rpc("mutate_ujang_capital",{p_action:action,p_amount:amount,p_note:note,p_transaction_at:transactionAt});
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Simpan Mutasi';}
    if(error){ console.error("mutate_ujang_capital gagal:",error); alert("Gagal menyimpan mutasi modal: "+(error.message||"RPC gagal")); return; }
    closeUjangCapitalModal(); await loadUjangCapital();
}

function setupUjangCapital(){
    document.getElementById("manageUjangCapital")?.addEventListener("click",openUjangCapitalModal);
    document.getElementById("refreshUjangCapital")?.addEventListener("click",loadUjangCapital);
    document.getElementById("closeUjangCapitalModal")?.addEventListener("click",closeUjangCapitalModal);
    document.getElementById("cancelUjangCapitalModal")?.addEventListener("click",closeUjangCapitalModal);
    document.getElementById("saveUjangCapital")?.addEventListener("click",saveUjangCapitalMutation);
    document.getElementById("ujangCapitalModal")?.addEventListener("click",e=>{if(e.target.id==="ujangCapitalModal")closeUjangCapitalModal();});
    loadUjangCapital();
}

document.addEventListener("DOMContentLoaded", setupUjangCapital);


/* ================= LAPTOP & DRONE FINANCE ================= */
let deviceFinanceSettings={bmn_percent:25,ppn_percent:11};
async function loadDeviceFinanceSettings(){
 const {data,error}=await client.from("laptop_drone_settings").select("*").eq("id",1).maybeSingle();
 if(error){console.error("Gagal memuat pengaturan Laptop & Drone:",error);return;}
 if(data) deviceFinanceSettings={bmn_percent:Number(data.bmn_percent??25),ppn_percent:Number(data.ppn_percent??11)};
 const b=document.getElementById("deviceDefaultBmn"),p=document.getElementById("deviceDefaultPpn"); if(b)b.textContent=deviceFinanceSettings.bmn_percent;if(p)p.textContent=deviceFinanceSettings.ppn_percent;
}
function calcDeviceFinance(){
 const capital=Math.max(0,Number(document.getElementById("deviceCalcCapital")?.value||0));
 const profit=Math.max(0,Number(document.getElementById("deviceCalcProfit")?.value||0));
 const bmnPct=Math.max(0,Number(document.getElementById("deviceCalcBmnPct")?.value||0));
 const ppnPct=Math.max(0,Number(document.getElementById("deviceCalcPpnPct")?.value||0));
 const hargaCeo=capital+profit; const hakBmn=Math.round(hargaCeo*bmnPct/100); const subtotal=hargaCeo+hakBmn; const ppn=Math.round(subtotal*ppnPct/100); const total=subtotal+ppn;
 [["devicePreviewCeoPrice",hargaCeo],["devicePreviewBmn",hakBmn],["devicePreviewPpn",ppn],["devicePreviewTotal",total]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=rupiah(v)});
 return {capital,profit,bmnPct,ppnPct,hargaCeo,hakBmn,subtotal,ppn,total};
}
function closeDeviceModal(id){const m=document.getElementById(id);if(m)m.style.display="none";}
async function openDeviceCalc(orderId){
 const row=fullLaptopData.find(r=>String(r.id)===String(orderId)); if(!row)return; const f=row._device_finance;
 document.getElementById("deviceCalcOrderId").value=row.id; document.getElementById("deviceCalcTitle").textContent=`${row.kategori_perangkat||"Perangkat"} · ${row.nama||"-"}`;
 document.getElementById("deviceCalcCapital").value=f?.modal_teknisi??""; document.getElementById("deviceCalcProfit").value=f?.keuntungan_ceo??"";
 document.getElementById("deviceCalcBmnPct").value=f?.bmn_percent??deviceFinanceSettings.bmn_percent; document.getElementById("deviceCalcPpnPct").value=f?.ppn_percent??deviceFinanceSettings.ppn_percent; document.getElementById("deviceCalcNote").value=f?.notes??""; calcDeviceFinance();
 document.getElementById("deviceCalcModal").style.display="flex";
}
async function saveDeviceCalc(){
 const serviceOrderId=document.getElementById("deviceCalcOrderId")?.value; const v=calcDeviceFinance(); if(!serviceOrderId)return;
 const {data:{user}}=await client.auth.getUser(); const payload={service_order_id:Number(serviceOrderId),modal_teknisi:v.capital,keuntungan_ceo:v.profit,harga_ceo:v.hargaCeo,bmn_percent:v.bmnPct,hak_bmn:v.hakBmn,subtotal:v.subtotal,ppn_percent:v.ppnPct,ppn_amount:v.ppn,total_tagihan:v.total,notes:document.getElementById("deviceCalcNote")?.value?.trim()||null,updated_by:user?.id||null,updated_at:new Date().toISOString()};
 const {error}=await client.from("laptop_drone_finance").upsert(payload,{onConflict:"service_order_id"}); if(error){alert("Gagal menyimpan perhitungan: "+error.message);return;} closeDeviceModal("deviceCalcModal"); await loadFinance();
}
function setupDeviceFinance(){
 loadDeviceFinanceSettings();
 document.getElementById("deviceFinanceSettingsBtn")?.addEventListener("click",()=>{document.getElementById("deviceSettingBmn").value=deviceFinanceSettings.bmn_percent;document.getElementById("deviceSettingPpn").value=deviceFinanceSettings.ppn_percent;document.getElementById("deviceSettingsModal").style.display="flex";});
 document.getElementById("saveDeviceSettings")?.addEventListener("click",async()=>{const b=Math.max(0,Number(document.getElementById("deviceSettingBmn").value||0)),p=Math.max(0,Number(document.getElementById("deviceSettingPpn").value||0));const {data:{user}}=await client.auth.getUser();const {error}=await client.from("laptop_drone_settings").upsert({id:1,bmn_percent:b,ppn_percent:p,updated_by:user?.id||null,updated_at:new Date().toISOString()});if(error){alert("Gagal menyimpan pengaturan: "+error.message);return;}deviceFinanceSettings={bmn_percent:b,ppn_percent:p};await loadDeviceFinanceSettings();closeDeviceModal("deviceSettingsModal");});
 ["closeDeviceSettingsModal","cancelDeviceSettings"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>closeDeviceModal("deviceSettingsModal")));
 ["closeDeviceCalcModal","cancelDeviceCalc"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>closeDeviceModal("deviceCalcModal")));
 ["deviceCalcCapital","deviceCalcProfit","deviceCalcBmnPct","deviceCalcPpnPct"].forEach(id=>document.getElementById(id)?.addEventListener("input",calcDeviceFinance));
 document.getElementById("saveDeviceCalc")?.addEventListener("click",saveDeviceCalc);
 document.getElementById("laptopTable")?.addEventListener("click",e=>{const btn=e.target.closest("[data-device-order]");if(btn)openDeviceCalc(btn.dataset.deviceOrder);});
}
document.addEventListener("DOMContentLoaded",setupDeviceFinance);
