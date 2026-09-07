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

let selectedVariant = null;
let selectedVariantSpecKey = "";


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


function getVariantPrice(variant) {

    const price = Number(variant?.price || 0);
    const promo = Number(variant?.promo_price || 0);

    if (promo > 0 && promo < price) {
        return promo;
    }

    return price;

}


function getActiveVariants(product) {

    if (!Array.isArray(product?.variants)) {
        return [];
    }

    return product.variants.filter(variant =>
        variant && variant.is_active !== false
    );

}


function getProductPrice(product) {

    const variants = getActiveVariants(product);

    if (variants.length > 0) {

        const prices = variants
            .map(getVariantPrice)
            .filter(price => price > 0);

        if (prices.length > 0) {
            return Math.min(...prices);
        }
    }

    const price = Number(product?.price || 0);
    const promo = Number(product?.promo_price || 0);

    if (promo > 0 && promo < price) {
        return promo;
    }

    return price;

}


function getProductOriginalPrice(product) {

    const variants = getActiveVariants(product);

    if (variants.length > 0) {

        const cheapest = variants
            .filter(v => getVariantPrice(v) > 0)
            .sort((a, b) => getVariantPrice(a) - getVariantPrice(b))[0];

        return Number(cheapest?.price || 0);
    }

    return Number(product?.price || 0);
}


function hasPromo(product) {

    const variants = getActiveVariants(product);

    if (variants.length > 0) {
        return variants.some(variant => {
            const price = Number(variant?.price || 0);
            const promo = Number(variant?.promo_price || 0);
            return promo > 0 && promo < price;
        });
    }

    const price = Number(product?.price || 0);
    const promo = Number(product?.promo_price || 0);

    return promo > 0 && promo < price;
}


function getProductStock(product) {

    const variants = getActiveVariants(product);

    if (variants.length > 0) {
        return variants.reduce(
            (sum, variant) => sum + Number(variant?.stock || 0),
            0
        );
    }

    return Number(product?.stock || 0);
}


function getVariantSpecLabel(variant) {

    const parts = [
        String(variant?.ram || "").trim(),
        String(variant?.storage || "").trim()
    ].filter(Boolean);

    if (parts.length > 0) {
        return parts.join(" / ");
    }

    return String(variant?.variant_name || "Varian").trim() || "Varian";
}


