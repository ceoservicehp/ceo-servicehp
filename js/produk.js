"use strict";

/* =========================================================
   CEO PART & SERVICE
   PRODUCT MANAGEMENT
========================================================= */

const client = window.supabaseClient;

const MAX_PRODUCT_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

let selectedImageFiles = [];
let existingImageUrls = [];
let removedExistingImages = [];

let currentModalImages = [];
let currentModalIndex = 0;

let isSaving = false;
let isImporting = false;

/* VARIANT STATE */
let currentVariantProduct = null;
let currentVariants = [];
let isSavingVariant = false;


/* =========================================================
   HELPERS
========================================================= */

function rupiah(value) {

    const number = Number(value || 0);

    return "Rp " + number.toLocaleString("id-ID");
}


function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalizeText(value) {

    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}


function parseNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        return 0;
    }

    return Math.floor(number);
}


function getProductImages(product) {

    let images = [];

    if (
        Array.isArray(product?.image_urls) &&
        product.image_urls.length > 0
    ) {
        images = product.image_urls;
    }

    if (
        images.length === 0 &&
        product?.image_url
    ) {
        images = [product.image_url];
    }

    return [
        ...new Set(
            images
                .filter(Boolean)
                .map(url => String(url).trim())
                .filter(Boolean)
        )
    ].slice(0, MAX_PRODUCT_IMAGES);
}


function getImageArrayForStorage(images) {

    return [
        ...new Set(
            images
                .filter(Boolean)
                .map(url => String(url).trim())
        )
    ].slice(0, MAX_PRODUCT_IMAGES);
}


function getRemainingExistingImages() {

    return existingImageUrls.filter(
        (_, index) =>
            !removedExistingImages.includes(index)
    );
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    setupEvents();

    setFooterYear();

    await loadCategories();

    await loadProducts();

    updateDescriptionCounter();

    updateImageCount();

    resetForm(false);
});


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    /* SAVE PRODUCT */
    document
        .getElementById("saveProduct")
        ?.addEventListener(
            "click",
            saveProduct
        );


    /* CANCEL EDIT */
    document
        .getElementById("cancelEditBtn")
        ?.addEventListener(
            "click",
            () => resetForm()
        );


    /* ADD CATEGORY */
    document
        .getElementById("addCategoryBtn")
        ?.addEventListener(
            "click",
            toggleCategoryBox
        );


    /* SAVE CATEGORY */
    document
        .getElementById("saveCategoryBtn")
        ?.addEventListener(
            "click",
            saveCategory
        );


    /* ENTER CATEGORY */
    document
        .getElementById("newCategoryName")
        ?.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    saveCategory();
                }

            }
        );


    /* IMAGE SELECT */
    document
        .getElementById("productImage")
        ?.addEventListener(
            "change",
            handleImageSelection
        );


    /* DESCRIPTION COUNTER */
    document
        .getElementById("productDesc")
        ?.addEventListener(
            "input",
            updateDescriptionCounter
        );


    /* IMPORT */
    document
        .getElementById("importBtn")
        ?.addEventListener(
            "click",
            importProducts
        );


    /* IMPORT FILE NAME */
    document
        .getElementById("importFile")
        ?.addEventListener(
            "change",
            handleImportFileName
        );


    /* REFRESH */
    document
        .getElementById("refreshProductsBtn")
        ?.addEventListener(
            "click",
            async () => {

                const button =
                    document.getElementById(
                        "refreshProductsBtn"
                    );

                if (!button) return;

                button.disabled = true;

                const originalHTML =
                    button.innerHTML;

                button.innerHTML = `
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Memuat...
                `;

                await loadProducts();

                button.disabled = false;

                button.innerHTML = originalHTML;
            }
        );


    /* IMAGE MODAL */
    document
        .getElementById("imageModalClose")
        ?.addEventListener(
            "click",
            closeImageModal
        );


    document
        .getElementById("imageModalPrev")
        ?.addEventListener(
            "click",
            showPreviousImage
        );


    document
        .getElementById("imageModalNext")
        ?.addEventListener(
            "click",
            showNextImage
        );


    document
        .getElementById("imageModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "imageModal"
                ) {
                    closeImageModal();
                }

            }
        );


    /* VARIANT MODAL */
    document
        .getElementById("variantModalClose")
        ?.addEventListener(
            "click",
            closeVariantModal
        );


    document
        .getElementById("variantModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "variantModal"
                ) {
                    closeVariantModal();
                }
            }
        );


    document
        .getElementById("saveVariantBtn")
        ?.addEventListener(
            "click",
            saveVariant
        );


    document
        .getElementById("cancelVariantEditBtn")
        ?.addEventListener(
            "click",
            resetVariantForm
        );


    document
        .getElementById("refreshVariantsBtn")
        ?.addEventListener(
            "click",
            loadVariants
        );


    /* KEYBOARD */
    document.addEventListener(
        "keydown",
        handleGlobalKeyboard
    );


    /* MOBILE NAV */
    setupMobileNavigation();
}


/* =========================================================
   FOOTER
========================================================= */

function setFooterYear() {

    const year =
        document.getElementById("footerYear");

    if (year) {

        year.textContent =
            new Date().getFullYear();
    }
}


/* =========================================================
   CATEGORY
========================================================= */

function toggleCategoryBox() {

    const box =
        document.getElementById(
            "newCategoryBox"
        );

    if (!box) return;

    const isHidden =
        box.hasAttribute("hidden");

    if (isHidden) {

        box.removeAttribute("hidden");

        setTimeout(() => {

            document
                .getElementById(
                    "newCategoryName"
                )
                ?.focus();

        }, 50);

    } else {

        box.setAttribute(
            "hidden",
            ""
        );
    }
}


async function loadCategories(
    selectedCategoryId = null
) {

    const select =
        document.getElementById(
            "productCategory"
        );

    if (!select) return;

    select.innerHTML = `
        <option value="">
            -- Pilih Kategori --
        </option>
    `;

    const {
        data,
        error
    } = await client
        .from("categories")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("name", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal memuat kategori:",
            error
        );

        select.innerHTML = `
            <option value="">
                Gagal memuat kategori
            </option>
        `;

        return;
    }


    (data || []).forEach(category => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            category.id;

        option.textContent =
            category.name;

        select.appendChild(option);
    });


    if (selectedCategoryId !== null) {

        select.value =
            String(selectedCategoryId);
    }
}


