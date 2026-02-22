"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

let financeChart;
let currentTab = "summary";
let incomeData = [];
let expenseData = [];

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

    setupTabs();
    setupFilters();
    await loadFinance();
});


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
            const range = btn.dataset.range;
            applyQuickFilter(range);
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


/* ================= setup Expense Form ================= */
function setupExpenseForm(){

const modal=document.getElementById("expenseModal");

document.getElementById("addExpenseBtn")
?.addEventListener("click",()=>{
    modal.style.display="flex";
});

document.getElementById("closeModal")
?.addEventListener("click",()=>{
    modal.style.display="none";
});

document.getElementById("saveExpense")
?.addEventListener("click",async()=>{

    const title=document.getElementById("expTitle").value;
    const category=document.getElementById("expCategory").value;
    const amount=document.getElementById("expAmount").value;
    const notes=document.getElementById("expNotes").value;

    if(!title || !amount){
        alert("Isi semua data");
        return;
    }

    const {error}=await db.from("expenses").insert([{
        title,
        category,
        amount,
        notes
    }]);

    if(error){
        alert("Gagal simpan");
        return;
    }

    modal.style.display="none";
    loadFinance();
});
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

    const totalIncome = income
        .reduce((a,b)=>a+(Number(b.total)||0),0);

    const totalExpense = expense
        .reduce((a,b)=>a+(Number(b.amount)||0),0);

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
        options:{
            responsive:true
        }
    });
}


/* ================= RENDER BY TAB ================= */
function renderByTab(income = incomeData, expense = expenseData){

    const tbody=document.getElementById("financeTable");

    tbody.innerHTML="";

    if(currentTab==="income"){
        if(income.length===0){
            tbody.innerHTML=`<tr><td colspan="4">Belum ada pemasukan</td></tr>`;
            return;
        }

        income.forEach((row,i)=>{
            const tanggal = new Date(row.created_at)
            .toLocaleDateString("id-ID");

            tbody.innerHTML+=`
            <tr>
                <td>${i+1}</td>
                <td>${row.nama}</td>
                <td>${tanggal}</td>
                <td style="color:#27ae60;font-weight:600;">
                    ${rupiah(row.total)}
                </td>
            </tr>`;
        });
    }

    else if(currentTab==="expense"){
        if(expense.length===0){
            tbody.innerHTML=`<tr><td colspan="4">Belum ada pengeluaran</td></tr>`;
            return;
        }

        expense.forEach((row,i)=>{
            const tanggal = new Date(row.created_at)
            .toLocaleDateString("id-ID");

            tbody.innerHTML+=`
            <tr>
                <td>${i+1}</td>
                <td>${row.title}</td>
                <td>${tanggal}</td>
                <td style="color:#e74c3c;font-weight:600;">
                    ${rupiah(row.amount)}
                </td>
            </tr>`;
        });
    }

    else{
        tbody.innerHTML=`
        <tr>
            <td colspan="4">
            Gunakan tab untuk melihat detail pemasukan atau pengeluaran.
            </td>
        </tr>`;
    }
}
