"use strict";

const db = window.supabaseClient;

let allAdmins = [];
let selectedUserId = null;
let selectedAction = null;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await checkSuperAdmin();
  await loadAdmins();
  initFilters();
  initModal();
});

/* ================= SECURITY ================= */
async function checkSuperAdmin(){

  const { data } = await db.auth.getSession();

  if(!data?.session){
    window.location.href = "login.html";
    return;
  }

  const userId = data.session.user.id;

  const { data: roleData } = await db
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if(!roleData || roleData.role !== "superadmin" || !roleData.is_active){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
    return;
  }
}

/* ================= LOAD DATA (JOIN) ================= */
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
  .select(`
    id,
    user_id,
    nama,
    email,
    phone,
    position,
    role,
    is_active,
    approved_by,
    created_at
  `)
  .order("created_at", { ascending: false });

  if(error){
    tbody.innerHTML = `<tr><td colspan="9">Error load data</td></tr>`;
    return;
  }

  allAdmins = data || [];
  renderTable(allAdmins);
}

/* ================= RENDER ================= */
function renderTable(data){

  const tbody = document.getElementById("adminTable");

  if(!data.length){
    tbody.innerHTML = `<tr><td colspan="9">Tidak ada data</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  data.forEach((admin, index)=>{

    const profile = admin.profiles || {};

    const statusBadge = admin.is_active
      ? `<span class="badge badge-active">Aktif</span>`
      : `<span class="badge badge-inactive">Nonaktif</span>`;

    tbody.innerHTML += `
      <tr>
        <td>${index+1}</td>
        <td>${profile.full_name ?? "-"}</td>
        <td>${profile.email ?? "-"}</td>
        <td>${profile.phone ?? "-"}</td>
        <td>${profile.position ?? "-"}</td>
        <td>${admin.role}</td>
        <td>${statusBadge}</td>
        <td>${admin.approved_by ?? "-"}</td>
        <td>
          <button class="action-btn btn-approve"
            data-id="${admin.id}"
            data-action="toggle">
            ${admin.is_active ? "Nonaktifkan":"Aktifkan"}
          </button>

          <button class="action-btn btn-delete"
            data-id="${admin.id}"
            data-action="delete">
            Hapus
          </button>
        </td>
      </tr>
    `;
  });

  bindActionButtons();
}

/* ================= BUTTON ACTION ================= */
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

  if(action === "delete"){
    title.textContent = "Hapus Akun";
    text.textContent = "Yakin ingin menghapus akun ini?";
  }else{
    title.textContent = "Ubah Status";
    text.textContent = "Yakin ingin mengubah status akun ini?";
  }

  document.getElementById("confirmModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("confirmModal").style.display = "none";
}

/* ================= EXECUTE ================= */
async function executeAction(){

  if(!selectedUserId) return;

  if(selectedAction === "toggle"){

    const user = allAdmins.find(a=>a.id===selectedUserId);

    await db.from("admin_users")
      .update({ is_active: !user.is_active })
      .eq("id", selectedUserId);
  }

  if(selectedAction === "delete"){
    await db.from("admin_users")
      .delete()
      .eq("id", selectedUserId);
  }

  closeModal();
  loadAdmins();
}

/* ================= FILTER ================= */
function initFilters(){

  document.getElementById("searchAdmin")
    ?.addEventListener("input", applyFilters);

  document.getElementById("filterStatus")
    ?.addEventListener("change", applyFilters);

  document.getElementById("filterRole")
    ?.addEventListener("change", applyFilters);

  document.getElementById("refreshBtn")
    ?.addEventListener("click", loadAdmins);
}

function applyFilters(){

  const keyword = document.getElementById("searchAdmin").value.toLowerCase();
  const status = document.getElementById("filterStatus").value;
  const role = document.getElementById("filterRole").value;

  let filtered = [...allAdmins];

  if(keyword){
    filtered = filtered.filter(a =>
      a.profiles?.full_name?.toLowerCase().includes(keyword) ||
      a.profiles?.email?.toLowerCase().includes(keyword)
    );
  }

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
