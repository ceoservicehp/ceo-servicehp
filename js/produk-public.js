"use strict";

/* =========================================================
   CEO PART & SERVICE
   PUBLIC PRODUCT PAGE
========================================================= */

const client = window.supabaseClient;

/*
 * GANTI DENGAN NOMOR WHATSAPP CEO
 *
 * Format:
 * 628xxxxxxxxxx
 *
 * Jangan menggunakan:
 * +62
 * spasi
 * tanda -
 */
const WHATSAPP_NUMBER = "628xxxxxxxxxx";


/* =========================================================
   STATE
========================================================= */

let allProducts = [];
let filteredProducts = [];

let selectedProduct = null;
let selectedPrice = 0;

let selectedProductImages = [];
let selectedImageIndex = 0;


/* =========================================================
   HELPERS
========================================================= */

function rupiah(value) {

    const number = Number(value || 0);

    return "Rp " + number.toLocaleString("id-ID");

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function getProductPrice(product) {

    const price = Number(product?.price || 0);

    const promo = Number(product?.promo_price || 0);

    if (
        promo > 0 &&
        promo < price
    ) {
        return promo;
    }

    return price;

}


function hasPromo(product) {

    const price = Number(product?.price || 0);
    const promo = Number(product?.promo_price || 0);

    return (
        promo > 0 &&
        promo < price
    );

}


function getCategoryName(product) {

    return (
        product?.categories?.name ||
        "Umum"
    );

}


function getProductImages(product) {

    let images = [];

    if (
        Array.isArray(product?.image_urls)
    ) {

        images = product.image_urls
            .filter(Boolean)
            .map(url => String(url).trim())
            .filter(Boolean);

    }

    /*
     * Compatibility dengan produk lama
     * yang hanya memiliki image_url.
     */
    if (
        images.length === 0 &&
        product?.image_url
    ) {

        images = [
            String(product.image_url).trim()
        ];

    }

    /*
     * Fallback jika produk tidak memiliki gambar.
     */
    if (images.length === 0) {

        images = [
            "images/logo.png"
        ];

    }

    /*
     * Hilangkan URL duplikat.
     */
    return [
        ...new Set(images)
    ];

}


function getStockStatus(stock) {

    const value = Number(stock || 0);

    if (value <= 0) {

        return {
            text: "Stok Habis",
            className: "empty"
        };

    }

    if (value <= 3) {

        return {
            text: `Stok ${value}`,
            className: "low"
        };

    }

    return {
        text: `Stok ${value}`,
        className: ""
    };

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    setupEvents();

    setFooterYear();

    await loadCategories();

    await loadProducts();

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    const searchInput =
        document.getElementById("searchProduct");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const sortProduct =
        document.getElementById("sortProduct");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (sortProduct) {

        sortProduct.addEventListener(
            "change",
            applyFilters
        );

    }


    /* ============================
       MODAL
    ============================ */

    document
        .getElementById("modalClose")
        ?.addEventListener(
            "click",
            closeProductModal
        );


    document
        .getElementById("modalOverlay")
        ?.addEventListener(
            "click",
            closeProductModal
        );


    /* ============================
       QUANTITY
    ============================ */

    document
        .getElementById("qtyMinus")
        ?.addEventListener(
            "click",
            decreaseQuantity
        );


    document
        .getElementById("qtyPlus")
        ?.addEventListener(
            "click",
            increaseQuantity
        );


    document
        .getElementById("productQty")
        ?.addEventListener(
            "input",
            handleQuantityInput
        );


    /* ============================
       WHATSAPP
    ============================ */

    document
        .getElementById("whatsappOrderBtn")
        ?.addEventListener(
            "click",
            orderViaWhatsApp
        );


    /* ============================
       IMAGE GALLERY
    ============================ */

    document
        .getElementById("modalImagePrev")
        ?.addEventListener(
            "click",
            showPreviousImage
        );


    document
        .getElementById("modalImageNext")
        ?.addEventListener(
            "click",
            showNextImage
        );


    /* ============================
       MOBILE MENU
    ============================ */

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const mainNav =
        document.getElementById("mainNav");


    mobileMenuBtn?.addEventListener(
        "click",
        () => {

            const isOpen =
                mainNav.classList.toggle("show");

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            const icon =
                mobileMenuBtn.querySelector("i");

            if (icon) {

                icon.className =
                    isOpen
                        ? "fa-solid fa-xmark"
                        : "fa-solid fa-bars";

            }

        }
    );


    /*
     * Tutup menu ketika klik link.
     */
    mainNav?.querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    mainNav.classList.remove("show");

                    mobileMenuBtn?.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                    const icon =
                        mobileMenuBtn?.querySelector("i");

                    if (icon) {

                        icon.className =
                            "fa-solid fa-bars";

                    }

                }
            );

        });


    /* ============================
       KEYBOARD
    ============================ */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeProductModal();

            }

            if (
                document
                    .getElementById("productModal")
                    ?.classList.contains("show")
            ) {

                if (event.key === "ArrowLeft") {

                    showPreviousImage();

                }

                if (event.key === "ArrowRight") {

                    showNextImage();

                }

            }

        }
    );

}


