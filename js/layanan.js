"use strict";

/* =========================================================
   CEO ORDER SERVICE
   layanan.js
   ========================================================= */

const client = window.supabaseClient;

/* =========================================================
   STATE
   ========================================================= */

let spareparts = {};
let allProducts = [];

let currentKeyword = "";
let currentCategory = "";

let transportCost = 0;

let metode,
    mapSection,
    transportSection,
    proof,
    alamatToko,
    resiSection,
    resiInput,
    ekspedisiInput,
    sparepartPriceEl,
    transportPriceEl,
    totalPriceEl,
    transportRow,
    ongkir,
    coordInput,
    distanceInfo;

let mapInstance = null;
let marker = null;

let paymentSection,
    paymentMethod,
    paymentInfo;

const TOKO_LAT = -6.166946854281742;
const TOKO_LNG = 106.80309915767154;

const WA_NUMBER = "628138892098";


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* -----------------------------------------------------
       SUPABASE CHECK
       ----------------------------------------------------- */

    if (!client) {
        console.error("Supabase client belum tersedia.");
        alert("Supabase belum terhubung. Silakan refresh halaman.");
        return;
    }


    /* -----------------------------------------------------
       OPTIONAL PRODUCT ELEMENTS
       
       Section produk pada layanan.html saat ini memang
       sudah dinonaktifkan/dihapus karena produk memiliki
       halaman tersendiri.

       Jadi fungsi produk hanya dijalankan jika element
       products-container memang tersedia.
       ----------------------------------------------------- */

    const productsContainer =
        document.getElementById("products-container");

    const searchSparepart =
        document.getElementById("searchSparepart");

    const filterCategory =
        document.getElementById("filterCategory");


    if (searchSparepart) {

        searchSparepart.addEventListener("input", () => {

            currentKeyword =
                searchSparepart.value.trim().toLowerCase();

            renderProducts();

        });

    }


    if (filterCategory) {

        filterCategory.addEventListener("change", () => {

            currentCategory =
                filterCategory.value;

            renderProducts();

        });

    }


    /*
     * Jangan load catalog produk jika container
     * memang tidak ada.
     */
    if (productsContainer) {

        loadProducts();
        loadCategoriesFilter();

    }


    /* =====================================================
       SERVICE ELEMENTS
       ===================================================== */

    metode =
        document.getElementById("service-option");

    mapSection =
        document.getElementById("map-section");

    transportSection =
        document.getElementById("transport-section");

    proof =
        document.getElementById("payment-proof");

    alamatToko =
        document.getElementById("alamat-toko");

    resiSection =
        document.getElementById("resi-section");

    resiInput =
        document.getElementById("customer-resi");

    ekspedisiInput =
        document.getElementById("customer-ekspedisi");

    sparepartPriceEl =
        document.getElementById("sparepart-price");

    transportPriceEl =
        document.getElementById("transport-price");

    totalPriceEl =
        document.getElementById("total-price");

    transportRow =
        document.getElementById("transport-row");

    ongkir =
        document.getElementById("transport-fee");

    coordInput =
        document.getElementById("customer-coord");

    distanceInfo =
        document.getElementById("distance-info");


    /* =====================================================
       PAYMENT ELEMENTS
       ===================================================== */

    paymentSection =
        document.getElementById("payment-section");

    paymentMethod =
        document.getElementById("payment-method");

    paymentInfo =
        document.getElementById("payment-info");


    /* =====================================================
       EXPEDITION
       ===================================================== */

    if (ekspedisiInput) {

        ekspedisiInput.addEventListener("change", () => {

            const labelResi =
                document.getElementById("label-resi");

            if (!labelResi) return;

            const expedition =
                ekspedisiInput.value;

            const driverBased =
                [
                    "Gojek",
                    "Grab",
                    "Maxim",
                    "Lalamove"
                ].includes(expedition);


            if (driverBased) {

                labelResi.textContent =
                    "Nomor Order / Nama Driver";

                if (resiInput) {
                    resiInput.placeholder =
                        "Masukkan nomor order atau nama driver";
                }

            } else {

                labelResi.textContent =
                    "Nomor Resi";

                if (resiInput) {
                    resiInput.placeholder =
                        "Masukkan nomor resi";
                }

            }

        });

    }


    /* =====================================================
       INITIAL SERVICE UI
       ===================================================== */

    if (mapSection) {
        mapSection.style.display = "none";
    }

    if (transportSection) {
        transportSection.style.display = "none";
    }

    if (proof) {
        const proofSection =
            document.getElementById("payment-proof-section");

        if (proofSection) {
            proofSection.style.display = "none";
        }
    }

    if (alamatToko) {
        alamatToko.style.display = "none";
    }

    if (resiSection) {
        resiSection.style.display = "none";
    }

    if (transportRow) {
        transportRow.style.display = "none";
    }

    if (paymentSection) {
        paymentSection.style.display = "none";
    }


    /* =====================================================
       SERVICE METHOD CHANGE
       ===================================================== */

    if (metode) {

        metode.addEventListener("change", () => {

            const method =
                metode.value;


            /* ---------------------------------------------
               RESET
               --------------------------------------------- */

            if (mapSection) {
                mapSection.style.display = "none";
            }

            if (transportSection) {
                transportSection.style.display = "none";
            }

            if (alamatToko) {
                alamatToko.style.display = "none";
            }

            if (resiSection) {
                resiSection.style.display = "none";
            }

            if (transportRow) {
                transportRow.style.display = "none";
            }

            if (paymentSection) {
                paymentSection.style.display = "none";
            }

            const proofSection =
                document.getElementById("payment-proof-section");

            if (proofSection) {
                proofSection.style.display = "none";
            }


            transportCost = 0;


            /* ---------------------------------------------
               HOME SERVICE
               --------------------------------------------- */

            if (method === "Home Service") {

                if (mapSection) {
                    mapSection.style.display = "block";
                }

                if (transportSection) {
                    transportSection.style.display = "block";
                }

                if (transportRow) {
                    transportRow.style.display = "flex";
                }

                if (paymentSection) {
                    paymentSection.style.display = "block";
                }

                if (proofSection) {
                    proofSection.style.display = "block";
                }

                /*
                 * Initialize map sedikit setelah section
                 * ditampilkan supaya ukuran Leaflet benar.
                 */
                setTimeout(() => {
                    initMap();
                }, 100);

            }


            /* ---------------------------------------------
               KIRIM PAKET
               --------------------------------------------- */

            else if (method === "Kirim Paket") {

                if (alamatToko) {
                    alamatToko.style.display = "block";
                }

                if (resiSection) {
                    resiSection.style.display = "block";
                }

            }


            /* ---------------------------------------------
               DATANG KE TOKO
               --------------------------------------------- */

            else if (method === "Datang ke Toko") {

                if (alamatToko) {
                    alamatToko.style.display = "block";
                }

            }


            updateTotal();

        });

    }


    /* =====================================================
       PAYMENT METHOD
       ===================================================== */

    if (paymentMethod) {

        paymentMethod.addEventListener("change", () => {

            const method =
                paymentMethod.value;

            if (!paymentInfo) return;


            /* ---------------------------------------------
               TRANSFER
               --------------------------------------------- */

            if (method === "Transfer") {

                paymentInfo.innerHTML = `
                    <div class="payment-detail">
                        <strong>Transfer Bank BCA</strong>
                        <p>
                            No. Rekening:
                            <strong id="rekening-number">
                                5855369360
                            </strong>
                        </p>

                        <button
                            type="button"
                            id="copy-rekening"
                            class="copy-btn"
                        >
                            <i class="fas fa-copy"></i>
                            Salin Nomor Rekening
                        </button>
                    </div>
                `;


                const copyRekening =
                    document.getElementById("copy-rekening");

                if (copyRekening) {

                    copyRekening.addEventListener(
                        "click",
                        async () => {

                            try {

                                await navigator.clipboard.writeText(
                                    "5855369360"
                                );

                                copyRekening.innerHTML =
                                    '<i class="fas fa-check"></i> Berhasil Disalin';

                                setTimeout(() => {

                                    copyRekening.innerHTML =
                                        '<i class="fas fa-copy"></i> Salin Nomor Rekening';

                                }, 2000);

                            } catch (error) {

                                console.error(
                                    "Gagal menyalin rekening:",
                                    error
                                );

                                alert(
                                    "Nomor rekening: 5855369360"
                                );

                            }

                        }
                    );

                }

            }


            /* ---------------------------------------------
               QRIS
               --------------------------------------------- */

            else if (method === "QRIS") {

                paymentInfo.innerHTML = `
                    <div class="payment-detail qris-detail">

                        <strong>Scan QRIS</strong>

                        <div class="qris-image-wrapper">
                            <img
                                src="images/qris.jpg"
                                alt="QRIS CEO Part & Service"
                            >
                        </div>

                        <a
                            href="images/qris.jpg"
                            download="qris-ceo-part-service.jpg"
                            class="download-qris"
                        >
                            <i class="fas fa-download"></i>
                            Download QRIS
                        </a>

                    </div>
                `;

            }


            else {

                paymentInfo.innerHTML = "";

            }

        });

    }


    /* =====================================================
       COPY STORE ADDRESS
       ===================================================== */

    const copyAlamat =
        document.getElementById("copy-alamat");

    const alamatText =
        document.getElementById("alamat-text");


    if (copyAlamat && alamatText) {

        copyAlamat.addEventListener("click", async () => {

            try {

                await navigator.clipboard.writeText(
                    alamatText.textContent.trim()
                );

                const original =
                    copyAlamat.innerHTML;

                copyAlamat.innerHTML =
                    '<i class="fas fa-check"></i> Berhasil Disalin';

                setTimeout(() => {

                    copyAlamat.innerHTML =
                        original;

                }, 2000);

            } catch (error) {

                console.error(
                    "Gagal menyalin alamat:",
                    error
                );

                alert(
                    "Alamat toko:\n" +
                    alamatText.textContent.trim()
                );

            }

        });

    }


    /* =====================================================
       GPS BUTTON
       ===================================================== */

    const getLocationBtn =
        document.getElementById("getLocation");


    if (getLocationBtn) {

        getLocationBtn.addEventListener("click", () => {

            if (!navigator.geolocation) {

                alert(
                    "Browser Anda tidak mendukung fitur lokasi."
                );

                return;

            }


            getLocationBtn.disabled = true;

            const originalText =
                getLocationBtn.innerHTML;

            getLocationBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> Mengambil lokasi...';


            navigator.geolocation.getCurrentPosition(

                (position) => {

                    const lat =
                        position.coords.latitude;

                    const lng =
                        position.coords.longitude;


                    if (coordInput) {

                        coordInput.value =
                            `${lat},${lng}`;

                    }


                    initMap();


                    if (mapInstance) {

                        smoothMoveMarker(
                            lat,
                            lng
                        );

                    }


                    getLocationBtn.disabled =
                        false;

                    getLocationBtn.innerHTML =
                        originalText;

                },

                (error) => {

                    console.error(
                        "Geolocation error:",
                        error
                    );


                    getLocationBtn.disabled =
                        false;

                    getLocationBtn.innerHTML =
                        originalText;


                    let message =
                        "Lokasi tidak dapat diambil.";

                    if (error.code === 1) {

                        message =
                            "Izin lokasi ditolak. Silakan izinkan akses lokasi pada browser.";

                    } else if (error.code === 2) {

                        message =
                            "Lokasi tidak tersedia. Pastikan GPS/perangkat lokasi aktif.";

                    } else if (error.code === 3) {

                        message =
                            "Pengambilan lokasi terlalu lama. Silakan coba lagi.";

                    }

                    alert(message);

                },

                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }

            );

        });

    }


    /* =====================================================
       CHECKOUT
       ===================================================== */

    const checkoutBtn =
        document.getElementById("checkout");


    if (checkoutBtn) {

        checkoutBtn.addEventListener(
            "click",
            checkout
        );

    }


    /* =====================================================
       INITIAL TOTAL
       ===================================================== */

    renderCart();
    updateTotal();

});