async function saveCategory() {

    const input =
        document.getElementById(
            "newCategoryName"
        );

    const name =
        normalizeText(input?.value);


    if (!name) {

        alert(
            "Nama kategori tidak boleh kosong."
        );

        input?.focus();

        return;
    }


    const saveButton =
        document.getElementById(
            "saveCategoryBtn"
        );


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Menyimpan...
        `;
    }


    try {

        const {
            data: existingCategory,
            error: checkError
        } = await client
            .from("categories")
            .select("id,name")
            .ilike("name", name)
            .maybeSingle();


        if (checkError) {

            console.error(
                checkError
            );

            alert(
                "Gagal memeriksa kategori."
            );

            return;
        }


        if (existingCategory) {

            await loadCategories(
                existingCategory.id
            );

            input.value = "";

            document
                .getElementById(
                    "newCategoryBox"
                )
                ?.setAttribute(
                    "hidden",
                    ""
                );

            alert(
                "Kategori tersebut sudah ada."
            );

            return;
        }


        const {
            data,
            error
        } = await client
            .from("categories")
            .insert({
                name
            })
            .select("id,name")
            .single();


        if (error) {

            console.error(
                "Gagal tambah kategori:",
                error
            );

            alert(
                "Gagal menambahkan kategori: " +
                error.message
            );

            return;
        }


        await loadCategories(
            data.id
        );


        input.value = "";

        document
            .getElementById(
                "newCategoryBox"
            )
            ?.setAttribute(
                "hidden",
                ""
            );


        alert(
            "Kategori berhasil ditambahkan ✅"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.innerHTML = `
                <i class="fa-solid fa-check"></i>
                Simpan
            `;
        }
    }
}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    const tbody =
        document.getElementById(
            "productTable"
        );


    if (!tbody) return;


    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="table-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Memuat data produk...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await client
        .from("products")
        .select(`
            *,
            categories(name)
        `)
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Gagal load produk:",
            error
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="table-error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Gagal memuat data produk.
                    <button
                        type="button"
                        class="inline-retry-btn"
                        id="retryProductsBtn"
                    >
                        Coba Lagi
                    </button>
                </td>
            </tr>
        `;


        document
            .getElementById(
                "retryProductsBtn"
            )
            ?.addEventListener(
                "click",
                loadProducts
            );

        updateProductTotal(0);

        return;
    }


    if (!data || data.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="table-empty">
                    <div class="empty-table-content">
                        <i class="fa-solid fa-box-open"></i>
                        <strong>Belum ada produk</strong>
                        <span>
                            Tambahkan produk menggunakan
                            form di atas.
                        </span>
                    </div>
                </td>
            </tr>
        `;


        updateProductTotal(0);

        return;
    }


    tbody.innerHTML = "";


    data.forEach(
        (product, index) => {

            const row =
                createProductTableRow(
                    product,
                    index
                );

            tbody.appendChild(row);
        }
    );


    updateProductTotal(
        data.length
    );
}


/* =========================================================
   PRODUCT TABLE ROW
========================================================= */

function createProductTableRow(
    product,
    index
) {

    const row =
        document.createElement("tr");


    const images =
        getProductImages(product);


    const categoryName =
        product.categories?.name ||
        "-";


    const price =
        parseNumber(product.price);


    const promo =
        parseNumber(
            product.promo_price
        );


    const stock =
        parseNumber(product.stock);


    const hasPromo =
        promo > 0 &&
        promo < price;


    row.innerHTML = `

        <td class="table-number">
            ${index + 1}
        </td>


        <td>

            ${
                images.length > 0
                ? `
                    <button
                        type="button"
                        class="product-thumbnail-btn"
                        title="Lihat gambar produk"
                    >

                        <img
                            src="${escapeHTML(images[0])}"
                            alt="${escapeHTML(product.name)}"
                            class="product-thumbnail"
                            loading="lazy"
                        >

                        ${
                            images.length > 1
                            ? `
                                <span class="thumbnail-count">
                                    <i class="fa-solid fa-images"></i>
                                    ${images.length}
                                </span>
                            `
                            : ""
                        }

                    </button>
                `
                : `
                    <div class="product-thumbnail-empty">
                        <i class="fa-regular fa-image"></i>
                    </div>
                `
            }

        </td>


        <td>

            <div class="product-name-cell">

                <strong>
                    ${escapeHTML(product.name)}
                </strong>

                ${
                    product.description
                    ? `
                        <small>
                            ${escapeHTML(
                                product.description
                                    .replace(/\s+/g, " ")
                                    .slice(0, 70)
                            )}
                            ${
                                product.description.length > 70
                                ? "..."
                                : ""
                            }
                        </small>
                    `
                    : ""
                }

            </div>

        </td>


        <td>

            <span class="category-pill">
                ${escapeHTML(categoryName)}
            </span>

        </td>


        <td>

            <strong class="price-main">
                ${rupiah(price)}
            </strong>

        </td>


        <td>

            <span class="cost-price">
                ${rupiah(product.cost_price)}
            </span>

        </td>


        <td>

            ${
                hasPromo
                ? `
                    <span class="promo-price">
                        ${rupiah(promo)}
                    </span>
                `
                : `
                    <span class="no-promo">
                        -
                    </span>
                `
            }

        </td>


        <td>

            <span
                class="
                    stock-pill
                    ${stock === 0
                        ? "empty"
                        : stock <= 3
                            ? "low"
                            : "available"
                    }
                "
            >
                ${
                    stock === 0
                    ? "Habis"
                    : stock
                }
            </span>

        </td>


        <td>

            <span
                class="
                    status-pill
                    ${
                        product.is_active
                        ? "active"
                        : "inactive"
                    }
                "
            >

                <i
                    class="
                        fa-solid
                        ${
                            product.is_active
                            ? "fa-circle-check"
                            : "fa-circle-xmark"
                        }
                    "
                ></i>

                ${
                    product.is_active
                    ? "Aktif"
                    : "Nonaktif"
                }

            </span>

        </td>


        <td>

            <div class="action-buttons">

                <button
                    type="button"
                    class="btn-variant"
                    title="Kelola varian produk"
                    aria-label="Kelola varian produk"
                >
                    <i class="fa-solid fa-layer-group"></i>
                </button>


                <button
                    type="button"
                    class="btn-edit"
                    title="Edit produk"
                    aria-label="Edit produk"
                >
                    <i class="fa-solid fa-pen"></i>
                </button>


                <button
                    type="button"
                    class="btn-delete"
                    title="Hapus produk"
                    aria-label="Hapus produk"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>

            </div>

        </td>
    `;


    /* IMAGE */
    const imageButton =
        row.querySelector(
            ".product-thumbnail-btn"
        );


    if (imageButton) {

        imageButton.addEventListener(
            "click",
            () => {

                openImageModal(
                    images,
                    0
                );
            }
        );
    }


    /* VARIANT */
    row.querySelector(
        ".btn-variant"
    )?.addEventListener(
        "click",
        () => openVariantModal(product)
    );


    /* EDIT */
    row.querySelector(
        ".btn-edit"
    )?.addEventListener(
        "click",
        () => editProduct(product.id)
    );


    /* DELETE */
    row.querySelector(
        ".btn-delete"
    )?.addEventListener(
        "click",
        () => deleteProduct(product.id)
    );


    return row;
}


function updateProductTotal(total) {

    const badge =
        document.getElementById(
            "productTotalBadge"
        );


    if (!badge) return;


    badge.innerHTML = `
        <i class="fa-solid fa-box"></i>
        <span>${total} Produk</span>
    `;
}


/* =========================================================
   IMAGE SELECTION
========================================================= */

function handleImageSelection(event) {

    const files =
        Array.from(
            event.target.files || []
        );


    if (files.length === 0) {
        return;
    }


    const currentImages =
        getRemainingExistingImages().length +
        selectedImageFiles.length;


    if (
        currentImages + files.length >
        MAX_PRODUCT_IMAGES
    ) {

        alert(
            `Maksimal ${MAX_PRODUCT_IMAGES} gambar produk.`
        );

        event.target.value = "";

        return;
    }


    const invalidFile =
        files.find(
            file =>
                !file.type.startsWith(
                    "image/"
                ) ||
                file.size >
                MAX_IMAGE_SIZE
        );


    if (invalidFile) {

        alert(
            `File "${invalidFile.name}" tidak valid atau lebih dari 5 MB.`
        );

        event.target.value = "";

        return;
    }


    selectedImageFiles = [
        ...selectedImageFiles,
        ...files
    ];


    /* Hindari duplikat file */
    selectedImageFiles =
        selectedImageFiles.filter(
            (file, index, array) =>
                index ===
                array.findIndex(
                    other =>
                        other.name === file.name &&
                        other.size === file.size &&
                        other.lastModified ===
                        file.lastModified
                )
        );


    event.target.value = "";

    renderImagePreviews();

    updateImageCount();
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function renderImagePreviews() {

    const container =
        document.getElementById(
            "imagePreviewContainer"
        );


    if (!container) return;


    container.innerHTML = "";


    const images = [];


    /* GAMBAR LAMA */
    existingImageUrls.forEach(
        (url, originalIndex) => {

            if (
                !removedExistingImages.includes(
                    originalIndex
                )
            ) {

                images.push({
                    type: "existing",
                    url,
                    index: originalIndex
                });
            }
        }
    );


    /* GAMBAR BARU */
    selectedImageFiles.forEach(
        (file, index) => {

            images.push({
                type: "new",
                url:
                    URL.createObjectURL(file),
                index
            });
        }
    );


    if (images.length === 0) {

        container.innerHTML = `
            <div class="image-preview-empty">
                <i class="fa-regular fa-images"></i>

                <span>
                    Belum ada gambar produk
                </span>

                <small>
                    Gambar pertama akan menjadi gambar utama.
                </small>
            </div>
        `;

        updateImageCount();

        return;
    }


    images
        .slice(0, MAX_PRODUCT_IMAGES)
        .forEach(
            (image, displayIndex) => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "image-preview-item" +
                    (
                        displayIndex === 0
                        ? " image-preview-main"
                        : ""
                    );


                item.innerHTML = `

                    <img
                        src="${escapeHTML(image.url)}"
                        alt="Gambar produk ${displayIndex + 1}"
                    >


                    ${
                        displayIndex === 0
                        ? `
                            <div class="image-preview-label">
                                <i class="fa-solid fa-star"></i>
                                Gambar Utama
                            </div>
                        `
                        : `
                            <div class="image-preview-number">
                                ${displayIndex + 1}
                            </div>
                        `
                    }


                    <button
                        type="button"
                        class="image-preview-remove"
                        title="Hapus gambar"
                        aria-label="Hapus gambar"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                `;


                item
                    .querySelector("img")
                    ?.addEventListener(
                        "click",
                        () => {

                            openImageModal(
                                images.map(
                                    img =>
                                        img.url
                                ),
                                displayIndex
                            );
                        }
                    );


                item
                    .querySelector(
                        ".image-preview-remove"
                    )
                    ?.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            removePreviewImage(
                                image
                            );
                        }
                    );


                container.appendChild(
                    item
                );
            }
        );


    updateImageCount();
}


function removePreviewImage(image) {

    if (
        image.type ===
        "existing"
    ) {

        if (
            !removedExistingImages.includes(
                image.index
            )
        ) {

            removedExistingImages.push(
                image.index
            );
        }

    } else {

        selectedImageFiles.splice(
            image.index,
            1
        );
    }


    renderImagePreviews();

    updateImageCount();
}


function updateImageCount() {

    const badge =
        document.getElementById(
            "imageCountBadge"
        );


    if (!badge) return;


    const count =
        getRemainingExistingImages().length +
        selectedImageFiles.length;


    badge.textContent =
        `${Math.min(
            count,
            MAX_PRODUCT_IMAGES
        )} / ${MAX_PRODUCT_IMAGES}`;
}


/* =========================================================
   IMAGE MODAL
========================================================= */

function openImageModal(
    images,
    index = 0
) {

    if (
        !Array.isArray(images) ||
        images.length === 0
    ) {
        return;
    }


    currentModalImages =
        images.filter(Boolean);


    currentModalIndex =
        Math.max(
            0,
            Math.min(
                index,
                currentModalImages.length - 1
            )
        );


    const modal =
        document.getElementById(
            "imageModal"
        );


    if (!modal) return;


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "modal-open"
    );


    updateModalImage();


    updateModalNavigation();
}


function updateModalImage() {

    const image =
        document.getElementById(
            "imageModalMain"
        );


    const counter =
        document.getElementById(
            "imageModalCounter"
        );


    if (!image) return;


    image.src =
        currentModalImages[
            currentModalIndex
        ] || "";


    if (counter) {

        counter.textContent =
            `${currentModalIndex + 1} / ${currentModalImages.length}`;
    }
}


function updateModalNavigation() {

    const prev =
        document.getElementById(
            "imageModalPrev"
        );


    const next =
        document.getElementById(
            "imageModalNext"
        );


    const total =
        currentModalImages.length;


    if (total <= 1) {

        if (prev) {
            prev.style.display =
                "none";
        }

        if (next) {
            next.style.display =
                "none";
        }

    } else {

        if (prev) {
            prev.style.display =
                "flex";
        }

        if (next) {
            next.style.display =
                "flex";
        }
    }
}


function closeImageModal() {

    const modal =
        document.getElementById(
            "imageModal"
        );


    if (!modal) return;


    modal.classList.remove(
        "active"
    );


    document.body.classList.remove(
        "modal-open"
    );


    const image =
        document.getElementById(
            "imageModalMain"
        );


    if (image) {
        image.src = "";
    }


    currentModalImages = [];

    currentModalIndex = 0;
}


function showPreviousImage() {

    if (
        currentModalImages.length <= 1
    ) {
        return;
    }


    currentModalIndex--;


    if (
        currentModalIndex < 0
    ) {

        currentModalIndex =
            currentModalImages.length - 1;
    }


    updateModalImage();
}


function showNextImage() {

    if (
        currentModalImages.length <= 1
    ) {
        return;
    }


    currentModalIndex++;


    if (
        currentModalIndex >=
        currentModalImages.length
    ) {

        currentModalIndex = 0;
    }


    updateModalImage();
}


/* =========================================================
   KEYBOARD
========================================================= */

function handleGlobalKeyboard(event) {

    const variantModal =
        document.getElementById(
            "variantModal"
        );


    if (
        event.key === "Escape" &&
        variantModal?.classList.contains(
            "active"
        )
    ) {
        closeVariantModal();
        return;
    }


    const modal =
        document.getElementById(
            "imageModal"
        );


    if (
        modal?.classList.contains(
            "active"
        )
    ) {

        if (event.key === "Escape") {

            closeImageModal();

            return;
        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            showPreviousImage();

            return;
        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            showNextImage();

            return;
        }
    }


    const categoryBox =
        document.getElementById(
            "newCategoryBox"
        );


    if (
        event.key === "Escape" &&
        categoryBox &&
        !categoryBox.hasAttribute("hidden")
    ) {

        categoryBox.setAttribute(
            "hidden",
            ""
        );
    }
}


/* =========================================================
   SAVE PRODUCT
========================================================= */

async function saveProduct() {

    if (isSaving) {
        return;
    }


    const id =
        document.getElementById(
            "productId"
        )?.value.trim();


    const name =
        normalizeText(
            document.getElementById(
                "productName"
            )?.value
        );


    const categoryId =
        document.getElementById(
            "productCategory"
        )?.value || null;


    const price =
        parseNumber(
            document.getElementById(
                "productPrice"
            )?.value
        );


    const costPrice =
        parseNumber(
            document.getElementById(
                "productCost"
            )?.value
        );


    const promoPrice =
        parseNumber(
            document.getElementById(
                "productPromo"
            )?.value
        );


    const stock =
        parseNumber(
            document.getElementById(
                "productStock"
            )?.value
        );


    const desc =
        document.getElementById(
            "productDesc"
        )?.value.trim() || "";


    const isActive =
        document.getElementById(
            "productActive"
        )?.checked ?? true;


    /* =====================================================
       VALIDATION
    ====================================================== */

    if (!name) {

        alert(
            "Nama produk wajib diisi."
        );

        document
            .getElementById(
                "productName"
            )
            ?.focus();

        return;
    }


    if (price <= 0) {

        alert(
            "Harga jual harus lebih dari Rp 0."
        );

        document
            .getElementById(
                "productPrice"
            )
            ?.focus();

        return;
    }


    if (
        promoPrice > 0 &&
        promoPrice >= price
    ) {

        alert(
            "Harga promo harus lebih rendah dari harga jual."
        );

        document
            .getElementById(
                "productPromo"
            )
            ?.focus();

        return;
    }


    if (costPrice < 0) {

        alert(
            "Harga modal tidak valid."
        );

        return;
    }


    if (stock < 0) {

        alert(
            "Stok tidak boleh negatif."
        );

        return;
    }


    const existingCount =
        getRemainingExistingImages().length;


    if (
        existingCount +
        selectedImageFiles.length >
        MAX_PRODUCT_IMAGES
    ) {

        alert(
            `Jumlah gambar maksimal ${MAX_PRODUCT_IMAGES}.`
        );

        return;
    }


    /* =====================================================
       LOCK BUTTON
    ====================================================== */

    isSaving = true;


    const saveButton =
        document.getElementById(
            "saveProduct"
        );


    const cancelButton =
        document.getElementById(
            "cancelEditBtn"
        );


    const originalButtonHTML =
        saveButton?.innerHTML ||
        "";


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Menyimpan...</span>
        `;
    }


    if (cancelButton) {

        cancelButton.disabled = true;
    }


    /* =====================================================
       UPLOAD GAMBAR BARU
    ====================================================== */

    const newImageUrls = [];
    const uploadedStoragePaths = [];


    try {

        for (
            const file
            of selectedImageFiles
        ) {

            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            const fileName =
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2, 10) +
                "_" +
                safeName;


            const {
                error: uploadError
            } = await client.storage
                .from("produk-images")
                .upload(
                    fileName,
                    file,
                    {
                        cacheControl:
                            "3600",
                        upsert: false
                    }
                );


            if (uploadError) {

                throw new Error(
                    "Gagal upload gambar " +
                    file.name +
                    ": " +
                    uploadError.message
                );
            }


            uploadedStoragePaths.push(
                fileName
            );


            const {
                data
            } =
                client.storage
                    .from("produk-images")
                    .getPublicUrl(
                        fileName
                    );


            if (
                data?.publicUrl
            ) {

                newImageUrls.push(
                    data.publicUrl
                );
            }
        }


        /* =================================================
           GABUNG GAMBAR
        ================================================== */

        const remainingExistingImages =
            getRemainingExistingImages();


        let allImages =
            getImageArrayForStorage([
                ...remainingExistingImages,
                ...newImageUrls
            ]);


        allImages =
            allImages.slice(
                0,
                MAX_PRODUCT_IMAGES
            );


        /* =================================================
           PAYLOAD
        ================================================== */

        const payload = {

            name,

            category_id:
                categoryId,

            price,

            cost_price:
                costPrice,

            promo_price:
                promoPrice,

            stock,

            description:
                desc,

            is_active:
                isActive,

            /*
             * image_urls = gallery utama
             * image_url = gambar pertama
             */
            image_urls:
                allImages,

            image_url:
                allImages.length > 0
                    ? allImages[0]
                    : null
        };


        let error = null;


        /* =================================================
           INSERT
        ================================================== */

        if (!id) {

            const result =
                await client
                    .from("products")
                    .insert(
                        payload
                    );

            error =
                result.error;

        }


        /* =================================================
           UPDATE
        ================================================== */

        else {

            const result =
                await client
                    .from("products")
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        id
                    );

            error =
                result.error;
        }


        /* =================================================
           DATABASE ERROR
        ================================================== */

        if (error) {

            throw new Error(
                error.message
            );
        }


        /* =================================================
           SUCCESS
        ================================================== */

        alert(
            id
                ? "Produk berhasil diperbarui ✅"
                : "Produk berhasil ditambahkan ✅"
        );


        resetForm();

        await loadProducts();

    } catch (error) {

        console.error(
            "Gagal menyimpan produk:",
            error
        );


        /*
         * Bersihkan gambar baru jika database gagal.
         */
        if (
            uploadedStoragePaths.length >
            0
        ) {

            try {

                await client.storage
                    .from("produk-images")
                    .remove(
                        uploadedStoragePaths
                    );

            } catch (
                cleanupError
            ) {

                console.warn(
                    "Gagal cleanup gambar:",
                    cleanupError
                );
            }
        }


        alert(
            "Gagal menyimpan produk:\n" +
            error.message
        );

    } finally {

        isSaving = false;


        if (saveButton) {

            saveButton.disabled = false;

            saveButton.innerHTML =
                originalButtonHTML ||
                `
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>Simpan Produk</span>
                `;
        }


        if (cancelButton) {

            cancelButton.disabled =
                false;
        }
    }
}


