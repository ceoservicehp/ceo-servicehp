"use strict";

const db = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  await checkSuperAdmin();
  await loadAdmins();
});

/* ================= SECURITY CHECK ================= */
async function checkSuperAdmin(){

  const { data } = await db.auth.getSession();

  if(!data.session){
    window.location.href = "login.html";
    return;
  }

  const email = data.session.user.email;

  const { data: roleData } = await db
    .from("admin_users")
    .select("role")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if(!roleData || roleData.role !== "superadmin"){
    alert("Akses ditolak.");
    window.location.href = "dapur.html";
  }
}

/* ================= LOAD DATA ================= */
async function loadAdmins(){

  const tbody = document.getElementById("adminTable");

  const { data, error } = await db
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    tbody.innerHTML = `<tr><td colspan="9">Error load data</td></tr>`;
    return;
  }

  if(!data || data.length === 0){
    tbody.innerHTML = `<tr><td colspan="9">Belum ada admin</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  data.forEach((admin, index)=>{

    tbody.innerHTML += `
      <tr>
        <td>${index+1}</td>
        <td>${admin.full_name ?? "-"}</td>
        <td>${admin.email}</td>
        <td>${admin.phone ?? "-"}</td>
        <td>${admin.position ?? "-"}</td>
        <td><span class="role-badge">${admin.role}</span></td>
        <td>
          <span class="badge ${admin.is_active ? 'badge-active':'badge-inactive'}">
            ${admin.is_active ? 'Aktif':'Menunggu'}
          </span>
        </td>
        <td>${admin.approved_by ?? '-'}</td>
        <td>
          ${
            !admin.is_active
            ? `<button class="action-btn btn-approve"
                 onclick="approveUser('${admin.id}')">
                 Approve
               </button>`
            : `<button class="action-btn btn-disable"
                 onclick="disableUser('${admin.id}')">
                 Nonaktifkan
               </button>`
          }
        </td>
      </tr>
    `;
  });

}

/* ================= APPROVE ================= */
async function approveUser(id){

  const { data: session } = await db.auth.getSession();
  const approver = session.session.user.email;

  await db
    .from("admin_users")
    .update({
      is_active:true,
      approved_by: approver
    })
    .eq("id", id);

  loadAdmins();
}

/* ================= DISABLE ================= */
async function disableUser(id){

  await db
    .from("admin_users")
    .update({
      is_active:false
    })
    .eq("id", id);

  loadAdmins();
}