/* =========================================================
   FOOTER YEAR
========================================================= */

function setFooterYear() {

    const footerYear =
        document.getElementById("footerYear");

    if (footerYear) {

        footerYear.textContent =
            new Date().getFullYear();

    }

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    const loading =
        document.getElementById("productLoading");

    const grid =
        document.getElementById("productGrid");

    const empty =
        document.getElementById("productEmpty");


    if (loading) {

        loading.style.display = "flex";

    }

    if (grid) {

        grid.innerHTML = "";

    }

    if (empty) {

        empty.classList.remove("show");

    }


    const {
        data,
        error
    } = await client
        .from("products")
        .select(`
            *,
            categories(name)
        `)
        .eq("is_active", true)
        .order("created_at", {
            ascending: false
        });


    if (loading) {

        loading.style.display = "none";

    }


    if (error) {

        console.error(
            "Gagal memuat produk:",
            error
        );

        showProductError();

        return;

    }


    allProducts =
        Array.isArray(data)
            ? data
            : [];


    applyFilters();

}


/* =========================================================
   LOAD CATEGORIES
========================================================= */

async function loadCategories() {

    const select =
        document.getElementById("categoryFilter");


    if (!select) return;


    const {
        data,
        error
    } = await client
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name", {
            ascending: true
        });


    if (error) {

        console.error(
            "Gagal memuat kategori:",
            error
        );

        return;

    }


    select.innerHTML = `
        <option value="">
            Semua Kategori
        </option>
    `;


    (data || []).forEach(category => {

        const option =
            document.createElement("option");

        option.value =
            category.id;

        option.textContent =
            category.name;

        select.appendChild(option);

    });

}


/* =========================================================
   FILTER + SORT
========================================================= */

function applyFilters() {

    const searchInput =
        document.getElementById("searchProduct");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const sortProduct =
        document.getElementById("sortProduct");


    const keyword =
        String(
            searchInput?.value || ""
        )
        .trim()
        .toLowerCase();


    const categoryId =
        String(
            categoryFilter?.value || ""
        );


    const sortValue =
        sortProduct?.value ||
        "newest";


    filteredProducts =
        allProducts.filter(product => {

            const name =
                String(
                    product?.name || ""
                ).toLowerCase();


            const description =
                String(
                    product?.description || ""
                ).toLowerCase();


            const categoryName =
                getCategoryName(product)
                    .toLowerCase();


            const matchSearch =
                !keyword ||
                name.includes(keyword) ||
                description.includes(keyword) ||
                categoryName.includes(keyword);


            const matchCategory =
                !categoryId ||
                String(product?.category_id || "") ===
                categoryId;


            return (
                matchSearch &&
                matchCategory
            );

        });


    /* ============================
       SORT
    ============================ */

    filteredProducts.sort(
        (a, b) => {

            if (sortValue === "name-asc") {

                return String(a?.name || "")
                    .localeCompare(
                        String(b?.name || ""),
                        "id"
                    );

            }


            if (sortValue === "price-low") {

                return (
                    getProductPrice(a) -
                    getProductPrice(b)
                );

            }


            if (sortValue === "price-high") {

                return (
                    getProductPrice(b) -
                    getProductPrice(a)
                );

            }


            /*
             * newest
             */
            return (
                new Date(b?.created_at || 0) -
                new Date(a?.created_at || 0)
            );

        }
    );


    renderProducts();

}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

    const grid =
        document.getElementById("productGrid");

    const empty =
        document.getElementById("productEmpty");


    if (!grid) return;


    grid.innerHTML = "";


    if (
        filteredProducts.length === 0
    ) {

        empty?.classList.add("show");

        return;

    }


    empty?.classList.remove("show");


    filteredProducts.forEach(
        product => {

            grid.appendChild(
                createProductCard(product)
            );

        }
    );

}


