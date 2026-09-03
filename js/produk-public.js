"use strict";

/* =========================================================
   CEO PART & SERVICE
   PUBLIC PRODUCT PAGE
========================================================= */

const client = window.supabaseClient;


/* =========================================================
   CONFIG
========================================================= */

// GANTI dengan nomor WhatsApp CEO.
// Format internasional tanpa + dan tanpa spasi.
//
// Contoh:
// 628123456789
//
const WHATSAPP_NUMBER = "628xxxxxxxxxx";


/* =========================================================
   STATE
========================================================= */

let allProducts = [];
let filteredProducts = [];

let selectedProduct = null;
let selectedPrice = 0;


/* =========================================================
   ELEMENTS
========================================================= */

let productGrid;
let productLoading;
let productEmpty;

let searchProduct;
let categoryFilter;
let sortProduct;

let productModal;
let modalOverlay;
let modalClose;

let modalImage;
let modalCategory;
let modalName;
let modalPrice;
let modalStock;
let modalDescription;

let productQty;
let qtyMinus;
let qtyPlus;

let modalTotal;
let whatsappOrderBtn;

let mobileMenuBtn;
let mainNav;


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

    const promo = Number(product.promo_price || 0);

    const price = Number(product.price || 0);

    if (promo > 0 && promo < price) {
        return promo;
    }

    return price;

}


function hasPromo(product) {

    const promo = Number(product.promo_price || 0);

    const price = Number(product.price || 0);

    return promo > 0 && promo < price;

}


function getCategoryName(product) {

    return product.categories?.name || "Umum";

}


function getImage(product) {

    if (product.image_url) {
        return product.image_url;
    }

    return "images/logo.png";

}


function getStockStatus(stock) {

    const value = Number(stock || 0);

    if (value <= 0) {

        return {
            text: "Stok habis",
            empty: true
        };

    }

    if (value <= 3) {

        return {
            text: `Tersisa ${value}`,
            empty: false
        };

    }

    return {
        text: `Stok ${value}`,
        empty: false
    };

}


/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    productGrid = document.getElementById("productGrid");
    productLoading = document.getElementById("productLoading");
    productEmpty = document.getElementById("productEmpty");

    searchProduct = document.getElementById("searchProduct");
    categoryFilter = document.getElementById("categoryFilter");
    sortProduct = document.getElementById("sortProduct");

    productModal = document.getElementById("productModal");
    modalOverlay = document.getElementById("modalOverlay");
    modalClose = document.getElementById("modalClose");

    modalImage = document.getElementById("modalImage");
    modalCategory = document.getElementById("modalCategory");
    modalName = document.getElementById("modalName");
    modalPrice = document.getElementById("modalPrice");
    modalStock = document.getElementById("modalStock");
    modalDescription = document.getElementById("modalDescription");

    productQty = document.getElementById("productQty");
    qtyMinus = document.getElementById("qtyMinus");
    qtyPlus = document.getElementById("qtyPlus");

    modalTotal = document.getElementById("modalTotal");
    whatsappOrderBtn = document.getElementById("whatsappOrderBtn");

    mobileMenuBtn = document.getElementById("mobileMenuBtn");
    mainNav = document.getElementById("mainNav");


    setupEvents();

    loadCategories();

    loadProducts();

    setFooterYear();

});


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    searchProduct?.addEventListener(
        "input",
        applyFilters
    );


    categoryFilter?.addEventListener(
        "change",
        applyFilters
    );


    sortProduct?.addEventListener(
        "change",
        applyFilters
    );


    modalClose?.addEventListener(
        "click",
        closeProductModal
    );


    modalOverlay?.addEventListener(
        "click",
        closeProductModal
    );


    qtyMinus?.addEventListener(
        "click",
        decreaseQuantity
    );


    qtyPlus?.addEventListener(
        "click",
        increaseQuantity
    );


    productQty?.addEventListener(
        "input",
        validateQuantity
    );


    whatsappOrderBtn?.addEventListener(
        "click",
        orderViaWhatsApp
    );


    mobileMenuBtn?.addEventListener(
        "click",
        toggleMobileMenu
    );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {
                closeProductModal();
            }

        }
    );

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

    showLoading(true);

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


    if (error) {

        console.error(
            "Gagal mengambil produk:",
            error
        );

        showLoading(false);

        productGrid.innerHTML = `
            <div style="
                grid-column: 1 / -1;
                text-align:center;
                padding:50px 20px;
                color:#d93434;
            ">
                <i
                    class="fa-solid fa-triangle-exclamation"
                    style="font-size:30px;margin-bottom:12px;"
                ></i>

                <p>
                    Produk gagal dimuat.
                </p>

                <small>
                    Silakan coba beberapa saat lagi.
                </small>
            </div>
        `;

        return;
    }


    allProducts = data || [];

    filteredProducts = [...allProducts];

    showLoading(false);

    populateCategories();

    applyFilters();

}


