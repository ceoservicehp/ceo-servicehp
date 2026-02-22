"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

let financeChart;
let currentTab = "summary";
let incomeData = [];
let expenseData = [];

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async ()=>{

    if(!db){
        alert("Supabase belum terhubung");
        return;
    }

    await checkFinanceAccess();

    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString("id-ID",{
            weekday:"long",
            day:"2-digit",
            month:"long",
            year:"numeric"
        });

    setupTabs();
    setupFilters();
    setupExpenseForm();
    setupExportButtons();

    await loadFinance();
});


/* ================= ROLE LOCK ================= */
async function checkFinanceAccess(){

    const { data: userData } = await db.auth.getUser();
    const user = userData?.user;

    if(!user){
        window.location.href = "login.html";
        return;
    }

    const { data } = await db
        .from("admin_users")
        .select("role")
        .eq("email", user.email)
        .single();

    if(!data){
        alert("Akun tidak terdaftar sebagai admin.");
        window.location.href = "dapur.html";
        return;
    }

    if(data.role !== "admin" && data.role !== "superadmin"){
        alert("Halaman keuangan hanya untuk admin.");
        window.location.href = "dashboard.html";
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
            renderByTab();
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
        start = end = today.toISOString().split("T")[0];
    }

    if(type==="week"){
        const first = new Date(today);
        const day = today.getDay();
        const diff = today.getDate() - day + (day===0?-6:1);
        first.setDate(diff);
        start = first.toISOString().split("T")[0];
        end = today.toISOString().split("T")[0];
    }

    if(type==="month"){
        const first = new Date(today.getFullYear(), today.getMonth(),1);
        start = first.toISOString().split("T")[0];
        end = today.toISOString().split("T")[0];
    }

    document.getElementById("startDate").value = start;
    document.getElementById("endDate").value = end;

    loadFinance();
}


/* ================= LOAD DATA ================= */
async function loadFinance(){

    const { data:income } = await db
        .from("service_orders")
        .select("*")
        .eq("status","selesai");

    const { data:expense } = await db
        .from("expenses")
        .select("*");

    incomeData = income || [];
    expenseData = expense || [];

    filterByDate();
}


function filterByDate(){

    const start = document.getElementById("startDate")?.value;
    const end = document.getElementById("endDate")?.value;

    let filteredIncome = incomeData;
    let filteredExpense = expenseData;

    if(start && end){

        filteredIncome = incomeData.filter(o=>{
            const d = o.created_at.split("T")[0];
            return d >= start && d <= end;
        });

        filteredExpense = expenseData.filter(o=>{
            const d = o.created_at.split("T")[0];
            return d >= start && d <= end;
        });
    }

    calculateSummary(filteredIncome, filteredExpense);
    renderByTab(filteredIncome, filteredExpense);
}


/* ================= SUMMARY ================= */
function calculateSummary(income, expense){

    const totalIncome = income.reduce((a,b)=>a+(Number(b.total)||0),0);
    const totalExpense = expense.reduce((a,b)=>a+(Number(b.amount)||0),0);

    const net = totalIncome - totalExpense;
    const margin = totalIncome>0
        ? ((net/totalIncome)*100).toFixed(1)
        : 0;

    document.getElementById("totalIncome").textContent = rupiah(totalIncome);
    document.getElementById("totalExpense").textContent = rupiah(totalExpense);
    document.getElementById("netProfit").textContent = rupiah(net);
    document.getElementById("profitMargin").textContent = margin+"%";

    generateChart(totalIncome,totalExpense);
}


/* ================= CHART ================= */
function generateChart(income,expense){

    const ctx=document.getElementById("financeChart");

    if(financeChart){
        financeChart.destroy();
    }

    financeChart = new Chart(ctx,{
        type:'doughnut',
        data:{
            labels:["Pemasukan","Pengeluaran"],
            datasets:[{
                data:[income,expense]
            }]
        },
        options:{ responsive:true }
    });
}