/* =========================================================
   EDIT PRODUCT
========================================================= */

async function editProduct(id) {

    if (!id) {
        return;
    }


    const {
        data,
        error
    } = await client
        .from("products")
        .select("*")
        .eq("id", id)
        .single();


    if (error || !data) {

        console.error(
            "Gagal mengambil produk:",
            error
        );

        alert(
            "Data produk tidak ditemukan."
        );

        return;
    }


    document.getElementById(
        "productId"
    ).value =
        data.id;


    document.getElementById(
        "productName"
    ).value =
        data.name || "";


    document.getElementById(
        "productCategory"
    ).value =
        data.category_id || "";


    document.getElementById(
        "productPrice"
    ).value =
        data.price ?? "";


    document.getElementById(
        "productCost"
    ).value =
        data.cost_price ?? "";


    document.getElementById(
        "productPromo"
    ).value =
        data.promo_price ?? "";


    document.getElementById(
        "productStock"
    ).value =
        data.stock ?? "";


    document.getElementById(
        "productDesc"
    ).value =
        data.description || "";


    document.getElementById(
        "productActive"
    ).checked =
        Boolean(
            data.is_active
        );


    /* =====================================================
       LOAD IMAGES
    ====================================================== */

    existingImageUrls =
        getProductImages(data);


    selectedImageFiles = [];

    removedExistingImages = [];


    const imageInput =
        document.getElementById(
            "productImage"
        );


    if (imageInput) {
        imageInput.value = "";
    }


    renderImagePreviews();

    updateImageCount();

    updateDescriptionCounter();


    /* =====================================================
       UI EDIT MODE
    ====================================================== */

    const title =
        document.getElementById(
            "formTitle"
        );


    const badge =
        document.getElementById(
            "formModeBadge"
        );


    const cancel =
        document.getElementById(
            "cancelEditBtn"
        );


    if (title) {

        title.textContent =
            "Edit Produk";
    }


    if (badge) {

        badge.innerHTML = `
            <i class="fa-solid fa-pen"></i>
            Mode Edit
        `;
    }


    if (cancel) {

        cancel.hidden = false;
    }


    document
        .querySelector(
            ".product-form-card"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(id) {

    if (!id) {
        return;
    }


    const confirmed =
        confirm(
            "Apakah Anda yakin ingin menghapus produk ini?\n\nData produk akan dihapus dari database."
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await client
        .from("products")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Gagal menghapus produk:",
            error
        );

        alert(
            "Gagal menghapus produk:\n" +
            error.message
        );

        return;
    }


    alert(
        "Produk berhasil dihapus ✅"
    );


    await loadProducts();
}


/* =========================================================
   RESET FORM
========================================================= */

function resetForm(
    scrollToForm = true
) {

    document.getElementById(
        "productId"
    ).value = "";


    document.getElementById(
        "productName"
    ).value = "";


    document.getElementById(
        "productCategory"
    ).value = "";


    document.getElementById(
        "productPrice"
    ).value = "";


    document.getElementById(
        "productCost"
    ).value = "";


    document.getElementById(
        "productPromo"
    ).value = "";


    document.getElementById(
        "productStock"
    ).value = "";


    document.getElementById(
        "productDesc"
    ).value = "";


    document.getElementById(
        "productActive"
    ).checked = true;


    const imageInput =
        document.getElementById(
            "productImage"
        );


    if (imageInput) {
        imageInput.value = "";
    }


    selectedImageFiles = [];

    existingImageUrls = [];

    removedExistingImages = [];


    const container =
        document.getElementById(
            "imagePreviewContainer"
        );


    if (container) {

        container.innerHTML = `
            <div class="image-preview-empty">
                <i class="fa-regular fa-images"></i>

                <span>
                    Belum ada gambar produk
                </span>

                <small>
                    Gambar pertama akan menjadi gambar utama.
                </small>
            </div>
        `;
    }


    updateImageCount();

    updateDescriptionCounter();


    /* =====================================================
       RESET UI
    ====================================================== */

    const title =
        document.getElementById(
            "formTitle"
        );


    const badge =
        document.getElementById(
            "formModeBadge"
        );


    const cancel =
        document.getElementById(
            "cancelEditBtn"
        );


    if (title) {

        title.textContent =
            "Tambah Produk";
    }


    if (badge) {

        badge.innerHTML = `
            <i class="fa-solid fa-plus"></i>
            Produk Baru
        `;
    }


    if (cancel) {

        cancel.hidden = true;
    }


    if (scrollToForm) {

        document
            .querySelector(
                ".product-form-card"
            )
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }
}


/* =========================================================
   DESCRIPTION COUNTER
========================================================= */

function updateDescriptionCounter() {

    const textarea =
        document.getElementById(
            "productDesc"
        );


    const counter =
        document.getElementById(
            "descriptionCounter"
        );


    if (!textarea || !counter) {
        return;
    }


    counter.textContent =
        textarea.value.length;
}


/* =========================================================
   CSV IMPORT
========================================================= */

/*
 * Parser CSV yang mendukung:
 *
 * name,category,price,...,"Deskripsi, dengan koma",true,url
 *
 * Jadi deskripsi yang mengandung koma
 * tidak akan rusak.
 */
function parseCSV(text) {

    const rows = [];

    let row = [];

    let field = "";

    let insideQuotes = false;


    text =
        String(text || "")
            .replace(/^\uFEFF/, "");


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];


        const next =
            text[i + 1];


        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {

            field += '"';

            i++;

            continue;
        }


        if (char === '"') {

            insideQuotes =
                !insideQuotes;

            continue;
        }


        if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(
                field
                    .trim()
            );

            field = "";

            continue;
        }


        if (
            (
                char === "\n" ||
                char === "\r"
            ) &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {

                i++;
            }


            row.push(
                field
                    .trim()
            );


            if (
                row.some(
                    value =>
                        value !== ""
                )
            ) {

                rows.push(
                    row
                );
            }


            row = [];

            field = "";

            continue;
        }


        field += char;
    }


    if (
        field !== "" ||
        row.length > 0
    ) {

        row.push(
            field.trim()
        );


        if (
            row.some(
                value =>
                    value !== ""
            )
        ) {

            rows.push(
                row
            );
        }
    }


    return rows;
}