/* =========================================================
   LOAD CATEGORIES
========================================================= */

async function loadCategories() {

    const {
        data,
        error
    } = await client
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name");


    if (error) {

        console.error(
            "Gagal mengambil kategori:",
            error
        );

        return;
    }


    categoryFilter.innerHTML = `
        <option value="all">
            Semua Kategori
        </option>
    `;


    (data || []).forEach(category => {

        const option = document.createElement("option");

        option.value = category.id;

        option.textContent = category.name;

        categoryFilter.appendChild(option);

    });

}


/* =========================================================
   POPULATE CATEGORY
========================================================= */

function populateCategories() {

    if (!categoryFilter) return;


    const existingValues = new Set(
        [...categoryFilter.options]
            .map(option => option.value)
    );


    allProducts.forEach(product => {

        if (!product.category_id) return;

        if (existingValues.has(product.category_id)) {
            return;
        }

        const name = getCategoryName(product);

        const option = document.createElement("option");

        option.value = product.category_id;

        option.textContent = name;

        categoryFilter.appendChild(option);

        existingValues.add(product.category_id);

    });

}


/* =========================================================
   FILTER
========================================================= */

function applyFilters() {

    const keyword =
        String(searchProduct?.value || "")
            .trim()
            .toLowerCase();


    const category =
        categoryFilter?.value || "all";


    filteredProducts = allProducts.filter(product => {

        const name =
            String(product.name || "")
                .toLowerCase();

        const description =
            String(product.description || "")
                .toLowerCase();

        const categoryName =
            getCategoryName(product)
                .toLowerCase();


        const matchesSearch =
            !keyword ||
            name.includes(keyword) ||
            description.includes(keyword) ||
            categoryName.includes(keyword);


        const matchesCategory =
            category === "all" ||
            String(product.category_id) === String(category);


        return matchesSearch && matchesCategory;

    });


    applySort();

    renderProducts();

}


/* =========================================================
   SORT
========================================================= */

function applySort() {

    const sort =
        sortProduct?.value || "newest";


    if (sort === "name-asc") {

        filteredProducts.sort(
            (a, b) =>
                String(a.name || "")
                    .localeCompare(
                        String(b.name || ""),
                        "id"
                    )
        );

        return;
    }


    if (sort === "price-low") {

        filteredProducts.sort(
            (a, b) =>
                getProductPrice(a) -
                getProductPrice(b)
        );

        return;
    }


    if (sort === "price-high") {

        filteredProducts.sort(
            (a, b) =>
                getProductPrice(b) -
                getProductPrice(a)
        );

        return;
    }


    // newest
    filteredProducts.sort(
        (a, b) =>
            new Date(b.created_at || 0) -
            new Date(a.created_at || 0)
    );

}


/* =========================================================
   RENDER
========================================================= */

function renderProducts() {

    productGrid.innerHTML = "";

    productEmpty.classList.remove("show");


    if (!filteredProducts.length) {

        productEmpty.classList.add("show");

        return;
    }


    const fragment =
        document.createDocumentFragment();


    filteredProducts.forEach(product => {

        const card =
            createProductCard(product);

        fragment.appendChild(card);

    });


    productGrid.appendChild(fragment);

}


/* =========================================================
   CREATE CARD
========================================================= */

function createProductCard(product) {

    const card =
        document.createElement("article");

    card.className = "product-card";


    const stock =
        Number(product.stock || 0);

    const stockStatus =
        getStockStatus(stock);

    const promo =
        hasPromo(product);

    const price =
        getProductPrice(product);


    const category =
        escapeHTML(getCategoryName(product));

    const name =
        escapeHTML(product.name);

    const image =
        escapeHTML(getImage(product));


    card.innerHTML = `

        <div class="product-image">

            <img
                src="${image}"
                alt="${name}"
                loading="lazy"
                onerror="this.src='images/logo.png'"
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
                class="stock-badge ${
                    stockStatus.empty ? "empty" : ""
                }"
            >
                ${escapeHTML(stockStatus.text)}
            </span>

        </div>


        <div class="product-info">

            <span class="product-category">
                ${category}
            </span>

            <h3 class="product-name">
                ${name}
            </h3>

            <div class="product-price">

                ${
                    promo
                        ? `
                            <span class="promo">
                                ${rupiah(price)}
                            </span>

                            <span class="old">
                                ${rupiah(product.price)}
                            </span>
                        `
                        : `
                            <span class="normal">
                                ${rupiah(price)}
                            </span>
                        `
                }

            </div>


            <button
                type="button"
                class="product-action ${
                    stock <= 0 ? "disabled" : ""
                }"
                data-product-id="${escapeHTML(product.id)}"
                ${stock <= 0 ? "disabled" : ""}
            >

                <i class="fa-solid fa-eye"></i>

                ${
                    stock <= 0
                        ? "Stok Habis"
                        : "Lihat Produk"
                }

            </button>

        </div>

    `;


    const button =
        card.querySelector(".product-action");


    if (stock > 0) {

        button.addEventListener(
            "click",
            () => openProductModal(product)
        );

    }


    return card;

}