function getVariantSpecKey(variant) {
    return getVariantSpecLabel(variant).toLowerCase();
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
            startProductCheckout
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


    if (loading) loading.style.display = "flex";
    if (grid) grid.innerHTML = "";
    if (empty) empty.classList.remove("show");


    const {
        data: products,
        error: productError
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


    if (productError) {

        if (loading) loading.style.display = "none";

        console.error(
            "Gagal memuat produk:",
            productError
        );

        showProductError();
        return;
    }


    /*
     * Ambil semua varian aktif sekaligus agar card, harga,
     * stok dan modal menggunakan data product_variants.
     */
    const {
        data: variants,
        error: variantError
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
        .eq("is_active", true)
        .order("created_at", {
            ascending: true
        });


    if (variantError) {
        console.warn(
            "Varian publik gagal dimuat. Pastikan policy SELECT untuk anon tersedia:",
            variantError
        );
    }


    const variantMap = new Map();

    (variants || []).forEach(variant => {

        const key = String(variant.product_id);

        if (!variantMap.has(key)) {
            variantMap.set(key, []);
        }

        variantMap.get(key).push(variant);
    });


    allProducts = (products || []).map(product => ({
        ...product,
        variants: variantMap.get(String(product.id)) || []
    }));


    if (loading) loading.style.display = "none";

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
        getProductOriginalPrice(product);


    const promo =
        hasPromo(product);


    const stock =
        getProductStock(product);


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

            ${
                getActiveVariants(product).length > 0
                    ? `<span class="product-variant-count">${getActiveVariants(product).length} pilihan varian</span>`
                    : ""
            }

            <div class="product-name">
                ${escapeHTML(name)}
            </div>


            <div class="product-price">

                ${
                    promo
                        ? `
                            <span class="promo">
                                ${getActiveVariants(product).length > 1 ? "Mulai " : ""}${rupiah(price)}
                            </span>

                            <span class="old">
                                ${rupiah(originalPrice)}
                            </span>
                        `
                        : `
                            <span class="normal">
                                ${getActiveVariants(product).length > 1 ? "Mulai " : ""}${rupiah(price)}
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

    selectedProduct = product;
    selectedVariant = null;
    selectedVariantSpecKey = "";

    selectedPrice = getProductPrice(product);
    selectedProductImages = getProductImages(product);
    selectedImageIndex = 0;

    const modal = document.getElementById("productModal");
    const modalCategory = document.getElementById("modalCategory");
    const modalName = document.getElementById("modalName");
    const modalDescription = document.getElementById("modalDescription");

    if (!modal) return;

    if (modalCategory) {
        modalCategory.textContent = getCategoryName(product);
    }

    if (modalName) {
        modalName.textContent = product?.name || "Produk";
    }

    if (modalDescription) {
        modalDescription.textContent =
            product?.description ||
            "Tidak ada deskripsi produk.";
    }

    renderVariantSelector();
    renderModalImage();
    updateModalTotal();

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}


function renderVariantSelector() {

    const variants = getActiveVariants(selectedProduct);

    const area = document.getElementById("variantArea");
    const specOptions = document.getElementById("variantSpecOptions");
    const colorSection = document.getElementById("variantColorSection");
    const colorOptions = document.getElementById("variantColorOptions");
    const summary = document.getElementById("selectedVariantSummary");

    if (!area || !specOptions || !colorSection || !colorOptions) {
        applyProductFallbackSelection();
        return;
    }

    specOptions.innerHTML = "";
    colorOptions.innerHTML = "";
    colorSection.hidden = true;

    if (summary) {
        summary.hidden = true;
        summary.innerHTML = "";
    }

    if (variants.length === 0) {
        area.hidden = true;
        applyProductFallbackSelection();
        return;
    }

    area.hidden = false;

    const groups = new Map();

    variants.forEach(variant => {
        const key = getVariantSpecKey(variant);
        if (!groups.has(key)) {
            groups.set(key, {
                label: getVariantSpecLabel(variant),
                variants: []
            });
        }
        groups.get(key).variants.push(variant);
    });

    groups.forEach((group, key) => {

        const availableStock = group.variants.reduce(
            (sum, variant) => sum + Number(variant.stock || 0),
            0
        );

        const button = document.createElement("button");
        button.type = "button";
        button.className = "variant-option";
        button.dataset.specKey = key;
        button.disabled = availableStock <= 0;

        button.innerHTML = `
            <strong>${escapeHTML(group.label)}</strong>
            <small>${availableStock > 0 ? `Stok ${availableStock}` : "Habis"}</small>
        `;

        button.addEventListener("click", () => {
            selectVariantSpec(key, group.variants);
        });

        specOptions.appendChild(button);
    });

    const availableVariants = variants.filter(v => Number(v.stock || 0) > 0);

    if (availableVariants.length === 1) {
        const onlyVariant = availableVariants[0];
        selectVariantSpec(
            getVariantSpecKey(onlyVariant),
            variants.filter(v =>
                getVariantSpecKey(v) === getVariantSpecKey(onlyVariant)
            ),
            onlyVariant.id
        );
    } else {
        setVariantWaitingState();
    }
}


function selectVariantSpec(specKey, variants, preferredVariantId = null) {

    selectedVariantSpecKey = specKey;
    selectedVariant = null;

    document
        .querySelectorAll("#variantSpecOptions .variant-option")
        .forEach(button => {
            button.classList.toggle(
                "selected",
                button.dataset.specKey === specKey
            );
        });

    const colorSection = document.getElementById("variantColorSection");
    const colorOptions = document.getElementById("variantColorOptions");

    if (!colorSection || !colorOptions) return;

    colorOptions.innerHTML = "";
    colorSection.hidden = false;

    const activeVariants = variants.filter(v => v.is_active !== false);

    activeVariants.forEach(variant => {

        const color = String(variant.color || "Standar").trim() || "Standar";
        const stock = Number(variant.stock || 0);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "variant-option color-option";
        button.dataset.variantId = String(variant.id);
        button.disabled = stock <= 0;

        button.innerHTML = `
            <span class="color-dot" aria-hidden="true"></span>
            <span>
                <strong>${escapeHTML(color)}</strong>
                <small>${stock > 0 ? `Stok ${stock}` : "Habis"}</small>
            </span>
        `;

        button.addEventListener("click", () => {
            chooseVariant(variant);
        });

        colorOptions.appendChild(button);
    });

    const available = activeVariants.filter(v => Number(v.stock || 0) > 0);

    if (preferredVariantId !== null) {
        const preferred = available.find(v => String(v.id) === String(preferredVariantId));
        if (preferred) {
            chooseVariant(preferred);
            return;
        }
    }

    if (available.length === 1) {
        chooseVariant(available[0]);
    } else {
        setVariantWaitingState("Pilih warna untuk melihat harga dan stok.");
    }
}


function chooseVariant(variant) {

    selectedVariant = variant;
    selectedPrice = getVariantPrice(variant);

    document
        .querySelectorAll("#variantColorOptions .variant-option")
        .forEach(button => {
            button.classList.toggle(
                "selected",
                button.dataset.variantId === String(variant.id)
            );
        });

    const summary = document.getElementById("selectedVariantSummary");

    if (summary) {
        summary.hidden = false;
        summary.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <div>
                <strong>${escapeHTML(getVariantSpecLabel(variant))}</strong>
                <span>${escapeHTML(String(variant.color || "Standar"))}</span>
            </div>
        `;
    }

    updateSelectionUI();
}


function applyProductFallbackSelection() {

    selectedVariant = null;
    selectedPrice = getProductPrice(selectedProduct);
    updateSelectionUI(true);
}


function setVariantWaitingState(message = "Pilih varian untuk melihat harga dan stok.") {

    const modalPrice = document.getElementById("modalPrice");
    const modalStock = document.getElementById("modalStock");
    const quantity = document.getElementById("productQty");
    const orderButton = document.getElementById("whatsappOrderBtn");
    const minus = document.getElementById("qtyMinus");
    const plus = document.getElementById("qtyPlus");

    if (modalPrice) {
        modalPrice.innerHTML = `<span class="normal">Pilih varian</span>`;
    }

    if (modalStock) {
        modalStock.textContent = message;
        modalStock.classList.add("empty");
    }

    if (quantity) {
        quantity.value = 0;
        quantity.min = 0;
        quantity.max = 0;
        quantity.disabled = true;
    }

    if (minus) minus.disabled = true;
    if (plus) plus.disabled = true;

    if (orderButton) {
        orderButton.disabled = true;
        orderButton.innerHTML = `
            <i class="fa-solid fa-layer-group"></i>
            Pilih Varian
        `;
    }

    updateModalTotal();
}


function updateSelectionUI(isFallback = false) {

    const modalPrice = document.getElementById("modalPrice");
    const modalStock = document.getElementById("modalStock");
    const quantity = document.getElementById("productQty");
    const orderButton = document.getElementById("whatsappOrderBtn");
    const minus = document.getElementById("qtyMinus");
    const plus = document.getElementById("qtyPlus");

    const source = selectedVariant || selectedProduct;
    const stock = Number(
        selectedVariant
            ? selectedVariant.stock || 0
            : selectedProduct?.stock || 0
    );

    const normalPrice = Number(source?.price || 0);
    const promoPrice = Number(source?.promo_price || 0);
    const promo = promoPrice > 0 && promoPrice < normalPrice;

    if (modalPrice) {
        modalPrice.innerHTML = promo
            ? `
                <span class="promo">${rupiah(selectedPrice)}</span>
                <span class="old">${rupiah(normalPrice)}</span>
            `
            : `<span class="normal">${rupiah(selectedPrice)}</span>`;
    }

    if (modalStock) {
        modalStock.textContent =
            stock > 0
                ? `Stok tersedia: ${stock}`
                : "Stok habis";
        modalStock.classList.toggle("empty", stock <= 0);
    }

    if (quantity) {
        quantity.disabled = stock <= 0;
        quantity.value = stock > 0 ? 1 : 0;
        quantity.min = stock > 0 ? 1 : 0;
        quantity.max = stock;
    }

    if (minus) minus.disabled = stock <= 0;
    if (plus) plus.disabled = stock <= 0;

    if (orderButton) {
        orderButton.disabled = stock <= 0;
        orderButton.innerHTML = stock > 0
            ? `
                <i class="fa-solid fa-arrow-right"></i>
                Lanjutkan Pemesanan
            `
            : `
                <i class="fa-solid fa-ban"></i>
                Stok Habis
            `;
    }

    if (isFallback) {
        const area = document.getElementById("variantArea");
        if (area) area.hidden = true;
    }

    updateModalTotal();
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

    selectedVariant = null;
    selectedVariantSpecKey = "";

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
            selectedVariant
                ? selectedVariant.stock || 0
                : selectedProduct?.stock || 0
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
            selectedVariant
                ? selectedVariant.stock || 0
                : selectedProduct?.stock || 0
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

function startProductCheckout() {

    if (!selectedProduct) return;

    const variants = getActiveVariants(selectedProduct);

    if (variants.length > 0 && !selectedVariant) {
        alert("Silakan pilih varian dan warna terlebih dahulu.");
        return;
    }

    const stock = Number(
        selectedVariant
            ? selectedVariant.stock || 0
            : selectedProduct?.stock || 0
    );

    if (stock <= 0) {
        alert("Stok produk yang dipilih sedang habis.");
        return;
    }

    const quantity = getCurrentQuantity();

    if (quantity < 1 || quantity > stock) {
        alert("Jumlah pesanan tidak sesuai dengan stok yang tersedia.");
        return;
    }

    const checkoutPayload = {
        version: 1,
        product_id: selectedProduct.id,
        variant_id: selectedVariant?.id ?? null,
        product_name: selectedProduct?.name || "Produk",
        category: getCategoryName(selectedProduct),
        variant_name: selectedVariant?.variant_name || "",
        ram: selectedVariant?.ram || "",
        storage: selectedVariant?.storage || "",
        color: selectedVariant?.color || "",
        unit_price: Number(selectedPrice || 0),
        qty: quantity,
        stock_snapshot: stock,
        image_url: getProductImages(selectedProduct)[0] || "images/logo.png",
        created_at: new Date().toISOString()
    };

    try {
        sessionStorage.setItem(
            "ceoProductCheckout",
            JSON.stringify(checkoutPayload)
        );
    } catch (error) {
        console.error("Gagal menyimpan data checkout:", error);
        alert("Browser tidak dapat menyiapkan checkout. Silakan coba lagi.");
        return;
    }

    window.location.href = "checkout-produk.html";
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