function parseBoolean(value) {

    const normalized =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();


    return [
        "true",
        "1",
        "yes",
        "ya",
        "aktif",
        "active"
    ].includes(
        normalized
    );
}


function handleImportFileName(event) {

    const file =
        event.target.files?.[0];


    const label =
        document.getElementById(
            "importFileName"
        );


    if (!label) return;


    label.textContent =
        file
            ? file.name
            : "Pilih file CSV";
}


async function importProducts() {

    if (isImporting) {
        return;
    }


    const fileInput =
        document.getElementById(
            "importFile"
        );


    const resultBox =
        document.getElementById(
            "importResult"
        );


    if (
        !fileInput?.files?.length
    ) {

        alert(
            "Pilih file CSV terlebih dahulu."
        );

        return;
    }


    const file =
        fileInput.files[0];


    if (
        !file.name
            .toLowerCase()
            .endsWith(".csv")
    ) {

        alert(
            "File harus berformat CSV."
        );

        return;
    }


    isImporting = true;


    const importButton =
        document.getElementById(
            "importBtn"
        );


    const originalButtonHTML =
        importButton?.innerHTML ||
        "";


    if (importButton) {

        importButton.disabled = true;

        importButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Memproses...
        `;
    }


    if (resultBox) {

        resultBox.className =
            "import-result loading";

        resultBox.textContent =
            "Membaca file CSV...";
    }


    try {

        const text =
            await file.text();


        const rows =
            parseCSV(text);


        if (rows.length < 2) {

            throw new Error(
                "File CSV tidak memiliki data produk."
            );
        }


        const headers =
            rows[0]
                .map(
                    header =>
                        header
                            .trim()
                            .toLowerCase()
                );


        const requiredColumns = [
            "name",
            "category",
            "price",
            "cost",
            "promo_price",
            "stock",
            "description",
            "is_active"
        ];


        const missingColumns =
            requiredColumns.filter(
                column =>
                    !headers.includes(
                        column
                    )
            );


        if (
            missingColumns.length > 0
        ) {

            throw new Error(
                "Kolom CSV kurang: " +
                missingColumns.join(", ")
            );
        }


        /*
         * image_url bersifat opsional.
         * Jika ada akan digunakan.
         */
        const imageColumnIndex =
            headers.indexOf(
                "image_url"
            );


        const productsToInsert = [];


        for (
            let i = 1;
            i < rows.length;
            i++
        ) {

            const values =
                rows[i];


            const rowData = {};


            headers.forEach(
                (
                    header,
                    index
                ) => {

                    rowData[header] =
                        (
                            values[index] ||
                            ""
                        ).trim();
                }
            );


            const name =
                normalizeText(
                    rowData.name
                );


            if (!name) {

                throw new Error(
                    `Baris ${i + 1}: nama produk kosong.`
                );
            }


            const price =
                parseNumber(
                    rowData.price
                );


            const costPrice =
                parseNumber(
                    rowData.cost
                );


            const promoPrice =
                parseNumber(
                    rowData.promo_price
                );


            const stock =
                parseNumber(
                    rowData.stock
                );


            if (price <= 0) {

                throw new Error(
                    `Baris ${i + 1}: harga produk tidak valid.`
                );
            }


            if (
                promoPrice > 0 &&
                promoPrice >= price
            ) {

                throw new Error(
                    `Baris ${i + 1}: harga promo harus lebih rendah dari harga jual.`
                );
            }


            /* =================================================
               CATEGORY
            ================================================== */

            let categoryId =
                null;


            const categoryName =
                normalizeText(
                    rowData.category
                );


            if (categoryName) {

                const {
                    data: existingCategory,
                    error: categoryCheckError
                } = await client
                    .from("categories")
                    .select("id")
                    .ilike(
                        "name",
                        categoryName
                    )
                    .maybeSingle();


                if (
                    categoryCheckError
                ) {

                    throw new Error(
                        `Baris ${i + 1}: gagal mencari kategori - ${categoryCheckError.message}`
                    );
                }


                if (
                    existingCategory
                ) {

                    categoryId =
                        existingCategory.id;

                } else {

                    const {
                        data: newCategory,
                        error: categoryInsertError
                    } = await client
                        .from("categories")
                        .insert({
                            name:
                                categoryName
                        })
                        .select("id")
                        .single();


                    if (
                        categoryInsertError
                    ) {

                        throw new Error(
                            `Baris ${i + 1}: gagal membuat kategori - ${categoryInsertError.message}`
                        );
                    }


                    categoryId =
                        newCategory.id;
                }
            }


            const imageUrl =
                imageColumnIndex >= 0
                    ? (
                        rowData.image_url ||
                        ""
                    ).trim()
                    : "";


            productsToInsert.push({

                name,

                category_id:
                    categoryId,

                price,

                cost_price:
                    costPrice,

                promo_price:
                    promoPrice,

                stock,

                description:
                    rowData.description ||
                    "",

                image_url:
                    imageUrl ||
                    null,

                image_urls:
                    imageUrl
                        ? [imageUrl]
                        : [],

                is_active:
                    parseBoolean(
                        rowData.is_active
                    )
            });
        }


        if (
            productsToInsert.length === 0
        ) {

            throw new Error(
                "Tidak ada produk yang dapat diimport."
            );
        }


        /* =================================================
           INSERT MASSAL
        ================================================== */

        const {
            error
        } = await client
            .from("products")
            .insert(
                productsToInsert
            );


        if (error) {

            throw new Error(
                error.message
            );
        }


        /* =================================================
           SUCCESS
        ================================================== */

        if (resultBox) {

            resultBox.className =
                "import-result success";

            resultBox.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>

                <div>
                    <strong>
                        Import berhasil
                    </strong>

                    <span>
                        ${productsToInsert.length}
                        produk berhasil ditambahkan.
                    </span>
                </div>
            `;
        }


        fileInput.value = "";


        const fileName =
            document.getElementById(
                "importFileName"
            );


        if (fileName) {

            fileName.textContent =
                "Pilih file CSV";
        }


        await loadProducts();


    } catch (error) {

        console.error(
            "Import CSV error:",
            error
        );


        if (resultBox) {

            resultBox.className =
                "import-result error";

            resultBox.innerHTML = `
                <i class="fa-solid fa-circle-xmark"></i>

                <div>
                    <strong>
                        Import gagal
                    </strong>

                    <span>
                        ${escapeHTML(
                            error.message
                        )}
                    </span>
                </div>
            `;
        }


    } finally {

        isImporting = false;


        if (importButton) {

            importButton.disabled = false;

            importButton.innerHTML =
                originalButtonHTML ||
                `
                    <i class="fa-solid fa-upload"></i>
                    Import Produk
                `;
        }
    }
}


