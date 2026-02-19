"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

document.addEventListener("DOMContentLoaded", ()=>{
/* ===== IMPORT CSV ===== */
document.getElementById("importBtn")
    ?.addEventListener("click", importProducts);

    loadProducts();
    loadCategories();

    /* ===== TOGGLE TAMBAH KATEGORI ===== */
    document.getElementById("addCategoryBtn")
        ?.addEventListener("click", ()=>{

            const box = document.getElementById("newCategoryBox");
            box.style.display =
                box.style.display === "none" ? "block" : "none";
        });

    /* ===== SAVE CATEGORY ===== */
    document.getElementById("saveCategoryBtn")
        ?.addEventListener("click", saveCategory);

    /* ===== SAVE PRODUCT ===== */
    document.getElementById("saveProduct")
        .addEventListener("click", saveProduct);

    /* ===== PREVIEW GAMBAR ===== */
    document.getElementById("productImage")
        .addEventListener("change", function(){

            const file = this.files[0];
            const preview = document.getElementById("imagePreview");

            if(file){
                preview.src = URL.createObjectURL(file);
                preview.style.display = "block";
            }else{
                preview.style.display = "none";
            }
        });
});


/* ================= SAVE CATEGORY ================= */
async function saveCategory(){

    const input = document.getElementById("newCategoryName");
    const name = input.value.trim();

    if(!name){
        alert("Nama kategori tidak boleh kosong");
        return;
    }

    const { data:exist } = await db
        .from("categories")
        .select("id")
        .ilike("name", name)
        .maybeSingle();

    if(exist){
        alert("Kategori sudah ada");
        return;
    }

    const { data, error } = await db
        .from("categories")
        .insert({ name })
        .select()
        .single();

    if(error){
        alert("Gagal tambah kategori");
        console.log(error);
        return;
    }

    await loadCategories();

    document.getElementById("productCategory").value = data.id;

    input.value="";
    document.getElementById("newCategoryBox").style.display="none";

    alert("Kategori berhasil ditambahkan ✅");
}


/* ================= LOAD PRODUCTS ================= */
async function loadProducts(){

    const tbody = document.getElementById("productTable");

    const { data, error } = await db
        .from("products")
        .select(`
            *,
            categories(name)
        `)
        .order("created_at",{ascending:false});

    if(error){
        tbody.innerHTML=`<tr><td colspan="10">Error load data</td></tr>`;
        return;
    }

    if(!data || data.length===0){
        tbody.innerHTML=`<tr><td colspan="10">Belum ada produk</td></tr>`;
        return;
    }

    tbody.innerHTML="";

    data.forEach((row,i)=>{

        tbody.innerHTML+=`
        <tr>
            <td>${i+1}</td>
            <td>
                ${row.image_url 
                    ? `<img src="${row.image_url}" 
                       style="width:50px;height:50px;object-fit:cover;border-radius:6px;">`
                    : "-"
                }
            </td>
            <td>${row.name}</td>
            <td>${row.categories?.name || "-"}</td>
            <td>${rupiah(row.price)}</td>
            <td>${rupiah(row.cost_price)}</td>
            <td>${rupiah(row.promo_price)}</td>
            <td>${row.stock}</td>
            <td>${row.is_active ? "Aktif" : "Nonaktif"}</td>
            <td class="action-buttons">
                <button class="btn-edit" onclick="editProduct(${row.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-delete" onclick="deleteProduct(${row.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>

        </tr>
        `;
    });
}


/* ================= LOAD CATEGORIES ================= */
async function loadCategories(){

    const { data } = await db
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

    const select = document.getElementById("productCategory");

    select.innerHTML = `<option value="">-- Pilih Kategori --</option>`;

    data.forEach(cat=>{
        select.innerHTML += `
            <option value="${cat.id}">${cat.name}</option>
        `;
    });
}


/* ================= SAVE PRODUCT ================= */
async function saveProduct(){

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value;
    const categoryId = document.getElementById("productCategory").value || null;
    const price = parseInt(document.getElementById("productPrice").value) || 0;
    const costPrice = parseInt(document.getElementById("productCost").value) || 0;
    const promoPrice = parseInt(document.getElementById("productPromo").value) || 0;
    const stock = parseInt(document.getElementById("productStock").value) || 0;
    const desc = document.getElementById("productDesc").value;
    const isActive = document.getElementById("productActive").checked;
    const file = document.getElementById("productImage").files[0];

    if(!name || !price){
        alert("Nama dan harga wajib diisi");
        return;
    }

    let imageUrl = null;

    if(file){

        const fileName = Date.now()+"_"+file.name;

        const { error:uploadError } = await db.storage
            .from("produk-images")
            .upload(fileName,file);

        if(uploadError){
            alert("Gagal upload gambar");
            return;
        }

        const { data } = db.storage
            .from("produk-images")
            .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
    }

    const payload = {
        name,
        category_id: categoryId,
        price,
        cost_price: costPrice,
        promo_price: promoPrice,
        stock,
        description: desc,
        is_active: isActive
    };

    if(imageUrl){
        payload.image_url = imageUrl;
    }

    if(!id){
        await db.from("products").insert(payload);
    }else{
        await db.from("products").update(payload).eq("id",id);
    }

    resetForm();
    loadProducts();
}