/* =========================================================
   MODAL
========================================================= */

function openProductModal(product) {

    selectedProduct = product;

    selectedPrice =
        getProductPrice(product);


    const stock =
        Number(product.stock || 0);


    modalImage.src =
        getImage(product);

    modalImage.alt =
        product.name || "Produk";


    modalCategory.textContent =
        getCategoryName(product);


    modalName.textContent =
        product.name || "Produk";


    modalPrice.textContent =
        rupiah(selectedPrice);


    modalDescription.textContent =
        product.description ||
        "Tidak ada deskripsi produk.";


    if (stock <= 0) {

        modalStock.textContent =
            "Stok habis";

        modalStock.classList.add("empty");

        whatsappOrderBtn.disabled = true;

    } else {

        modalStock.textContent =
            `Stok tersedia: ${stock}`;

        modalStock.classList.remove("empty");

        whatsappOrderBtn.disabled = false;

    }


    productQty.value = 1;

    productQty.min = 1;

    productQty.max = Math.max(stock, 1);


    updateModalTotal();


    productModal.classList.add("show");

    productModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow = "hidden";

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeProductModal() {

    productModal.classList.remove("show");

    productModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

    selectedProduct = null;

}


/* =========================================================
   QUANTITY
========================================================= */

function decreaseQuantity() {

    if (!selectedProduct) return;


    let qty =
        Number(productQty.value || 1);


    qty--;

    if (qty < 1) {
        qty = 1;
    }


    productQty.value = qty;

    updateModalTotal();

}


function increaseQuantity() {

    if (!selectedProduct) return;


    const stock =
        Number(selectedProduct.stock || 0);


    let qty =
        Number(productQty.value || 1);


    qty++;


    if (qty > stock) {
        qty = stock;
    }


    if (qty < 1) {
        qty = 1;
    }


    productQty.value = qty;

    updateModalTotal();

}


function validateQuantity() {

    if (!selectedProduct) return;


    const stock =
        Number(selectedProduct.stock || 0);


    let qty =
        parseInt(productQty.value, 10);


    if (!Number.isFinite(qty)) {
        qty = 1;
    }


    if (qty < 1) {
        qty = 1;
    }


    if (qty > stock) {
        qty = stock;
    }


    productQty.value = qty;

    updateModalTotal();

}


/* =========================================================
   MODAL TOTAL
========================================================= */

function updateModalTotal() {

    if (!selectedProduct) return;


    const qty =
        Number(productQty.value || 1);


    const total =
        selectedPrice * qty;


    modalTotal.textContent =
        rupiah(total);

}


/* =========================================================
   WHATSAPP
========================================================= */

function orderViaWhatsApp() {

    if (!selectedProduct) return;


    const stock =
        Number(selectedProduct.stock || 0);


    if (stock <= 0) {

        alert(
            "Maaf, produk ini sedang tidak tersedia."
        );

        return;
    }


    const qty =
        Number(productQty.value || 1);


    if (qty < 1 || qty > stock) {

        alert(
            "Jumlah pembelian tidak valid."
        );

        return;
    }


    if (
        !WHATSAPP_NUMBER ||
        WHATSAPP_NUMBER.includes("xxxxxxxx")
    ) {

        alert(
            "Nomor WhatsApp toko belum dikonfigurasi."
        );

        return;
    }


    const price =
        selectedPrice;

    const total =
        price * qty;


    const promo =
        hasPromo(selectedProduct);


    const message =

`Halo CEO Part & Service 👋

Saya ingin memesan produk:

📦 *${selectedProduct.name}*

🏷️ Kategori:
${getCategoryName(selectedProduct)}

💰 Harga:
${rupiah(price)}${promo ? " (Harga Promo)" : ""}

🔢 Jumlah:
${qty}

💵 Total:
${rupiah(total)}

Mohon informasi ketersediaan dan proses pemesanannya.

Terima kasih 🙏`;


    const url =
        `https://wa.me/${WHATSAPP_NUMBER}?text=` +
        encodeURIComponent(message);


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

}


/* =========================================================
   MOBILE MENU
========================================================= */

function toggleMobileMenu() {

    mainNav?.classList.toggle("show");

}


/* =========================================================
   LOADING
========================================================= */

function showLoading(show) {

    if (!productLoading) return;


    productLoading.style.display =
        show ? "flex" : "none";

}


/* =========================================================
   FOOTER YEAR
========================================================= */

function setFooterYear() {

    const year =
        document.getElementById("footerYear");


    if (year) {
        year.textContent =
            new Date().getFullYear();
    }

}
