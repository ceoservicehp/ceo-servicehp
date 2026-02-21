"use strict";

const db = window.supabaseClient;

let allAdmins = [];
let selectedAction = null;
let selectedUserId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await checkSuperAdmin();
  await loadAdmins();
  initFilters();
  initModal();
});

/* ================= SECURITY CHECK ================= */
async function checkSuperAdmin(){

  const { data } = await db.auth.getSession();

  if(!data?.session){
    window.location.href = "login.html";
    return;
  }

  const email = data.session.user.email;

  const { data: roleData } = await db
    .from("admin_users")
    .select("role,is_active")
    .eq("email", email)
    .maybeSingle();

  if(!roleData || roleData.role !== "superadmin" || !roleData.is_active){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
  }
}

/* ================= LOAD DATA ================= */
async function loadAdmins(){

  const tbody = document.getElementById("adminTable");

  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> Memuat...
      </td>
    </tr>
  `;

  const { data, error } = await db
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    tbody.innerHTML = `<tr><td colspan="9">Error load data</td></tr>`;
    return;
  }

  allAdmins = data || [];
  renderTable(allAdmins);
}

/* ================= RENDER TABLE ================= */
function renderTable(data){

  const tbody = document.getElementById("adminTable");

  if(!data || data.length === 0){
    tbody.innerHTML = `<tr><td colspan="9">Tidak ada data</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  data.forEach((admin, index)=>{

    const roleClass =
      admin.role === "superadmin" ? "role-super" :
      admin.role === "admin" ? "role-admin" :
      "role-staff";

    tbody.innerHTML += `
      <tr>
        <td>${index+1}</td>
        <td>${admin.full_name ?? "-"}</td>
        <td>${admin.email}</td>
        <td>${admin.phone ?? "-"}</td>
        <td>${admin.position ?? "-"}</td>
        <td>
          <span class="role-badge ${roleClass}">
            ${admin.role}
          </span>
        </td>
        <td>
          <span class="badge ${admin.is_active ? 'badge-active':'badge-inactive'}">
            ${admin.is_active ? 'Aktif':'Nonaktif'}
          </span>
        </td>
        <td>${admin.approved_by ?? '-'}</td>
        <td>
          ${
            !admin.is_active
            ? `<button class="action-btn btn-approve"
                 data-id="${admin.id}"
                 data-action="approve">
                 Approve
               </button>`
            : `<button class="action-btn btn-disable"
                 data-id="${admin.id}"
                 data-action="disable">
                 Nonaktifkan
               </button>`
          }
        </td>
      </tr>
    `;
  });

  bindActionButtons();
}

/* ================= BIND BUTTON EVENTS ================= */
function bindActionButtons(){

  document.querySelectorAll(".action-btn")
    .forEach(btn=>{
      btn.addEventListener("click", e=>{
        selectedUserId = e.target.dataset.id;
        selectedAction = e.target.dataset.action;

        showConfirmModal(selectedAction);
      });
    });
}

/* ================= FILTER & SEARCH ================= */
function initFilters(){

  document.getElementById("searchAdmin")
    ?.addEventListener("input", e=>{
      const keyword = e.target.value.toLowerCase();

      const filtered = allAdmins.filter(a =>
        a.full_name?.toLowerCase().includes(keyword) ||
        a.email?.toLowerCase().includes(keyword)
      );

      renderTable(filtered);
    });

  document.getElementById("filterStatus")
    ?.addEventListener("change", e=>{
      applyFilters();
    });

  document.getElementById("filterRole")
    ?.addEventListener("change", e=>{
      applyFilters();
    });

  document.getElementById("refreshBtn")
    ?.addEventListener("click", loadAdmins);
}

function applyFilters(){

  const status = document.getElementById("filterStatus").value;
  const role = document.getElementById("filterRole").value;

  let filtered = [...allAdmins];

  if(status !== "all"){
    filtered = filtered.filter(a =>
      status === "active" ? a.is_active : !a.is_active
    );
  }

  if(role !== "all"){
    filtered = filtered.filter(a => a.role === role);
  }

  renderTable(filtered);
}

/* ================= MODAL ================= */
function initModal(){

  document.getElementById("confirmYes")
    .addEventListener("click", executeAction);

  document.getElementById("confirmNo")
    .addEventListener("click", closeModal);
}

function showConfirmModal(action){

  const title = document.getElementById("confirmTitle");
  const text = document.getElementById("confirmText");

  if(action === "approve"){
    title.textContent = "Approve Akun";
    text.textContent = "Setujui dan aktifkan akun ini?";
  }else{
    title.textContent = "Nonaktifkan Akun";
    text.textContent = "Nonaktifkan akun ini?";
  }

  document.getElementById("confirmModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("confirmModal").style.display = "none";
}

/* ================= EXECUTE ACTION ================= */
async function executeAction(){

  if(!selectedUserId) return;

  const { data: session } = await db.auth.getSession();
  const approver = session.session.user.email;

  if(selectedAction === "approve"){
    await db
      .from("admin_users")
      .update({
        is_active:true,
        approved_by: approver
      })
      .eq("id", selectedUserId);
  }

  if(selectedAction === "disable"){
    await db
      .from("admin_users")
      .update({
        is_active:false
      })
      .eq("id", selectedUserId);
  }

  closeModal();
  loadAdmins();
}