/* =========================================================
   PRODUCT CARD
========================================================= */

function createProductCard(product) {

    const card =
        document.createElement("article");

    card.className =
        "product-card";


    const images =
        getProductImages(product);

    const mainImage =
        images[0];


    const price =
        getProductPrice(product);


    const originalPrice =
        Number(product?.price || 0);


    const promo =
        hasPromo(product);


    const stock =
        Number(product?.stock || 0);


    const stockStatus =
        getStockStatus(stock);


    const category =
        getCategoryName(product);


    const name =
        product?.name ||
        "Produk";


    card.innerHTML = `

        <div class="product-image">

            <img
                src="${escapeHTML(mainImage)}"
                alt="${escapeHTML(name)}"
                loading="lazy"
            >

            ${
                promo
                    ? `
                        <span class="product-badge">
                            PROMO
                        </span>
                    `
                    : ""
            }

            <span
                class="stock-badge ${stockStatus.className}"
            >
                ${escapeHTML(stockStatus.text)}
            </span>


            ${
                images.length > 1
                    ? `
                        <span class="product-image-count">
                            <i class="fa-solid fa-images"></i>
                            ${images.length}
                        </span>
                    `
                    : ""
            }

        </div>


        <div class="product-info">

            <span class="product-category">
                ${escapeHTML(category)}
            </span>

            <div class="product-name">
                ${escapeHTML(name)}
            </div>


            <div class="product-price">

                ${
                    promo
                        ? `
                            <span class="promo">
                                ${rupiah(price)}
                            </span>

                            <span class="old">
                                ${rupiah(originalPrice)}
                            </span>
                        `
                        : `
                            <span class="normal">
                                ${rupiah(price)}
                            </span>
                        `
                }

            </div>


            ${
                stock > 0
                    ? `
                        <button
                            type="button"
                            class="product-action"
                        >
                            <i class="fa-solid fa-eye"></i>
                            Lihat Produk
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            class="product-action disabled"
                            disabled
                        >
                            <i class="fa-solid fa-ban"></i>
                            Stok Habis
                        </button>
                    `
            }

        </div>

    `;


    /*
     * Hanya produk dengan stok yang bisa dibuka
     * untuk pemesanan.
     */
    if (stock > 0) {

        const button =
            card.querySelector(
                ".product-action"
            );


        button?.addEventListener(
            "click",
            () => openProductModal(product)
        );


        /*
         * Klik gambar juga membuka detail.
         */
        card
            .querySelector(".product-image")
            ?.addEventListener(
                "click",
                () => openProductModal(product)
            );

    }


    return card;

}


/* =========================================================
   OPEN PRODUCT MODAL
========================================================= */