/* ================= RENDER TABLE ================= */
function renderByTab(income = incomeData, expense = expenseData){

    const tbody = document.getElementById("financeTable");
    const reportSection = document.getElementById("reportSection");
    const tableWrapper = document.querySelector(".table-wrapper");

    // default state
    reportSection.style.display = "none";
    tableWrapper.style.display = "block";
    tbody.innerHTML = "";

    /* ================= INCOME ================= */
    if(currentTab==="income"){

        if(income.length===0){
            tbody.innerHTML=`<tr><td colspan="4">Belum ada pemasukan</td></tr>`;
            return;
        }

        income.forEach((row,i)=>{
            tbody.innerHTML+=`
            <tr>
                <td>${i+1}</td>
                <td>${row.nama}</td>
                <td>${new Date(row.created_at).toLocaleDateString("id-ID")}</td>
                <td style="color:#27ae60;font-weight:600;">
                    ${rupiah(row.total)}
                </td>
            </tr>`;
        });
    }

    /* ================= EXPENSE ================= */
    else if(currentTab==="expense"){

        if(expense.length===0){
            tbody.innerHTML=`<tr><td colspan="4">Belum ada pengeluaran</td></tr>`;
            return;
        }

        expense.forEach((row,i)=>{
            tbody.innerHTML+=`
            <tr>
                <td>${i+1}</td>
                <td>${row.title}</td>
                <td>${new Date(row.created_at).toLocaleDateString("id-ID")}</td>
                <td style="color:#e74c3c;font-weight:600;">
                    ${rupiah(row.amount)}
                </td>
            </tr>`;
        });
    }

    /* ================= REPORT MODE ================= */
    else if(currentTab==="report"){

        tableWrapper.style.display = "none";
        reportSection.style.display = "block";

        renderReport(income, expense);
    }

    /* ================= SUMMARY MODE ================= */
    else if(currentTab==="summary"){
        tbody.innerHTML=`
        <tr>
            <td colspan="4">
            Gunakan tab Pemasukan atau Pengeluaran untuk melihat detail.
            </td>
        </tr>`;
    }
}

/* ================= EXPENSE MODAL ================= */
function setupExpenseForm(){

    const modal=document.getElementById("expenseModal");

    document.getElementById("addExpenseBtn")
    ?.addEventListener("click",()=> modal.style.display="flex");

    document.getElementById("closeModal")
    ?.addEventListener("click",()=> modal.style.display="none");

    document.getElementById("saveExpense")
    ?.addEventListener("click",async()=>{

        const title=document.getElementById("expTitle").value;
        const category=document.getElementById("expCategory").value;
        const amount=document.getElementById("expAmount").value;
        const notes=document.getElementById("expNotes").value;

        if(!title || !amount){
            alert("Isi semua data.");
            return;
        }

        const user = await db.auth.getUser();

        const {error}=await db.from("expenses").insert([{
            title,
            category,
            amount,
            notes,
            created_by: user.data.user.id
        }]);

        if(error){
            alert("Gagal simpan pengeluaran.");
            return;
        }

        modal.style.display="none";
        loadFinance();
    });
}


/* ================= EXPORT ================= */
function setupExportButtons(){

    document.getElementById("exportExcel")
    ?.addEventListener("click", exportToCSV);

    document.getElementById("exportPDF")
    ?.addEventListener("click", generatePDF);
}

function exportToCSV(){

    let rows = [];

    if(currentTab==="income"){
        rows = incomeData.map(o=>[o.nama,o.total,o.created_at]);
    }
    else if(currentTab==="expense"){
        rows = expenseData.map(o=>[o.title,o.category,o.amount,o.created_at]);
    }
    else{
        alert("Pilih tab Pemasukan atau Pengeluaran dulu.");
        return;
    }

    let csv="data:text/csv;charset=utf-8,";
    rows.forEach(r=> csv+=r.join(",")+"\n");

    const link=document.createElement("a");
    link.href=encodeURI(csv);
    link.download="laporan_keuangan.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ================= LAPORAN ================= */
function renderReport(income, expense){

    const totalIncome = income.reduce((a,b)=>a+(Number(b.total)||0),0);
    const totalExpense = expense.reduce((a,b)=>a+(Number(b.amount)||0),0);
    const net = totalIncome-totalExpense;
    const margin = totalIncome>0
        ? ((net/totalIncome)*100).toFixed(1)
        : 0;

    document.getElementById("reportIncome").textContent = rupiah(totalIncome);
    document.getElementById("reportExpense").textContent = rupiah(totalExpense);
    document.getElementById("reportProfit").textContent = rupiah(net);
    document.getElementById("reportMargin").textContent = margin+"%";

    const breakdown = {};
    expense.forEach(e=>{
        breakdown[e.category] = (breakdown[e.category]||0) + Number(e.amount);
    });

    const ul = document.getElementById("expenseBreakdown");
    ul.innerHTML = "";

    Object.keys(breakdown).forEach(cat=>{
        ul.innerHTML += `
            <li>
              ${cat} : <strong>${rupiah(breakdown[cat])}</strong>
            </li>
        `;
    });

    const start = document.getElementById("startDate").value || "-";
    const end = document.getElementById("endDate").value || "-";

    document.getElementById("reportPeriod").textContent =
        "Periode: " + start + " s/d " + end;
}
function generatePDF(){
    window.print(); // versi ringan & stabil
}