/* =========================================================
   PRODUCT VARIANTS
========================================================= */

function openVariantModal(product) {

    if (!product?.id) {
        return;
    }


    currentVariantProduct = product;
    currentVariants = [];


    const modal =
        document.getElementById(
            "variantModal"
        );


    const productIdInput =
        document.getElementById(
            "variantProductId"
        );


    const productLabel =
        document.getElementById(
            "variantProductLabel"
        );


    if (!modal) {
        return;
    }


    if (productIdInput) {
        productIdInput.value =
            String(product.id);
    }


    if (productLabel) {
        productLabel.textContent =
            product.name ||
            "Produk";
    }


    resetVariantForm();


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );


    loadVariants();
}


function closeVariantModal() {

    const modal =
        document.getElementById(
            "variantModal"
        );


    if (!modal) return;


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    currentVariantProduct = null;
    currentVariants = [];


    resetVariantForm();
}


function resetVariantForm() {

    const variantId =
        document.getElementById(
            "variantId"
        );


    const variantName =
        document.getElementById(
            "variantName"
        );


    const ram =
        document.getElementById(
            "variantRam"
        );


    const storage =
        document.getElementById(
            "variantStorage"
        );


    const color =
        document.getElementById(
            "variantColor"
        );


    const price =
        document.getElementById(
            "variantPrice"
        );


    const promo =
        document.getElementById(
            "variantPromoPrice"
        );


    const stock =
        document.getElementById(
            "variantStock"
        );


    const active =
        document.getElementById(
            "variantActive"
        );


    if (variantId) variantId.value = "";
    if (variantName) variantName.value = "";
    if (ram) ram.value = "";
    if (storage) storage.value = "";
    if (color) color.value = "";
    if (price) price.value = "";
    if (promo) promo.value = "";
    if (stock) stock.value = "";
    if (active) active.checked = true;


    const title =
        document.getElementById(
            "variantFormTitle"
        );


    const badge =
        document.getElementById(
            "variantModeBadge"
        );


    const cancel =
        document.getElementById(
            "cancelVariantEditBtn"
        );


    if (title) {
        title.textContent =
            "Tambah Varian";
    }


    if (badge) {
        badge.innerHTML = `
            <i class="fa-solid fa-plus"></i>
            Varian Baru
        `;
    }


    if (cancel) {
        cancel.hidden = true;
    }
}