function openProductModal(product) {

    if (!product) return;


    selectedProduct =
        product;


    selectedPrice =
        getProductPrice(product);


    selectedProductImages =
        getProductImages(product);


    selectedImageIndex =
        0;


    const stock =
        Number(product?.stock || 0);


    const modal =
        document.getElementById("productModal");


    const modalCategory =
        document.getElementById("modalCategory");


    const modalName =
        document.getElementById("modalName");


    const modalPrice =
        document.getElementById("modalPrice");


    const modalStock =
        document.getElementById("modalStock");


    const modalDescription =
        document.getElementById("modalDescription");


    const quantity =
        document.getElementById("productQty");


    const whatsappButton =
        document.getElementById("whatsappOrderBtn");


    if (!modal) return;


    modalCategory.textContent =
        getCategoryName(product);


    modalName.textContent =
        product?.name ||
        "Produk";


    /*
     * Harga publik selalu harga jual/promo.
     * cost_price tidak pernah digunakan.
     */
    modalPrice.innerHTML =
        hasPromo(product)
            ? `
                <span class="promo">
                    ${rupiah(selectedPrice)}
                </span>

                <span class="old">
                    ${rupiah(product.price)}
                </span>
            `
            : `
                <span class="normal">
                    ${rupiah(selectedPrice)}
                </span>
            `;


    if (stock > 0) {

        modalStock.textContent =
            `Stok tersedia: ${stock}`;

        modalStock.classList.remove(
            "empty"
        );

    } else {

        modalStock.textContent =
            "Stok habis";

        modalStock.classList.add(
            "empty"
        );

    }


    modalDescription.textContent =
        product?.description ||
        "Tidak ada deskripsi produk.";


    /*
     * Quantity
     */
    quantity.value =
        stock > 0
            ? 1
            : 0;

    quantity.min =
        stock > 0
            ? 1
            : 0;

    quantity.max =
        stock;


    /*
     * WhatsApp
     */
    whatsappButton.disabled =
        stock <= 0;


    /*
     * Quantity controls
     */
    document.getElementById(
        "qtyMinus"
    ).disabled = stock <= 0;


    document.getElementById(
        "qtyPlus"
    ).disabled = stock <= 0;


    renderModalImage();

    updateModalTotal();


    modal.classList.add("show");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeProductModal() {

    const modal =
        document.getElementById("productModal");


    if (!modal) return;


    modal.classList.remove("show");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    selectedProduct =
        null;


    selectedProductImages =
        [];


    selectedImageIndex =
        0;

}


/* =========================================================
   MODAL IMAGE
========================================================= */

function renderModalImage() {

    const image =
        document.getElementById("modalImage");

    const counter =
        document.getElementById(
            "modalImageCounter"
        );

    const prev =
        document.getElementById(
            "modalImagePrev"
        );

    const next =
        document.getElementById(
            "modalImageNext"
        );

    const thumbnails =
        document.getElementById(
            "modalThumbnails"
        );


    if (!image) return;


    const images =
        selectedProductImages.length
            ? selectedProductImages
            : ["images/logo.png"];


    const current =
        images[selectedImageIndex] ||
        images[0];


    image.src =
        current;


    image.alt =
        selectedProduct?.name ||
        "Produk";


    if (counter) {

        counter.textContent =
            `${selectedImageIndex + 1} / ${images.length}`;

    }


    /*
     * Tombol navigasi hanya tampil
     * jika gambar lebih dari satu.
     */
    const hasMultiple =
        images.length > 1;


    if (prev) {

        prev.style.display =
            hasMultiple
                ? "flex"
                : "none";

    }


    if (next) {

        next.style.display =
            hasMultiple
                ? "flex"
                : "none";

    }


    /*
     * Thumbnails
     */
    if (thumbnails) {

        thumbnails.innerHTML = "";


        if (images.length <= 1) {

            thumbnails.style.display =
                "none";

        } else {

            thumbnails.style.display =
                "flex";


            images.forEach(
                (url, index) => {

                    const button =
                        document.createElement(
                            "button"
                        );


                    button.type =
                        "button";


                    button.className =
                        "modal-thumbnail";


                    if (
                        index ===
                        selectedImageIndex
                    ) {

                        button.classList.add(
                            "active"
                        );

                    }


                    button.innerHTML = `

                        <img
                            src="${escapeHTML(url)}"
                            alt="Gambar ${index + 1}"
                        >

                    `;


                    button.addEventListener(
                        "click",
                        () => {

                            selectedImageIndex =
                                index;

                            renderModalImage();

                        }
                    );


                    thumbnails.appendChild(
                        button
                    );

                }
            );

        }

    }

}


/* =========================================================
   PREVIOUS IMAGE
========================================================= */

function showPreviousImage() {

    if (
        selectedProductImages.length <= 1
    ) {
        return;
    }


    selectedImageIndex--;

    if (
        selectedImageIndex < 0
    ) {

        selectedImageIndex =
            selectedProductImages.length - 1;

    }


    renderModalImage();

}


/* =========================================================
   NEXT IMAGE
========================================================= */

function showNextImage() {

    if (
        selectedProductImages.length <= 1
    ) {
        return;
    }


    selectedImageIndex++;


    if (
        selectedImageIndex >=
        selectedProductImages.length
    ) {

        selectedImageIndex = 0;

    }


    renderModalImage();

}


/* =========================================================
   QUANTITY
========================================================= */

function getCurrentQuantity() {

    const input =
        document.getElementById(
            "productQty"
        );


    return Math.max(
        1,
        Number(input?.value || 1)
    );

}


function decreaseQuantity() {

    if (!selectedProduct) return;


    const input =
        document.getElementById(
            "productQty"
        );


    const current =
        Number(input.value || 1);


    if (current > 1) {

        input.value =
            current - 1;

    }


    updateModalTotal();

}


function increaseQuantity() {

    if (!selectedProduct) return;


    const input =
        document.getElementById(
            "productQty"
        );


    const stock =
        Number(
            selectedProduct?.stock || 0
        );


    const current =
        Number(input.value || 1);


    if (
        current < stock
    ) {

        input.value =
            current + 1;

    }


    updateModalTotal();

}


function handleQuantityInput() {

    if (!selectedProduct) return;


    const input =
        document.getElementById(
            "productQty"
        );


    const stock =
        Number(
            selectedProduct?.stock || 0
        );


    let quantity =
        Number(input.value || 1);


    if (stock <= 0) {

        quantity = 0;

    } else {

        if (quantity < 1) {

            quantity = 1;

        }

        if (quantity > stock) {

            quantity = stock;

        }

    }


    input.value =
        quantity;


    updateModalTotal();

}


/* =========================================================
   MODAL TOTAL
========================================================= */

function updateModalTotal() {

    const total =
        document.getElementById(
            "modalTotal"
        );


    if (!total) return;


    if (!selectedProduct) {

        total.textContent =
            "Rp 0";

        return;

    }


    const quantity =
        Number(
            document.getElementById(
                "productQty"
            )?.value || 0
        );


    total.textContent =
        rupiah(
            selectedPrice *
            quantity
        );

}


/* =========================================================
   WHATSAPP ORDER
========================================================= */

function orderViaWhatsApp() {

    if (!selectedProduct) return;


    const stock =
        Number(
            selectedProduct?.stock || 0
        );


    if (stock <= 0) {

        return;

    }


    /*
     * Pastikan nomor WhatsApp sudah diganti.
     */
    if (
        !WHATSAPP_NUMBER ||
        WHATSAPP_NUMBER.includes("x")
    ) {

        alert(
            "Nomor WhatsApp toko belum dikonfigurasi."
        );

        return;

    }


    const quantity =
        getCurrentQuantity();


    const productName =
        selectedProduct?.name ||
        "Produk";


    const category =
        getCategoryName(
            selectedProduct
        );


    const total =
        selectedPrice *
        quantity;


    const promoText =
        hasPromo(selectedProduct)
            ? " (Harga Promo)"
            : "";


    const message =
        `Halo CEO Part & Service 👋

Saya ingin memesan produk:

📦 Produk: ${productName}
🏷️ Kategori: ${category}
💰 Harga: ${rupiah(selectedPrice)}${promoText}
🔢 Jumlah: ${quantity}
💵 Total: ${rupiah(total)}

Mohon informasi ketersediaan dan proses pemesanannya.

Terima kasih 🙏`;


    const url =
        "https://wa.me/" +
        WHATSAPP_NUMBER +
        "?text=" +
        encodeURIComponent(message);


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

}


/* =========================================================
   ERROR STATE
========================================================= */

function showProductError() {

    const grid =
        document.getElementById(
            "productGrid"
        );


    const empty =
        document.getElementById(
            "productEmpty"
        );


    if (grid) {

        grid.innerHTML = `

            <div class="product-error">

                <div class="empty-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>
                    Produk gagal dimuat
                </h3>

                <p>
                    Terjadi masalah saat mengambil
                    data produk. Silakan coba lagi.
                </p>

                <button
                    type="button"
                    class="product-action"
                    id="retryProductBtn"
                >
                    <i class="fa-solid fa-rotate-right"></i>
                    Coba Lagi
                </button>

            </div>

        `;

    }


    empty?.classList.remove("show");


    document
        .getElementById(
            "retryProductBtn"
        )
        ?.addEventListener(
            "click",
            loadProducts
        );

}
