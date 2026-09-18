"use strict";

const client = window.supabaseClient;

let allAdmins = [];
let selectedUserId = null;
let selectedAction = null;
let currentUserId = null;
let passwordTarget = null;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await checkSuperAdmin();
  await loadAdmins();
  initFilters();
  initModal();
  initPasswordModal();
});

/* ================= SECURITY ================= */
async function checkSuperAdmin(){
  const { data } = await client.auth.getSession();

  if(!data?.session){
    window.location.href = "login.html";
    return;
  }

  currentUserId = data.session.user.id;

  const { data: roleData } = await client
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

  const { data, error } = await client
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
        <td class="action-cell">
          <button class="action-btn btn-password" data-user-id="${admin.user_id}" data-name="${escapeHtml(admin.nama ?? admin.email ?? 'User')}" data-email="${escapeHtml(admin.email ?? '')}"><i class="fa-solid fa-key"></i> Password</button>

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
  bindPasswordButtons();
}

/* ================= EDIT ROLE & POSITION ================= */
function bindEditableFields(){

  document.querySelectorAll(".role-select")
    .forEach(select=>{
      select.addEventListener("change", async (e)=>{
        const id = e.target.dataset.id;
        const newRole = e.target.value;

        await client.from("admin_users")
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

        await client.from("admin_users")
          .update({ position: newPosition })
          .eq("id", id);
      });
    });
}

/* ================= BUTTON ================= */
function bindActionButtons(){
  // Password punya handler sendiri. Modal konfirmasi hanya untuk toggle dan delete.
  document.querySelectorAll(".action-btn[data-action]").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const button = e.currentTarget;
      const id = button.dataset.id;
      const action = button.dataset.action;

      if(!id || !["toggle", "delete"].includes(action)) return;

      selectedUserId = id;
      selectedAction = action;
      showConfirmModal(action);
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
  }else if(action === "toggle"){
    title.textContent = "Ubah Status";
    text.textContent = "Yakin ingin mengubah status akun ini?";
  }else{
    return;
  }

  document.getElementById("confirmModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("confirmModal").style.display = "none";
}

/* ================= EXECUTE ================= */
async function executeAction(){
  if(!selectedUserId || !selectedAction) return;

  const user = allAdmins.find(a => String(a.id) === String(selectedUserId));
  if(!user){
    alert("Data user tidak ditemukan. Silakan refresh halaman.");
    closeModal();
    return;
  }

  const yesBtn = document.getElementById("confirmYes");
  if(yesBtn) yesBtn.disabled = true;

  try {
    if(selectedAction === "toggle"){
      const { error } = await client.from("admin_users")
        .update({
          is_active: !user.is_active,
          approved_by: currentUserId
        })
        .eq("id", selectedUserId);

      if(error) throw error;
    }

    if(selectedAction === "delete"){
      if(user.user_id === currentUserId){
        alert("Superadmin tidak bisa menghapus dirinya sendiri.");
        return;
      }

      const { error } = await client.from("admin_users")
        .delete()
        .eq("id", selectedUserId);

      if(error) throw error;
    }

    closeModal();
    await loadAdmins();
  } catch(error){
    console.error("Gagal menjalankan aksi user:", error);
    alert("Gagal menyimpan perubahan: " + (error?.message || "Terjadi kesalahan."));
  } finally {
    if(yesBtn) yesBtn.disabled = false;
  }
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



/* ================= PASSWORD MANAGEMENT ================= */
function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindPasswordButtons(){
  document.querySelectorAll(".btn-password").forEach(btn => {
    btn.addEventListener("click", () => {
      passwordTarget = {
        userId: btn.dataset.userId,
        name: btn.dataset.name,
        email: btn.dataset.email
      };
      document.getElementById("passwordUserInfo").textContent = `${passwordTarget.name} • ${passwordTarget.email}`;
      document.getElementById("newUserPassword").value = "";
      document.getElementById("confirmUserPassword").value = "";
      setPasswordMessage("");
      document.getElementById("passwordModal").style.display = "flex";
    });
  });
}

function initPasswordModal(){
  document.getElementById("passwordClose")?.addEventListener("click", closePasswordModal);
  document.getElementById("passwordModal")?.addEventListener("click", e => {
    if(e.target.id === "passwordModal") closePasswordModal();
  });
  document.querySelectorAll(".password-eye").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = `<i class="fa-solid ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
    });
  });
  document.getElementById("savePasswordBtn")?.addEventListener("click", saveUserPassword);
  document.getElementById("sendResetLinkBtn")?.addEventListener("click", sendUserResetLink);
}

function closePasswordModal(){
  document.getElementById("passwordModal").style.display = "none";
  passwordTarget = null;
}

function setPasswordMessage(message, type=""){
  const box = document.getElementById("passwordMessage");
  if(!message){ box.hidden = true; box.textContent = ""; box.className = "password-message"; return; }
  box.hidden = false;
  box.textContent = message;
  box.className = `password-message ${type}`;
}

async function saveUserPassword(){
  if(!passwordTarget?.userId) return;
  const password = document.getElementById("newUserPassword").value;
  const confirm = document.getElementById("confirmUserPassword").value;
  if(password.length < 8) return setPasswordMessage("Password minimal 8 karakter.", "error");
  if(password !== confirm) return setPasswordMessage("Konfirmasi password tidak sama.", "error");

  const btn = document.getElementById("savePasswordBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  setPasswordMessage("");
  try{
    const { data, error } = await client.functions.invoke("admin-reset-password", {
      body: { target_user_id: passwordTarget.userId, password }
    });
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    setPasswordMessage("Password user berhasil diperbarui.", "success");
    document.getElementById("newUserPassword").value = "";
    document.getElementById("confirmUserPassword").value = "";
  }catch(err){
    console.error(err);
    setPasswordMessage(err?.message || "Gagal memperbarui password.", "error");
  }finally{
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Simpan Password';
  }
}

async function sendUserResetLink(){
  if(!passwordTarget?.email) return setPasswordMessage("Email user tidak tersedia.", "error");
  const btn = document.getElementById("sendResetLinkBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
  try{
    const redirectTo = `${window.location.origin}/reset-password.html`;
    const { error } = await client.auth.resetPasswordForEmail(passwordTarget.email, { redirectTo });
    if(error) throw error;
    setPasswordMessage("Link reset password berhasil dikirim ke email user.", "success");
  }catch(err){
    console.error(err);
    setPasswordMessage(err?.message || "Gagal mengirim link reset.", "error");
  }finally{
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-envelope"></i> Kirim Link Reset';
  }
}

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
    nav.classList.contains("active") ? closeNav() : openNav();
  });

  overlay.addEventListener("click", closeNav);

  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click", closeNav);
    });
  
});

