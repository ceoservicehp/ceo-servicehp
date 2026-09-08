"use strict";
const client = window.supabaseClient;
let rows = [], page = 1, pageSize = 10, total = 0, timer;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "-").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = v => v ? new Date(v + (String(v).length===10?'T00:00:00':'' )).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';

function badge(state){
  const map={aktif:['Aktif','ok'],habis:['Habis','bad'],belum_diatur:['Belum Diatur','muted'],belum_mulai:['Belum Mulai','warn'],nonaktif:['Nonaktif','muted']};
  const [t,c]=map[state]||[state,'muted']; return `<span class="badge ${c}">${t}</span>`;
}

async function guard(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){ location.href='login.html'; return false; }
  const {data, error}=await client.from('admin_users').select('role,is_active').eq('user_id',session.user.id).maybeSingle();
  if(error || !data || !data.is_active || !['admin','superadmin'].includes(data.role)){ alert('Akses hanya untuk admin / superadmin.'); location.href='index.html'; return false; }
  return true;
}

async function load(){
  $('tableBody').innerHTML='<tr><td colspan="7" class="empty">Memuat data...</td></tr>';
  pageSize=Number($('pageSize').value||10);
  const q=$('searchInput').value.trim(); const status=$('statusFilter').value;
  const {data,error}=await client.rpc('admin_search_product_warranties',{p_q:q||null,p_status:status,p_limit:pageSize,p_offset:(page-1)*pageSize});
  if(error){ console.error(error); $('tableBody').innerHTML=`<tr><td colspan="7" class="empty error">${esc(error.message)}</td></tr>`; return; }
  rows=data||[]; total=rows[0]?.total_count||0; render();
}

function render(){
  $('statTotal').textContent=total;
  $('statAktif').textContent=rows.filter(r=>r.warranty_state==='aktif').length;
  $('statBelum').textContent=rows.filter(r=>r.warranty_state==='belum_diatur').length;
  $('statHabis').textContent=rows.filter(r=>r.warranty_state==='habis').length;
  if(!rows.length){ $('tableBody').innerHTML='<tr><td colspan="7" class="empty">Data tidak ditemukan.</td></tr>'; }
  else $('tableBody').innerHTML=rows.map(r=>`
    <tr>
      <td><b>${esc(r.order_number||('#'+r.order_id))}</b><small>${fmtDate(r.order_created_at)}</small></td>
      <td><b>${esc(r.customer_name)}</b><small>${esc(r.customer_whatsapp)}</small></td>
      <td><b>${esc(r.product_name)}</b><small>${esc([r.variant_name,r.ram,r.storage,r.color].filter(Boolean).join(' · '))}</small></td>
      <td><code>${esc(r.imei1)}</code>${r.imei2?`<small>IMEI2: ${esc(r.imei2)}</small>`:''}${r.serial_number?`<small>SN: ${esc(r.serial_number)}</small>`:''}</td>
      <td>${r.warranty_id?`<b>${fmtDate(r.warranty_start)} — ${fmtDate(r.warranty_end)}</b><small>${esc(r.warranty_type||'')}</small>`:'<span class="soft">Belum ditentukan</span>'}</td>
      <td>${badge(r.warranty_state)}${Number.isFinite(r.days_left)?`<small>${r.days_left>=0?r.days_left+' hari tersisa':Math.abs(r.days_left)+' hari lewat'}</small>`:''}</td>
      <td><button class="btn tiny primary" onclick="openWarranty(${r.unit_id})"><i class="fa-solid fa-shield"></i> Atur</button></td>
    </tr>`).join('');
  const pages=Math.max(1,Math.ceil(total/pageSize)); $('pageInfo').textContent=`Halaman ${page} dari ${pages} · ${total} unit`;
  $('prevBtn').disabled=page<=1; $('nextBtn').disabled=page>=pages;
}

window.openWarranty=function(unitId){
  const r=rows.find(x=>Number(x.unit_id)===Number(unitId)); if(!r)return;
  $('unitId').value=r.unit_id;
  $('unitSummary').innerHTML=`<b>${esc(r.product_name)}</b><span>${esc([r.variant_name,r.ram,r.storage,r.color].filter(Boolean).join(' · '))}</span><code>IMEI 1: ${esc(r.imei1)}</code>${r.imei2?`<code>IMEI 2: ${esc(r.imei2)}</code>`:''}<small>${esc(r.order_number)} · ${esc(r.customer_name)}</small>`;
  const today=new Date(); const iso=today.toISOString().slice(0,10);
  $('warrantyStart').value=r.warranty_start||iso;
  const end=new Date(today); end.setDate(end.getDate()+30);
  $('warrantyEnd').value=r.warranty_end||end.toISOString().slice(0,10);
  $('warrantyType').value=r.warranty_type||'Garansi Toko';
  $('warrantyNote').value=r.warranty_note||'';
  $('warrantyActive').checked=r.warranty_id ? !!r.warranty_enabled : true;
  $('modal').classList.remove('hidden');
};

$('closeModal').onclick=()=> $('modal').classList.add('hidden');
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))$('modal').classList.add('hidden')});

document.querySelectorAll('.quick-days button').forEach(b=>b.onclick=()=>{
  const start=$('warrantyStart').value?new Date($('warrantyStart').value+'T00:00:00'):new Date();
  start.setDate(start.getDate()+Number(b.dataset.days)); $('warrantyEnd').value=start.toISOString().slice(0,10);
});

$('warrantyForm').addEventListener('submit',async e=>{
  e.preventDefault(); const btn=e.submitter; btn.disabled=true; btn.textContent='Menyimpan...';
  const {error}=await client.rpc('admin_upsert_product_warranty',{p_unit_id:Number($('unitId').value),p_start:$('warrantyStart').value,p_end:$('warrantyEnd').value,p_type:$('warrantyType').value,p_note:$('warrantyNote').value||null,p_is_active:$('warrantyActive').checked});
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Simpan Garansi';
  if(error){alert(error.message);return;} $('modal').classList.add('hidden'); await load();
});

$('searchInput').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{page=1;load()},350)});
$('statusFilter').onchange=()=>{page=1;load()}; $('pageSize').onchange=()=>{page=1;load()}; $('refreshBtn').onclick=load;
$('prevBtn').onclick=()=>{if(page>1){page--;load()}}; $('nextBtn').onclick=()=>{if(page<Math.ceil(total/pageSize)){page++;load()}};

document.addEventListener('DOMContentLoaded',async()=>{if(await guard())load();});
