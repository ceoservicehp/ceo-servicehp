"use strict";

const db = window.supabaseClient;

let allAdmins = [];
let selectedUserId = null;
let selectedAction = null;
let currentUserId = null;

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

  currentUserId = data.session.user.id;

  const { data: roleData } = await db
    .from("admin_users")
    .select("role, is_active")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if(!roleData || roleData.role !== "superadmin" || !roleData.is_active){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
  }
}

/* ================= LOAD DATA ================= */
async function loadAdmins(){

  const tbody = document.getElementById("adminTable");

  tbody.innerHTML = `<tr><td colspan="9">Memuat...</td></tr>`;

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

    const statusBadge = admin.is_active
      ? `<span class="badge badge-active">Aktif</span>`
      : `<span class="badge badge-inactive">Nonaktif</span>`;

   const roleDropdown = `
    <select class="role-select" data-id="${admin.id}">
      <option value="staff" ${admin.role==="staff"?"selected":""}>Staff</option>
      <option value="admin" ${admin.role==="admin"?"selected":""}>Admin</option>
      <option value="superadmin" ${admin.role==="superadmin"?"selected":""}>Superadmin</option>
    </select>
  `;
    
    const positionInput = `
      <input type="text" 
        class="position-input"
        data-id="${admin.id}"
        value="${admin.position ?? ""}">
    `;

    tbody.innerHTML += `
      <tr>
        <td>${index+1}</td>
        <td>${admin.nama ?? "-"}</td>
        <td>${admin.email ?? "-"}</td>
        <td>${admin.phone ?? "-"}</td>
        <td>${positionInput}</td>
        <td>${roleDropdown}</td>
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
  bindEditableFields();
}

/* ================= EDIT ROLE & POSITION ================= */
function bindEditableFields(){

  document.querySelectorAll(".role-select")
    .forEach(select=>{
      select.addEventListener("change", async (e)=>{
        const id = e.target.dataset.id;
        const newRole = e.target.value;

        await db.from("admin_users")
          .update({ role: newRole })
          .eq("id", id);

        loadAdmins();
      });
    });

  document.querySelectorAll(".position-input")
    .forEach(input=>{
      input.addEventListener("blur", async (e)=>{
        const id = e.target.dataset.id;
        const newPosition = e.target.value;

        await db.from("admin_users")
          .update({ position: newPosition })
          .eq("id", id);
      });
    });
}

/* ================= BUTTON ================= */
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
    ?.addEventListener("click", executeAction);

  document.getElementById("confirmNo")
    ?.addEventListener("click", closeModal);
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

  const user = allAdmins.find(a=>a.id===selectedUserId);

  if(selectedAction === "toggle"){

    await db.from("admin_users")
      .update({
        is_active: !user.is_active,
        approved_by: currentUserId
      })
      .eq("id", selectedUserId);
  }

  if(selectedAction === "delete"){

    if(user.user_id === currentUserId){
      alert("Superadmin tidak bisa menghapus dirinya sendiri.");
      closeModal();
      return;
    }

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
      a.nama?.toLowerCase().includes(keyword) ||
      a.email?.toLowerCase().includes(keyword)
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