/* =========================================================
   RUPIAH
   ========================================================= */

function rupiah(n) {

    return (
        "Rp " +
        Number(n || 0).toLocaleString("id-ID")
    );

}


/* =========================================================
   UPDATE TOTAL
   ========================================================= */

function updateTotal() {

    let spareTotal = 0;


    Object.values(spareparts).forEach(item => {

        const price =
            Number(item.price || 0);

        const qty =
            Number(item.qty || 0);

        spareTotal +=
            price * qty;

    });


    const transport =
        Number(transportCost || 0);

    const total =
        spareTotal + transport;


    if (sparepartPriceEl) {

        sparepartPriceEl.textContent =
            rupiah(spareTotal);

    }


    if (transportPriceEl) {

        transportPriceEl.textContent =
            rupiah(transport);

    }


    if (totalPriceEl) {

        totalPriceEl.textContent =
            rupiah(total);

    }


    if (ongkir) {

        ongkir.value =
            transport;

    }

}


/* =========================================================
   HITUNG JARAK
   ========================================================= */

function hitungJarak(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI /
        180;

    const dLng =
        (lng2 - lng1) *
        Math.PI /
        180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


/* =========================================================
   HITUNG ONGKIR
   ========================================================= */

function hitungOngkir(distanceKm) {

    let cost = 20000;


    /*
     * 1 km pertama menggunakan biaya dasar.
     * Setelah lebih dari 1 km:
     * tambahan Rp3.000 per km.
     */

    if (distanceKm > 1) {

        cost +=
            Math.ceil(distanceKm - 1) *
            3000;

    }


    return cost;

}


/* =========================================================
   SMOOTH MOVE MARKER
   ========================================================= */

function smoothMoveMarker(
    lat,
    lng
) {

    if (!mapInstance) return;


    const latLng =
        [lat, lng];


    if (!marker) {

        marker =
            L.marker(latLng)
                .addTo(mapInstance);

    } else {

        marker.setLatLng(latLng);

    }


    mapInstance.setView(
        latLng,
        15
    );


    /* -----------------------------------------------------
       HITUNG JARAK KE TOKO
       ----------------------------------------------------- */

    const distanceKm =
        hitungJarak(
            TOKO_LAT,
            TOKO_LNG,
            lat,
            lng
        );


    transportCost =
        hitungOngkir(distanceKm);


    if (distanceInfo) {

        distanceInfo.textContent =
            `Jarak dari toko: ${distanceKm.toFixed(2)} km`;

    }


    if (transportPriceEl) {

        transportPriceEl.textContent =
            rupiah(transportCost);

    }


    if (ongkir) {

        ongkir.value =
            transportCost;

    }


    updateTotal();


    /* -----------------------------------------------------
       ANIMASI MARKER
       ----------------------------------------------------- */

    if (marker && marker._icon) {

        marker._icon.classList.remove(
            "marker-bounce"
        );


        void marker._icon.offsetWidth;


        marker._icon.classList.add(
            "marker-bounce"
        );

    }

}


/* =========================================================
   INIT MAP
   ========================================================= */

function initMap() {

    const mapElement =
        document.getElementById("map");


    if (!mapElement) return;


    if (mapInstance) {

        setTimeout(() => {

            mapInstance.invalidateSize();

        }, 100);

        return;

    }


    mapInstance =
        L.map(mapElement).setView(
            [
                TOKO_LAT,
                TOKO_LNG
            ],
            13
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(mapInstance);


    /* -----------------------------------------------------
       MARKER TOKO
       ----------------------------------------------------- */

    L.marker([
        TOKO_LAT,
        TOKO_LNG
    ])
        .addTo(mapInstance)
        .bindPopup(
            "<strong>CEO Part & Service</strong><br>Lokasi Toko"
        );


    /* -----------------------------------------------------
       CLICK MAP
       ----------------------------------------------------- */

    mapInstance.on(
        "click",
        (e) => {

            const lat =
                e.latlng.lat;

            const lng =
                e.latlng.lng;


            if (coordInput) {

                coordInput.value =
                    `${lat},${lng}`;

            }


            smoothMoveMarker(
                lat,
                lng
            );

        }
    );


    /* -----------------------------------------------------
       JIKA COORD SUDAH ADA
       ----------------------------------------------------- */

    if (coordInput && coordInput.value) {

        const parts =
            coordInput.value.split(",");


        if (parts.length === 2) {

            const lat =
                parseFloat(parts[0]);

            const lng =
                parseFloat(parts[1]);


            if (
                Number.isFinite(lat) &&
                Number.isFinite(lng)
            ) {

                smoothMoveMarker(
                    lat,
                    lng
                );

            }

        }

    }

}


/* =========================================================
   LOAD PRODUCTS
   =========================================================
   
   Fungsi ini dipertahankan agar tidak merusak sistem lama.
   Namun hanya dipanggil jika products-container tersedia.
   ========================================================= */

async function loadProducts() {

    try {

        const {
            data,
            error
        } = await client
            .from("products")
            .select(`
                id,
                name,
                description,
                price,
                promo_price,
                stock,
                image_url,
                image_urls,
                category_id,
                categories (
                    name
                )
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

            return;

        }


        allProducts =
            data || [];


        renderProducts();

    } catch (error) {

        console.error(
            "Error loadProducts:",
            error
        );

    }

}


/* =========================================================
   ATTACH PRODUCT EVENTS
   ========================================================= */

function attachProductEvents() {

    const buttons =
        document.querySelectorAll(
            ".add-product-btn"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const productId =
                    button.dataset.id;


                const product =
                    allProducts.find(
                        p =>
                            String(p.id) ===
                            String(productId)
                    );


                if (!product) return;


                const price =
                    (
                        Number(product.promo_price || 0) > 0 &&
                        Number(product.promo_price) <
                        Number(product.price || 0)
                    )
                        ? Number(product.promo_price)
                        : Number(product.price || 0);


                const key =
                    String(product.id);


                if (!spareparts[key]) {

                    spareparts[key] = {

                        id:
                            product.id,

                        name:
                            product.name,

                        price:
                            price,

                        qty:
                            1

                    };

                } else {

                    spareparts[key].qty++;

                }


                renderCart();
                updateTotal();

            }
        );

    });

}


/* =========================================================
   LOAD CATEGORY FILTER
   ========================================================= */

async function loadCategoriesFilter() {

    const filter =
        document.getElementById(
            "filterCategory"
        );


    if (!filter) return;


    try {

        const {
            data,
            error
        } = await client
            .from("categories")
            .select(
                "id, name"
            )
            .eq(
                "is_active",
                true
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "Gagal mengambil kategori:",
                error
            );

            return;

        }


        filter.innerHTML =
            `<option value="">Semua Kategori</option>`;


        (data || []).forEach(category => {

            const option =
                document.createElement("option");

            option.value =
                category.id;

            option.textContent =
                category.name;

            filter.appendChild(
                option
            );

        });

    } catch (error) {

        console.error(
            "Error loadCategoriesFilter:",
            error
        );

    }

}


/* =========================================================
   RENDER PRODUCTS
   ========================================================= */

function renderProducts() {

    const container =
        document.getElementById(
            "products-container"
        );


    /*
     * INI ADALAH PERBAIKAN UTAMA.
     *
     * Karena products-container memang sudah tidak ada
     * di layanan.html, fungsi langsung berhenti.
     */

    if (!container) return;


    container.innerHTML = "";


    let products =
        [...allProducts];


    /* -----------------------------------------------------
       SEARCH
       ----------------------------------------------------- */

    if (currentKeyword) {

        products =
            products.filter(product => {

                const name =
                    String(
                        product.name || ""
                    ).toLowerCase();


                const description =
                    String(
                        product.description || ""
                    ).toLowerCase();


                return (
                    name.includes(
                        currentKeyword
                    ) ||
                    description.includes(
                        currentKeyword
                    )
                );

            });

    }


    /* -----------------------------------------------------
       CATEGORY
       ----------------------------------------------------- */

    if (currentCategory) {

        products =
            products.filter(product => {

                return String(
                    product.category_id
                ) === String(
                    currentCategory
                );

            });

    }


    /* -----------------------------------------------------
       EMPTY
       ----------------------------------------------------- */

    if (!products.length) {

        container.innerHTML = `
            <div class="empty-products">
                <i class="fas fa-box-open"></i>
                <p>Produk tidak ditemukan.</p>
            </div>
        `;

        return;

    }


    /* -----------------------------------------------------
       RENDER
       ----------------------------------------------------- */

    products.forEach(product => {

        const price =
            Number(
                product.price || 0
            );


        const promoPrice =
            Number(
                product.promo_price || 0
            );


        const hasPromo =
            promoPrice > 0 &&
            promoPrice < price;


        const finalPrice =
            hasPromo
                ? promoPrice
                : price;


        const stock =
            Number(
                product.stock || 0
            );


        const image =
            product.image_url ||
            "images/logo.png";


        const card =
            document.createElement("div");


        card.className =
            "product-card";


        card.innerHTML = `

            <div class="product-image">

                <img
                    src="${image}"
                    alt="${product.name || "Produk"}"
                    loading="lazy"
                >

            </div>


            <div class="product-info">

                <h3>
                    ${product.name || "-"}
                </h3>


                <div class="product-price">

                    ${
                        hasPromo
                            ? `
                                <span class="old-price">
                                    ${rupiah(price)}
                                </span>
                            `
                            : ""
                    }

                    <strong>
                        ${rupiah(finalPrice)}
                    </strong>

                </div>


                <p class="product-stock">

                    ${
                        stock > 0
                            ? `Stok: ${stock}`
                            : "Stok habis"
                    }

                </p>


                <button
                    type="button"
                    class="add-product-btn"
                    data-id="${product.id}"
                    ${stock <= 0 ? "disabled" : ""}
                >

                    <i class="fas fa-cart-plus"></i>

                    ${
                        stock > 0
                            ? "Tambah"
                            : "Stok Habis"
                    }

                </button>

            </div>

        `;


        container.appendChild(
            card
        );

    });


    attachProductEvents();

}


/* =========================================================
   RENDER CART
   ========================================================= */

function renderCart() {

    const cartItems =
        document.getElementById(
            "cart-items"
        );


    if (!cartItems) return;


    cartItems.innerHTML = "";


    const items =
        Object.values(
            spareparts
        );


    /* -----------------------------------------------------
       EMPTY CART
       ----------------------------------------------------- */

    if (!items.length) {

        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-cart-shopping"></i>
                <p>Belum ada sparepart yang dipilih.</p>
            </div>
        `;

        updateTotal();

        return;

    }


    /* -----------------------------------------------------
       CART ITEMS
       ----------------------------------------------------- */

    items.forEach(item => {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.qty || 0);


        const row =
            document.createElement("div");


        row.className =
            "cart-item";


        row.innerHTML = `

            <div class="cart-item-info">

                <strong>
                    ${item.name}
                </strong>

                <span>
                    ${rupiah(item.price)}
                </span>

            </div>


            <div class="cart-item-actions">

                <button
                    type="button"
                    class="qty-minus"
                    data-id="${item.id}"
                >
                    <i class="fas fa-minus"></i>
                </button>


                <span class="cart-qty">
                    ${item.qty}
                </span>


                <button
                    type="button"
                    class="qty-plus"
                    data-id="${item.id}"
                >
                    <i class="fas fa-plus"></i>
                </button>


                <button
                    type="button"
                    class="remove-cart"
                    data-id="${item.id}"
                    title="Hapus"
                >
                    <i class="fas fa-trash"></i>
                </button>

            </div>


            <div class="cart-item-total">

                ${rupiah(itemTotal)}

            </div>

        `;


        cartItems.appendChild(
            row
        );

    });


    /* =====================================================
       MINUS
       ===================================================== */

    cartItems
        .querySelectorAll(".qty-minus")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        String(
                            button.dataset.id
                        );


                    if (!spareparts[id]) return;


                    spareparts[id].qty--;


                    if (
                        spareparts[id].qty <= 0
                    ) {

                        delete spareparts[id];

                    }


                    renderCart();
                    updateTotal();

                }
            );

        });


    /* =====================================================
       PLUS
       ===================================================== */

    cartItems
        .querySelectorAll(".qty-plus")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        String(
                            button.dataset.id
                        );


                    if (!spareparts[id]) return;


                    spareparts[id].qty++;


                    renderCart();
                    updateTotal();

                }
            );

        });


    /* =====================================================
       REMOVE
       ===================================================== */

    cartItems
        .querySelectorAll(".remove-cart")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        String(
                            button.dataset.id
                        );


                    delete spareparts[id];


                    renderCart();
                    updateTotal();

                }
            );

        });


    updateTotal();

}