async function loadVariants() {

    if (!currentVariantProduct?.id) {
        return;
    }


    const tbody =
        document.getElementById(
            "variantTableBody"
        );


    const refreshButton =
        document.getElementById(
            "refreshVariantsBtn"
        );


    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="variant-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Memuat varian...
                </td>
            </tr>
        `;
    }


    if (refreshButton) {
        refreshButton.disabled = true;
    }


    try {

        const {
            data,
            error
        } = await client
            .from("product_variants")
            .select(`
                id,
                product_id,
                variant_name,
                ram,
                storage,
                color,
                price,
                promo_price,
                stock,
                is_active,
                created_at,
                updated_at
            `)
            .eq(
                "product_id",
                currentVariantProduct.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


        if (error) {
            throw error;
        }


        currentVariants =
            data || [];


        renderVariants();
        updateVariantCount(
            currentVariants.length
        );

    } catch (error) {

        console.error(
            "Gagal memuat varian:",
            error
        );


        currentVariants = [];
        updateVariantCount(0);


        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="variant-error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        Gagal memuat varian: ${escapeHTML(error.message || "Unknown error")}
                    </td>
                </tr>
            `;
        }

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}


function renderVariants() {

    const tbody =
        document.getElementById(
            "variantTableBody"
        );


    if (!tbody) return;


    if (currentVariants.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="variant-empty">
                    <div class="variant-empty-content">
                        <i class="fa-solid fa-layer-group"></i>
                        <strong>Belum ada varian</strong>
                        <span>
                            Tambahkan varian RAM, storage, dan warna menggunakan form di atas.
                        </span>
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML = "";


    currentVariants.forEach(
        (variant, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            const price =
                parseNumber(
                    variant.price
                );


            const promo =
                parseNumber(
                    variant.promo_price
                );


            const stock =
                parseNumber(
                    variant.stock
                );


            const hasPromo =
                promo > 0 &&
                promo < price;


            row.innerHTML = `
                <td class="table-number">
                    ${index + 1}
                </td>

                <td>
                    <strong class="variant-name-cell">
                        ${escapeHTML(variant.variant_name || "-")}
                    </strong>
                </td>

                <td>${escapeHTML(variant.ram || "-")}</td>
                <td>${escapeHTML(variant.storage || "-")}</td>
                <td>${escapeHTML(variant.color || "-")}</td>

                <td>
                    <strong class="price-main">
                        ${rupiah(price)}
                    </strong>
                </td>

                <td>
                    ${
                        hasPromo
                        ? `<span class="promo-price">${rupiah(promo)}</span>`
                        : `<span class="no-promo">-</span>`
                    }
                </td>

                <td>
                    <span
                        class="stock-pill ${
                            stock === 0
                            ? "empty"
                            : stock <= 3
                                ? "low"
                                : "available"
                        }"
                    >
                        ${stock === 0 ? "Habis" : stock}
                    </span>
                </td>

                <td>
                    <span
                        class="status-pill ${
                            variant.is_active
                            ? "active"
                            : "inactive"
                        }"
                    >
                        <i class="fa-solid ${
                            variant.is_active
                            ? "fa-circle-check"
                            : "fa-circle-xmark"
                        }"></i>
                        ${
                            variant.is_active
                            ? "Aktif"
                            : "Nonaktif"
                        }
                    </span>
                </td>

                <td>
                    <div class="variant-action-buttons">
                        <button
                            type="button"
                            class="variant-edit-btn"
                            title="Edit varian"
                            aria-label="Edit varian"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="variant-delete-btn"
                            title="Hapus varian"
                            aria-label="Hapus varian"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;


            row
                .querySelector(
                    ".variant-edit-btn"
                )
                ?.addEventListener(
                    "click",
                    () => editVariant(variant)
                );


            row
                .querySelector(
                    ".variant-delete-btn"
                )
                ?.addEventListener(
                    "click",
                    () => deleteVariant(variant)
                );


            tbody.appendChild(row);
        }
    );
}


function updateVariantCount(total) {

    const badge =
        document.getElementById(
            "variantCountBadge"
        );


    if (!badge) return;


    badge.textContent =
        `${total} Varian`;
}


function buildVariantName(
    ram,
    storage,
    color
) {

    return [
        ram,
        storage,
        color
    ]
        .map(normalizeText)
        .filter(Boolean)
        .join(" / ");
}


function getVariantSignature(variant) {

    return [
        normalizeText(variant.ram).toLowerCase(),
        normalizeText(variant.storage).toLowerCase(),
        normalizeText(variant.color).toLowerCase()
    ].join("|");
}


async function saveVariant() {

    if (
        isSavingVariant ||
        !currentVariantProduct?.id
    ) {
        return;
    }


    const id =
        document.getElementById(
            "variantId"
        )?.value.trim();


    const ram =
        normalizeText(
            document.getElementById(
                "variantRam"
            )?.value
        );


    const storage =
        normalizeText(
            document.getElementById(
                "variantStorage"
            )?.value
        );


    const color =
        normalizeText(
            document.getElementById(
                "variantColor"
            )?.value
        );


    let variantName =
        normalizeText(
            document.getElementById(
                "variantName"
            )?.value
        );


    const price =
        parseNumber(
            document.getElementById(
                "variantPrice"
            )?.value
        );


    const promoPrice =
        parseNumber(
            document.getElementById(
                "variantPromoPrice"
            )?.value
        );


    const stock =
        parseNumber(
            document.getElementById(
                "variantStock"
            )?.value
        );


    const isActive =
        document.getElementById(
            "variantActive"
        )?.checked ?? true;


    if (!ram && !storage && !color) {

        alert(
            "Isi minimal salah satu spesifikasi varian: RAM, storage, atau warna."
        );

        document
            .getElementById(
                "variantRam"
            )
            ?.focus();

        return;
    }


    if (!variantName) {
        variantName =
            buildVariantName(
                ram,
                storage,
                color
            );
    }


    if (price <= 0) {

        alert(
            "Harga jual varian harus lebih dari Rp 0."
        );

        document
            .getElementById(
                "variantPrice"
            )
            ?.focus();

        return;
    }


    if (
        promoPrice > 0 &&
        promoPrice >= price
    ) {

        alert(
            "Harga promo varian harus lebih rendah dari harga jual."
        );

        document
            .getElementById(
                "variantPromoPrice"
            )
            ?.focus();

        return;
    }


    const newSignature =
        getVariantSignature({
            ram,
            storage,
            color
        });


    const duplicate =
        currentVariants.find(
            variant =>
                String(variant.id) !==
                    String(id || "") &&
                getVariantSignature(variant) ===
                    newSignature
        );


    if (duplicate) {

        const continueSave =
            confirm(
                `Varian dengan spesifikasi yang sama sudah ada:\n\n${duplicate.variant_name || "Tanpa nama"}\n\nTetap simpan varian ini?`
            );


        if (!continueSave) {
            return;
        }
    }


    const payload = {
        product_id:
            currentVariantProduct.id,
        variant_name:
            variantName,
        ram:
            ram || null,
        storage:
            storage || null,
        color:
            color || null,
        price,
        promo_price:
            promoPrice,
        stock,
        is_active:
            isActive
    };


    if (id) {
        payload.updated_at =
            new Date().toISOString();
    }


    const saveButton =
        document.getElementById(
            "saveVariantBtn"
        );


    const cancelButton =
        document.getElementById(
            "cancelVariantEditBtn"
        );


    const originalHTML =
        saveButton?.innerHTML ||
        "";


    isSavingVariant = true;


    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Menyimpan...</span>
        `;
    }


    if (cancelButton) {
        cancelButton.disabled = true;
    }


    try {

        let error = null;


        if (id) {

            const result =
                await client
                    .from("product_variants")
                    .update(payload)
                    .eq("id", id)
                    .eq(
                        "product_id",
                        currentVariantProduct.id
                    );

            error = result.error;

        } else {

            const result =
                await client
                    .from("product_variants")
                    .insert(payload);

            error = result.error;
        }


        if (error) {
            throw error;
        }


        await loadVariants();
        await syncProductStockFromVariants();


        resetVariantForm();


        alert(
            id
            ? "Varian berhasil diperbarui ✅"
            : "Varian berhasil ditambahkan ✅"
        );

    } catch (error) {

        console.error(
            "Gagal menyimpan varian:",
            error
        );


        alert(
            "Gagal menyimpan varian:\n" +
            (error.message || "Unknown error")
        );

    } finally {

        isSavingVariant = false;


        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML =
                originalHTML ||
                `
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>Simpan Varian</span>
                `;
        }


        if (cancelButton) {
            cancelButton.disabled = false;
        }
    }
}


function editVariant(variant) {

    if (!variant?.id) {
        return;
    }


    document.getElementById(
        "variantId"
    ).value =
        variant.id;


    document.getElementById(
        "variantName"
    ).value =
        variant.variant_name || "";


    document.getElementById(
        "variantRam"
    ).value =
        variant.ram || "";


    document.getElementById(
        "variantStorage"
    ).value =
        variant.storage || "";


    document.getElementById(
        "variantColor"
    ).value =
        variant.color || "";


    document.getElementById(
        "variantPrice"
    ).value =
        variant.price ?? "";


    document.getElementById(
        "variantPromoPrice"
    ).value =
        variant.promo_price ?? "";


    document.getElementById(
        "variantStock"
    ).value =
        variant.stock ?? 0;


    document.getElementById(
        "variantActive"
    ).checked =
        Boolean(
            variant.is_active
        );


    const title =
        document.getElementById(
            "variantFormTitle"
        );


    const badge =
        document.getElementById(
            "variantModeBadge"
        );


    const cancel =
        document.getElementById(
            "cancelVariantEditBtn"
        );


    if (title) {
        title.textContent =
            "Edit Varian";
    }


    if (badge) {
        badge.innerHTML = `
            <i class="fa-solid fa-pen"></i>
            Mode Edit
        `;
    }


    if (cancel) {
        cancel.hidden = false;
    }


    document
        .querySelector(
            ".variant-form-card"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


async function deleteVariant(variant) {

    if (
        !variant?.id ||
        !currentVariantProduct?.id
    ) {
        return;
    }


    const confirmed =
        confirm(
            `Hapus varian ini?\n\n${variant.variant_name || "Varian tanpa nama"}\n\nData varian akan dihapus dari database.`
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await client
        .from("product_variants")
        .delete()
        .eq("id", variant.id)
        .eq(
            "product_id",
            currentVariantProduct.id
        );


    if (error) {

        console.error(
            "Gagal menghapus varian:",
            error
        );


        alert(
            "Gagal menghapus varian:\n" +
            error.message
        );

        return;
    }


    await loadVariants();
    await syncProductStockFromVariants();


    resetVariantForm();


    alert(
        "Varian berhasil dihapus ✅"
    );
}


async function syncProductStockFromVariants() {

    if (!currentVariantProduct?.id) {
        return;
    }


    const totalStock =
        currentVariants.reduce(
            (total, variant) =>
                total +
                parseNumber(
                    variant.stock
                ),
            0
        );


    const {
        error
    } = await client
        .from("products")
        .update({
            stock: totalStock
        })
        .eq(
            "id",
            currentVariantProduct.id
        );


    if (error) {

        console.warn(
            "Varian tersimpan, tetapi stok produk induk gagal disinkronkan:",
            error
        );

        return;
    }


    currentVariantProduct.stock =
        totalStock;


    await loadProducts();
}


/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function setupMobileNavigation() {

    const toggle =
        document.getElementById(
            "menuToggle"
        );


    const nav =
        document.querySelector(
            ".top-nav"
        );


    const overlay =
        document.getElementById(
            "navOverlay"
        );


    if (
        !toggle ||
        !nav ||
        !overlay
    ) {
        return;
    }


    function openNav() {

        nav.classList.add(
            "active"
        );


        overlay.classList.add(
            "active"
        );


        document.body.classList.add(
            "nav-open"
        );


        toggle.setAttribute(
            "aria-expanded",
            "true"
        );


        toggle.innerHTML = `
            <i class="fa-solid fa-xmark"></i>
        `;
    }


    function closeNav() {

        nav.classList.remove(
            "active"
        );


        overlay.classList.remove(
            "active"
        );


        document.body.classList.remove(
            "nav-open"
        );


        toggle.setAttribute(
            "aria-expanded",
            "false"
        );


        toggle.innerHTML = `
            <i class="fa-solid fa-bars"></i>
        `;
    }


    toggle.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                nav.classList.contains(
                    "active"
                )
            ) {

                closeNav();

            } else {

                openNav();
            }
        }
    );


    overlay.addEventListener(
        "click",
        closeNav
    );


    document
        .querySelectorAll(
            ".nav-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    closeNav
                );
            }
        );


    window.addEventListener(
        "resize",
        () => {

            if (
                window.innerWidth >
                768
            ) {

                closeNav();
            }
        }
    );
}
