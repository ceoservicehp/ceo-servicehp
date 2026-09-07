"use strict";

const client = window.supabaseClient;
const MAX_PRODUCT_IMAGES = 10;

let selectedImageFiles = [];
let existingImageUrls = [];
let removedExistingImages = [];
let currentModalImages = [];
let currentModalIndex = 0;

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

            const files = Array.from(this.files);

            if(files.length > MAX_PRODUCT_IMAGES){
                alert("Maksimal 10 gambar produk.");
                this.value = "";
                return;
            }

            selectedImageFiles = files;

            renderImagePreviews();
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

    const { data:exist } = await client
        .from("categories")
        .select("id")
        .ilike("name", name)
        .maybeSingle();

    if(exist){
        alert("Kategori sudah ada");
        return;
    }

    const { data, error } = await client
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

    input.value = "";
    document.getElementById("newCategoryBox").style.display = "none";

    alert("Kategori berhasil ditambahkan ✅");
}


/* ================= LOAD PRODUCTS ================= */
async function loadProducts(){

    const tbody = document.getElementById("productTable");

    const { data, error } = await client
        .from("products")
        .select(`
            *,
            categories(name)
        `)
        .order("created_at", { ascending: false });

    if(error){
        tbody.innerHTML = `<tr><td colspan="10">Error load data</td></tr>`;
        return;
    }

    if(!data || data.length === 0){
        tbody.innerHTML = `<tr><td colspan="10">Belum ada produk</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    data.forEach((row, i)=>{

        tbody.innerHTML += `
        <tr>
            <td>${i + 1}</td>
            <td>
                ${
                    row.image_url
                    ? `
                        <div
                            style="
                                position:relative;
                                width:60px;
                                cursor:pointer;
                            "
                            onclick='openImageModal(
                                ${JSON.stringify(
                                    Array.isArray(row.image_urls) &&
                                    row.image_urls.length
                                        ? row.image_urls
                                        : [row.image_url]
                                )}
                            )'
                        >

                            <img
                                src="${row.image_url}"
                                style="
                                    width:60px;
                                    height:60px;
                                    object-fit:cover;
                                    border-radius:8px;
                                "
                            >

                            ${
                                Array.isArray(row.image_urls) &&
                                row.image_urls.length > 1
                                ? `
                                    <span
                                        style="
                                            position:absolute;
                                            bottom:3px;
                                            right:3px;
                                            background:rgba(0,0,0,.7);
                                            color:white;
                                            padding:2px 5px;
                                            border-radius:5px;
                                            font-size:10px;
                                        "
                                    >
                                        📷 ${row.image_urls.length}
                                    </span>
                                `
                                : ""
                            }

                        </div>
                    `
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

    const { data } = await client
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


/* ================= GAMBAR PRODUK (PREVIEW) ================= */
function renderImagePreviews(){

    const container = document.getElementById("imagePreviewContainer");

    if(!container) return;

    container.innerHTML = "";

    const images = [];

    // Gambar lama
    existingImageUrls.forEach((url, index) => {

        if(!removedExistingImages.includes(index)){
            images.push({
                type: "existing",
                url,
                index
            });
        }
    });

    // Gambar baru
    selectedImageFiles.forEach((file, index) => {

        images.push({
            type: "new",
            url: URL.createObjectURL(file),
            index
        });
    });

    if(images.length === 0){
        return;
    }

    images.slice(0, MAX_PRODUCT_IMAGES).forEach((image, index) => {

        const item = document.createElement("div");

        item.className =
            "image-preview-item" +
            (index === 0 ? " image-preview-main" : "");

        item.innerHTML = `
            <img 
                src="${image.url}"
                alt="Gambar ${index + 1}"
            >

            ${
                index === 0
                ? `<div class="image-preview-label">
                     Gambar Utama
                   </div>`
                : ""
            }

            <button
                type="button"
                class="image-preview-remove"
                title="Hapus gambar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        item.querySelector("img")
            .addEventListener("click", () => {

                openImageModal(
                    images.map(img => img.url),
                    index
                );
            });

        item.querySelector(".image-preview-remove")
            .addEventListener("click", (e) => {

                e.stopPropagation();

                removePreviewImage(image);
            });

        container.appendChild(item);
    });
}


/* ================= HAPUS GAMBAR (PREVIEW) ================= */
function removePreviewImage(image){

    if(image.type === "existing"){

        if(!removedExistingImages.includes(image.index)){
            removedExistingImages.push(image.index);
        }

    }else{

        selectedImageFiles.splice(image.index, 1);
    }

    renderImagePreviews();
}


/* ================= MODAL GAMBAR ================= */
function openImageModal(images, index = 0){

    if(!images || images.length === 0) return;

    currentModalImages = images;
    currentModalIndex = index;

    const modal = document.getElementById("imageModal");
    const image = document.getElementById("imageModalMain");
    const counter = document.getElementById("imageModalCounter");

    image.src = currentModalImages[currentModalIndex];

    counter.textContent =
        `${currentModalIndex + 1} / ${currentModalImages.length}`;

    modal.classList.add("active");

    updateModalNavigation();
}


function updateModalNavigation(){

    const prev = document.getElementById("imageModalPrev");
    const next = document.getElementById("imageModalNext");

    const total = currentModalImages.length;

    if(total <= 1){
        prev.style.display = "none";
        next.style.display = "none";
    }else{
        prev.style.display = "flex";
        next.style.display = "flex";
    }
}


function closeImageModal(){

    const modal = document.getElementById("imageModal");
    modal.classList.remove("active");

    const image = document.getElementById("imageModalMain");
    image.src = "";
}


function showPreviousImage(){

    if(currentModalImages.length <= 1) return;

    currentModalIndex--;

    if(currentModalIndex < 0){
        currentModalIndex = currentModalImages.length - 1;
    }

    updateModalImage();
}


function showNextImage(){

    if(currentModalImages.length <= 1) return;

    currentModalIndex++;

    if(currentModalIndex >= currentModalImages.length){
        currentModalIndex = 0;
    }

    updateModalImage();
}


function updateModalImage(){

    const image = document.getElementById("imageModalMain");
    const counter = document.getElementById("imageModalCounter");

    image.src = currentModalImages[currentModalIndex];

    counter.textContent =
        `${currentModalIndex + 1} / ${currentModalImages.length}`;
}


document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("imageModalClose")
        ?.addEventListener("click", closeImageModal);

    document.getElementById("imageModalPrev")
        ?.addEventListener("click", showPreviousImage);

    document.getElementById("imageModalNext")
        ?.addEventListener("click", showNextImage);

    document.getElementById("imageModal")
        ?.addEventListener("click", function(e){

            if(e.target === this){
                closeImageModal();
            }
        });

    document.addEventListener("keydown", function(e){

        const modal = document.getElementById("imageModal");

        if(!modal?.classList.contains("active")){
            return;
        }

        if(e.key === "Escape"){
            closeImageModal();
        }

        if(e.key === "ArrowLeft"){
            showPreviousImage();
        }

        if(e.key === "ArrowRight"){
            showNextImage();
        }
    });
});


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

    if(!name || !price){
        alert("Nama dan harga wajib diisi");
        return;
    }

    /* =====================================================
       UPLOAD GAMBAR PRODUK BARU
    ===================================================== */

    const newImageUrls = [];

    if(selectedImageFiles.length > 0){

        for(const file of selectedImageFiles){

            const safeName =
                file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

            const fileName =
                Date.now() +
                "_" +
                Math.random().toString(36).substring(2, 8) +
                "_" +
                safeName;

            const { error: uploadError } =
                await client.storage
                    .from("produk-images")
                    .upload(fileName, file);

            if(uploadError){
                console.error(uploadError);
                alert("Gagal upload gambar: " + uploadError.message);
                return;
            }

            const { data } =
                client.storage
                    .from("produk-images")
                    .getPublicUrl(fileName);

            if(data?.publicUrl){
                newImageUrls.push(data.publicUrl);
            }
        }
    }

    /* =====================================================
       GABUNGKAN GAMBAR LAMA + BARU
    ===================================================== */

    const remainingExistingImages =
        existingImageUrls.filter(
            (_, index) => !removedExistingImages.includes(index)
        );

    let allImages = [
        ...remainingExistingImages,
        ...newImageUrls
    ];

    /* Maksimal 10 */
    allImages = allImages.slice(0, MAX_PRODUCT_IMAGES);

    /* =====================================================
       PAYLOAD
    ===================================================== */

    const payload = {
        name,
        category_id: categoryId,
        price,
        cost_price: costPrice,
        promo_price: promoPrice,
        stock,
        description: desc,
        is_active: isActive,
        image_urls: allImages,
        /* Kompatibilitas dengan sistem lama: image_url = gambar pertama */
        image_url: allImages.length > 0 ? allImages[0] : null
    };

    if(!id){

        const { error } = await client
            .from("products")
            .insert(payload);

        if(error){
            console.error("Gagal menambahkan produk:", error);
            alert("Gagal menambahkan produk: " + error.message);
            return;
        }

    }else{

        const { error } = await client
            .from("products")
            .update(payload)
            .eq("id", id);

        if(error){
            console.error("Gagal mengubah produk:", error);
            alert("Gagal mengubah produk: " + error.message);
            return;
        }
    }

    resetForm();
    loadProducts();
}


/* ================= EDIT ================= */
async function editProduct(id){

    const { data } = await client
        .from("products")
        .select("*")
        .eq("id", id)
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

    /* =====================================================
       LOAD GAMBAR PRODUK
    ===================================================== */

    existingImageUrls = Array.isArray(data.image_urls)
        ? data.image_urls.filter(Boolean)
        : [];

    /*
       Kompatibilitas produk lama:
       jika image_urls kosong tetapi image_url ada,
       gunakan image_url sebagai gambar pertama.
    */
    if(existingImageUrls.length === 0 && data.image_url){
        existingImageUrls = [data.image_url];
    }

    selectedImageFiles = [];
    removedExistingImages = [];

    document.getElementById("productImage").value = "";

    renderImagePreviews();
}


/* ================= DELETE ================= */
async function deleteProduct(id){

    if(!confirm("Hapus produk ini?")) return;

    const { error } = await client
        .from("products")
        .delete()
        .eq("id", id);

    if(error){
        console.error("Gagal menghapus produk:", error);
        alert("Gagal menghapus produk: " + error.message);
        return;
    }

    loadProducts();
}


/* ================= RESET ================= */
function resetForm(){

    document.getElementById("productId").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productCost").value = "";
    document.getElementById("productPromo").value = "";
    document.getElementById("productStock").value = "";
    document.getElementById("productDesc").value = "";
    document.getElementById("productImage").value = "";
    document.getElementById("productActive").checked = true;

    selectedImageFiles = [];
    existingImageUrls = [];
    removedExistingImages = [];

    const container = document.getElementById("imagePreviewContainer");

    if(container){
        container.innerHTML = "";
    }
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

    for(let i = 1; i < rows.length; i++){

        const values = rows[i].split(",").map(v => v.trim());

        let rowData = {};
        headers.forEach((h, index)=>{
            rowData[h] = values[index] || "";
        });

        /* ===== CEK / BUAT KATEGORI ===== */
        let categoryId = null;

        if(rowData.category){

            const { data: exist } = await client
                .from("categories")
                .select("id")
                .ilike("name", rowData.category)
                .maybeSingle();

            if(exist){
                categoryId = exist.id;
            }else{
                const { data: newCat } = await client
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

    const { error } = await client
        .from("products")
        .insert(productsToInsert);

    if(error){
        resultBox.innerHTML = "❌ Gagal import data";
        console.log(error);
        return;
    }

    resultBox.innerHTML = "✅ Import berhasil (" + productsToInsert.length + " produk)";
    fileInput.value = "";
    loadProducts();
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
