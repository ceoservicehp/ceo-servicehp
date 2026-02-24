"use strict";

const db = window.supabaseClient;

let allAdmins = [];
let selectedUserId = null;
let selectedAction = null;
let currentUserEmail = null;

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

  currentUserEmail = data.session.user.email;

  const { data: roleData } = await db
    .from("profiles")
    .select("role,is_active")
    .eq("email", currentUserEmail)
    .maybeSingle();

  if(!roleData || roleData.role !== "superadmin" || !roleData.is_active){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
  }
}

/* ================= LOAD ================= */
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
    .from("profiles")
    .select("*")
    .order("created_at", { ascending:false });

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

    const roleClass =
      admin.role === "superadmin" ? "role-superadmin" :
      admin.role === "admin" ? "role-admin" :
      "role-staff";

    const statusBadge = admin.is_active
      ? `<span class="badge badge-active">Aktif</span>`
      : `<span class="badge badge-inactive">Nonaktif</span>`;

    tbody.innerHTML += `
      <tr>
        <td>${index+1}</td>
        <td>${admin.full_name ?? "-"}</td>
        <td>${admin.email}</td>
        <td>${admin.phone ?? "-"}</td>
        <td>
          <select data-id="${admin.id}" class="edit-position">
            <option ${admin.position==="Owner"?"selected":""}>Owner</option>
            <option ${admin.position==="Manager"?"selected":""}>Manager</option>
            <option ${admin.position==="Staff"?"selected":""}>Staff</option>
            <option ${admin.position==="Teknisi"?"selected":""}>Teknisi</option>
          </select>
        </td>
        <td>
          <select data-id="${admin.id}" class="edit-role">
            <option value="superadmin" ${admin.role==="superadmin"?"selected":""}>Superadmin</option>
            <option value="admin" ${admin.role==="admin"?"selected":""}>Admin</option>
            <option value="staff" ${admin.role==="staff"?"selected":""}>Staff</option>
          </select>
        </td>
        <td>${statusBadge}</td>
        <td>${admin.approved_by ?? "-"}</td>
        <td>
          ${
            admin.email !== currentUserEmail
            ? `
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
            `
            : `<span style="font-size:12px;color:#64748b;">Akun Anda</span>`
          }
        </td>
      </tr>
    `;
  });

  bindActionButtons();
  bindInlineEditors();
}

/* ================= INLINE EDIT ================= */
function bindInlineEditors(){

  document.querySelectorAll(".edit-role").forEach(select=>{
    select.addEventListener("change", async e=>{
      const id = e.target.dataset.id;
      const newRole = e.target.value;

      await db.from("profiles")
        .update({ role:newRole })
        .eq("id", id);
    });
  });

  document.querySelectorAll(".edit-position").forEach(select=>{
    select.addEventListener("change", async e=>{
      const id = e.target.dataset.id;
      const newPosition = e.target.value;

      await db.from("profiles")
        .update({ position:newPosition })
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

    await db.from("profiles")
      .update({ is_active: !user.is_active })
      .eq("id", selectedUserId);
  }

  if(selectedAction === "delete"){
    await db.from("profiles")
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
      a.full_name?.toLowerCase().includes(keyword) ||
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