/* ================= EDIT ================= */
async function editProduct(id){

    const { data } = await db
        .from("products")
        .select("*")
        .eq("id",id)
        .single();

    document.getElementById("productId").value = data.id;
    document.getElementById("productName").value = data.name;
    document.getElementById("productCategory").value = data.category_id || "";
    document.getElementById("productPrice").value = data.price;
    document.getElementById("productCost").value = data.cost_price;
    document.getElementById("productPromo").value = data.promo_price;
    document.getElementById("productStock").value = data.stock;
    document.getElementById("productDesc").value = data.description;
    document.getElementById("productActive").checked = data.is_active;

    const preview = document.getElementById("imagePreview");
    if(data.image_url){
        preview.src = data.image_url;
        preview.style.display = "block";
    }else{
        preview.style.display = "none";
    }
}


/* ================= DELETE ================= */
async function deleteProduct(id){

    if(!confirm("Hapus produk ini?")) return;

    await db.from("products").delete().eq("id",id);
    loadProducts();
}


/* ================= RESET ================= */
function resetForm(){

    document.getElementById("productId").value="";
    document.getElementById("productName").value="";
    document.getElementById("productCategory").value="";
    document.getElementById("productPrice").value="";
    document.getElementById("productCost").value="";
    document.getElementById("productPromo").value="";
    document.getElementById("productStock").value="";
    document.getElementById("productDesc").value="";
    document.getElementById("productImage").value="";
    document.getElementById("productActive").checked=true;

    const preview = document.getElementById("imagePreview");
    preview.style.display="none";
}

/* ================= IMPORT PRODUK MASSAL ================= */
async function importProducts(){

    const fileInput = document.getElementById("importFile");
    const resultBox = document.getElementById("importResult");

    if(!fileInput.files.length){
        alert("Pilih file CSV dulu");
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();

    const rows = text.split("\n").map(r => r.trim()).filter(r => r);

    if(rows.length < 2){
        alert("File tidak valid");
        return;
    }

    const headers = rows[0].split(",").map(h => h.trim());

    const requiredColumns = [
    "name",
    "category",
    "price",
    "cost",
    "promo_price",
    "stock",
    "description",
    "is_active",
    "image_url"
];

    for(const col of requiredColumns){
        if(!headers.includes(col)){
            alert("Kolom CSV tidak lengkap");
            return;
        }
    }

    const productsToInsert = [];

    for(let i=1;i<rows.length;i++){

        const values = rows[i].split(",").map(v => v.trim());

        let rowData = {};
        headers.forEach((h,index)=>{
            rowData[h] = values[index] || "";
        });

        /* ===== CEK / BUAT KATEGORI ===== */
        let categoryId = null;

        if(rowData.category){

            const { data:exist } = await db
                .from("categories")
                .select("id")
                .ilike("name", rowData.category)
                .maybeSingle();

            if(exist){
                categoryId = exist.id;
            }else{
                const { data:newCat } = await db
                    .from("categories")
                    .insert({ name: rowData.category })
                    .select()
                    .single();

                categoryId = newCat.id;
            }
        }

        productsToInsert.push({
        name: rowData.name,
        category_id: categoryId,
        price: parseInt(rowData.price) || 0,
        cost_price: parseInt(rowData.cost) || 0,
        promo_price: parseInt(rowData.promo_price) || 0,
        stock: parseInt(rowData.stock) || 0,
        description: rowData.description || "",
        image_url: rowData.image_url || null,
        is_active: rowData.is_active?.toLowerCase() === "true"
    });

    }

    const { error } = await db
        .from("products")
        .insert(productsToInsert);

    if(error){
        resultBox.innerHTML = "❌ Gagal import data";
        console.log(error);
        return;
    }

    resultBox.innerHTML = "✅ Import berhasil ("+productsToInsert.length+" produk)";
    fileInput.value = "";
    loadProducts();
}
