"use strict";

const client = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
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

let filteredIncomeData = [];
let filteredExpenseData = [];

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
    setupExportButtons();

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

    const { data:income } = await client
        .from("service_orders")
        .select("*")
        .eq("status","selesai");

   const { data:expense } = await client
    .from("expenses")
    .select(`
        *,
        profiles:honor_user_id(full_name)
    `);

    incomeData = income || [];
    expenseData = expense || [];

    filterByDate();
}


function filterByDate(){

    const start = document.getElementById("startDate")?.value;
    const end = document.getElementById("endDate")?.value;

    filteredIncomeData = incomeData;
    filteredExpenseData = expenseData;

    if(start && end){

        filteredIncomeData = incomeData.filter(o=>{
            const d = o.created_at.split("T")[0];
            return d >= start && d <= end;
        });

        filteredExpenseData = expenseData.filter(o=>{
            const d = o.created_at.split("T")[0];
            return d >= start && d <= end;
        });
    }

    renderByTab(filteredIncomeData, filteredExpenseData);
    updateFinanceCards(filteredIncomeData, filteredExpenseData);
}

/* ================= UPDATE FINANCE CARDS ================= */
function updateFinanceCards(income, expense){

    const totalIncome = income.reduce((sum,row)=>
        sum + (Number(row.amount_paid) || 0),0);

    const totalExpense = expense.reduce((sum,row)=>
        sum + (Number(row.amount) || 0),0);

    const profit = totalIncome - totalExpense;

    const margin = totalIncome > 0
        ? ((profit / totalIncome) * 100).toFixed(1)
        : 0;

    const incomeEl = document.getElementById("totalIncome");
    const expenseEl = document.getElementById("totalExpense");
    const profitEl = document.getElementById("totalProfit");
    const marginEl = document.getElementById("totalMargin");

    if(incomeEl) incomeEl.textContent = rupiah(totalIncome);
    if(expenseEl) expenseEl.textContent = rupiah(totalExpense);
    if(profitEl) profitEl.textContent = rupiah(profit);
    if(marginEl) marginEl.textContent = margin + "%";
}

/* ================= RENDER TABLE ================= */
function renderByTab(income = incomeData, expense = expenseData){

    const incomeWrapper = document.getElementById("incomeTableWrapper");
    const expenseWrapper = document.getElementById("expenseTableWrapper");

    if(incomeWrapper) incomeWrapper.style.display = "none";
    if(expenseWrapper) expenseWrapper.style.display = "none";

    /* ================= INCOME ================= */
   if(currentTab === "income"){

    if(incomeWrapper) incomeWrapper.style.display = "block";
    if(expenseWrapper) expenseWrapper.style.display = "none";

    const tbody = document.getElementById("incomeTable");
    tbody.innerHTML = "";

   income.forEach((row,i)=>{

    const sparepartList = formatSparepart(row.sparepart); // ← WAJIB ADA

    tbody.innerHTML += `
    <tr>

        <td>${i+1}</td>
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
        <td>

        <div style="color:#27ae60;font-weight:700;">
        Dibayar: ${rupiah(row.amount_paid || 0)}
        </div>
        
        <div style="color:#e74c3c;font-size:12px;">
        Sisa: ${rupiah(row.remaining_amount || 0)}
        </div>
        
        <div style="font-size:12px;color:#666;">
        Total: ${rupiah(row.total || 0)}
        </div>
        
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
            <td>${i+1}</td>
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
            <option value="${user.id}">
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
    
        // reset honor wrapper
        document.getElementById("honorUserWrapper").style.display = "none";
        document.getElementById("honorUserSelect").value = "";
    
        await loadExpenseCategories();
        await loadHonorUsers();
    });

    /* ===== DETECT HONOR ===== */
    document.getElementById("expCategory")
    ?.addEventListener("change", function(){
    
        const wrapper = document.getElementById("honorUserWrapper");
        if(!wrapper) return;
    
        const selected = this.value?.toLowerCase();
    
        if(selected === "honor"){
            wrapper.style.display = "block";
        }else{
            wrapper.style.display = "none";
            document.getElementById("honorUserSelect").value = "";
        }
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

        if(!title || !amount){
            alert("Isi semua data.");
            return;
        }

        if(category?.toUpperCase() === "HONOR" && !honorUserId){
            alert("Pilih penerima honor.");
            return;
        }

        const { data: { user } } = await client.auth.getUser();

        const isHonor = category?.toLowerCase() === "honor";
        
        const { error } = await client
            .from("expenses")
            .insert([{
            title,
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
        loadFinance();
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

function exportToCSV(){

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
            "Dibayar",
            "Sisa",
            "Total"
        ]);

        filteredIncomeData.forEach((o,i)=>{
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
                o.sparepart,
                o.amount_paid,
                o.remaining_amount,
                o.total
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

        filteredExpenseData.forEach((o,i)=>{
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

    let csv = "data:text/csv;charset=utf-8,";
    rows.forEach(r => csv += r.join(",") + "\n");

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