/* =========================================================
   CHECKOUT
   ========================================================= */

async function checkout() {

    /*
     * Mencegah tombol diklik berkali-kali
     */

    if (window.sending) return;


    window.sending = true;


    const checkoutBtn =
        document.getElementById(
            "checkout"
        );


    const originalButtonText =
        checkoutBtn
            ? checkoutBtn.innerHTML
            : "";


    try {

        if (!client) {

            throw new Error(
                "Supabase belum terhubung."
            );

        }


        /* =================================================
           AMBIL DATA FORM
           ================================================= */

        const nama =
            document
                .getElementById(
                    "customer-name"
                )
                ?.value
                .trim();


        const alamat =
            document
                .getElementById(
                    "customer-address"
                )
                ?.value
                .trim();


        const phone =
            document
                .getElementById(
                    "customer-phone"
                )
                ?.value
                .trim();


        const kategori =
            document
                .getElementById(
                    "device-category"
                )
                ?.value;


        const model =
            document
                .getElementById(
                    "device-model"
                )
                ?.value
                .trim();


        const problem =
            document
                .getElementById(
                    "customer-problem"
                )
                ?.value
                .trim();


        const method =
            metode
                ?.value;


        /* =================================================
           VALIDATION
           ================================================= */

        if (!nama) {

            alert(
                "Nama lengkap wajib diisi."
            );

            document
                .getElementById(
                    "customer-name"
                )
                ?.focus();

            return;

        }


        if (!alamat) {

            alert(
                "Alamat wajib diisi."
            );

            document
                .getElementById(
                    "customer-address"
                )
                ?.focus();

            return;

        }


        if (!phone) {

            alert(
                "Nomor WhatsApp wajib diisi."
            );

            document
                .getElementById(
                    "customer-phone"
                )
                ?.focus();

            return;

        }


        if (!kategori) {

            alert(
                "Silakan pilih kategori perangkat."
            );

            document
                .getElementById(
                    "device-category"
                )
                ?.focus();

            return;

        }


        if (!model) {

            alert(
                "Model perangkat wajib diisi."
            );

            document
                .getElementById(
                    "device-model"
                )
                ?.focus();

            return;

        }


        if (!problem) {

            alert(
                "Keluhan/permasalahan perangkat wajib diisi."
            );

            document
                .getElementById(
                    "customer-problem"
                )
                ?.focus();

            return;

        }


        if (!method) {

            alert(
                "Silakan pilih metode service."
            );

            metode?.focus();

            return;

        }


        /* =================================================
           HOME SERVICE VALIDATION
           ================================================= */

        if (
            method === "Home Service" &&
            (!coordInput ||
                !coordInput.value.trim())
        ) {

            alert(
                "Silakan tentukan lokasi service terlebih dahulu."
            );

            return;

        }


        /* =================================================
           KIRIM PAKET VALIDATION
           ================================================= */

        let ekspedisi = null;
        let resi = null;


        if (method === "Kirim Paket") {

            if (!ekspedisiInput) {

                alert(
                    "Pilihan ekspedisi tidak tersedia."
                );

                return;

            }


            ekspedisi =
                ekspedisiInput.value;


            resi =
                resiInput
                    ?.value
                    .trim();


            if (!ekspedisi) {

                alert(
                    "Silakan pilih ekspedisi."
                );

                ekspedisiInput.focus();

                return;

            }


            if (!resi) {

                alert(
                    "Nomor resi / nomor order / nama driver wajib diisi."
                );

                resiInput?.focus();

                return;

            }

        }


        /* =================================================
           SPAREPART LIST
           ================================================= */

        const spareList =
            Object.values(
                spareparts
            )
                .map(item => {

                    return {
                        id:
                            item.id,

                        name:
                            item.name,

                        price:
                            Number(
                                item.price || 0
                            ),

                        qty:
                            Number(
                                item.qty || 0
                            ),

                        subtotal:
                            Number(
                                item.price || 0
                            ) *
                            Number(
                                item.qty || 0
                            )
                    };

                });


        const spareTotal =
            spareList.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.subtotal || 0
                    ),
                0
            );


        /* =================================================
           TRANSPORT
           ================================================= */

        const transport =
            method === "Home Service"
                ? Number(
                    transportCost || 0
                )
                : 0;


        const total =
            spareTotal +
            transport;


        /* =================================================
           PAYMENT PROOF
           ================================================= */

        let buktiUrl = null;


        const proofInput =
            document.getElementById(
                "payment-proof"
            );


        if (
            method === "Home Service" &&
            proofInput &&
            proofInput.files &&
            proofInput.files.length > 0
        ) {

            const file =
                proofInput.files[0];


            const maxSize =
                5 * 1024 * 1024;


            if (file.size > maxSize) {

                alert(
                    "Ukuran bukti pembayaran maksimal 5 MB."
                );

                return;

            }


            const extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();


            const allowedExtensions =
                [
                    "jpg",
                    "jpeg",
                    "png",
                    "webp"
                ];


            if (
                !allowedExtensions.includes(
                    extension
                )
            ) {

                alert(
                    "Format bukti pembayaran harus JPG, JPEG, PNG, atau WEBP."
                );

                return;

            }


            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            const fileName =
                `${Date.now()}_${safeName}`;


            const filePath =
                fileName;


            const {
                error: uploadError
            } = await client
                .storage
                .from("bukti-transfer")
                .upload(
                    filePath,
                    file,
                    {
                        upsert: false
                    }
                );


            if (uploadError) {

                console.error(
                    "Upload bukti gagal:",
                    uploadError
                );

                throw new Error(
                    "Bukti pembayaran gagal diupload."
                );

            }


            const {
                data: publicData
            } =
                client
                    .storage
                    .from(
                        "bukti-transfer"
                    )
                    .getPublicUrl(
                        filePath
                    );


            buktiUrl =
                publicData?.publicUrl ||
                null;

        }


        /* =================================================
           BUTTON LOADING
           ================================================= */

        if (checkoutBtn) {

            checkoutBtn.disabled = true;

            checkoutBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Memproses...
            `;

        }


        /* =================================================
           INSERT SERVICE ORDER
           ================================================= */

        const orderData = {

            nama,

            alamat,

            phone,

            kategori_perangkat:
                kategori,

            tipe_model:
                model,

            problem,

            metode:
                method,

            ekspedisi:
                method === "Kirim Paket"
                    ? ekspedisi
                    : null,

            resi:
                method === "Kirim Paket"
                    ? resi
                    : null,

            sparepart:
                spareList,

            total_sparepart:
                spareTotal,

            transport,

            jasa:
                0,

            total,

            coord:
                coordInput?.value ||
                null,

            status:
                "pending",

            bukti:
                buktiUrl

        };


        console.log(
            "Data service order:",
            orderData
        );


        const {
            data,
            error
        } = await client
            .from("service_orders")
            .insert(
                [orderData]
            )
            .select()
            .single();


        if (error) {

            console.error(
                "Gagal menyimpan service order:",
                error
            );

            throw new Error(
                error.message ||
                "Data service gagal disimpan."
            );

        }


        /* =================================================
           WHATSAPP MESSAGE
           ================================================= */

        let message = "";

        message +=
            `*CEO PART & SERVICE*\n`;

        message +=
            `*ORDER SERVICE*\n`;

        message +=
            `━━━━━━━━━━━━━━━━━━\n\n`;


        message +=
            `*Data Pelanggan*\n`;

        message +=
            `Nama: ${nama}\n`;

        message +=
            `WhatsApp: ${phone}\n`;

        message +=
            `Alamat: ${alamat}\n\n`;


        message +=
            `*Perangkat*\n`;

        message +=
            `Kategori: ${kategori}\n`;

        message +=
            `Model: ${model}\n`;

        message +=
            `Keluhan: ${problem}\n\n`;


        message +=
            `*Metode Service*\n`;

        message +=
            `${method}\n\n`;


        /* =================================================
           HOME SERVICE WHATSAPP
           ================================================= */

        if (
            method === "Home Service"
        ) {

            if (
                coordInput &&
                coordInput.value
            ) {

                const coords =
                    coordInput.value;

                const coordinateParts =
                    coords.split(",");


                if (
                    coordinateParts.length === 2
                ) {

                    const lat =
                        coordinateParts[0];

                    const lng =
                        coordinateParts[1];


                    message +=
                        `*Lokasi Service*\n`;

                    message +=
                        `https://www.google.com/maps?q=${lat},${lng}\n\n`;

                }

            }


            message +=
                `Transport: ${rupiah(transport)}\n\n`;

        }


        /* =================================================
           KIRIM PAKET WHATSAPP
           ================================================= */

        if (
            method === "Kirim Paket"
        ) {

            message +=
                `Ekspedisi: ${ekspedisi}\n`;

            message +=
                `Resi / Order: ${resi}\n\n`;

        }


        /* =================================================
           SPAREPART WHATSAPP
           ================================================= */

        if (
            spareList.length > 0
        ) {

            message +=
                `*Sparepart*\n`;


            spareList.forEach(
                item => {

                    message +=
                        `- ${item.name} x${item.qty} = ${rupiah(item.subtotal)}\n`;

                }
            );


            message +=
                `Subtotal Sparepart: ${rupiah(spareTotal)}\n\n`;

        } else {

            message +=
                `Sparepart: Tidak ada\n\n`;

        }


        /* =================================================
           TOTAL
           ================================================= */

        message +=
            `*TOTAL: ${rupiah(total)}*\n\n`;


        message +=
            `Status: Menunggu diproses\n`;

        message +=
            `ID Order: ${data?.id || "-"}\n\n`;


        message +=
            `Terima kasih telah menggunakan layanan CEO Part & Service.`;


        /* =================================================
           OPEN WHATSAPP
           ================================================= */

        const whatsappUrl =
            `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
                message
            )}`;


        window.open(
            whatsappUrl,
            "_blank"
        );


        /* =================================================
           SUCCESS
           ================================================= */

        alert(
            "Order service berhasil dikirim."
        );


        /* =================================================
           RESET FORM
           ================================================= */

        const form =
            document.querySelector(
                "form"
            );


        if (form) {

            form.reset();

        }


        spareparts = {};

        transportCost = 0;


        if (coordInput) {
            coordInput.value = "";
        }


        if (distanceInfo) {
            distanceInfo.textContent = "";
        }


        if (mapInstance) {

            if (marker) {

                mapInstance.removeLayer(
                    marker
                );

                marker = null;

            }

        }


        if (mapSection) {
            mapSection.style.display = "none";
        }

        if (transportSection) {
            transportSection.style.display = "none";
        }

        if (alamatToko) {
            alamatToko.style.display = "none";
        }

        if (resiSection) {
            resiSection.style.display = "none";
        }

        if (transportRow) {
            transportRow.style.display = "none";
        }

        if (paymentSection) {
            paymentSection.style.display = "none";
        }


        const proofSection =
            document.getElementById(
                "payment-proof-section"
            );

        if (proofSection) {
            proofSection.style.display = "none";
        }


        if (paymentInfo) {
            paymentInfo.innerHTML = "";
        }


        renderCart();
        updateTotal();


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        alert(
            error?.message ||
            "Terjadi kesalahan saat mengirim order service."
        );


    } finally {

        window.sending =
            false;


        if (checkoutBtn) {

            checkoutBtn.disabled =
                false;

            checkoutBtn.innerHTML =
                originalButtonText ||
                "Kirim Order";

        }

    }

}
