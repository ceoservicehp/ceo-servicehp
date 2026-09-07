"use strict";

const client = window.supabaseClient;

const CHECKOUT_STORAGE_KEY = "ceoProductCheckout";
const CHECKOUT_FORM_KEY = "ceoProductCheckoutForm";

const STORE_LAT = -6.16639026634003;
const STORE_LNG = 106.80295190492956;
const COD_MAX_DISTANCE_KM = 10;
const COD_FIRST_KM_FEE = 20000;
const COD_NEXT_KM_FEE = 3000;

let checkoutItem = null;
let verifiedProduct = null;
let verifiedVariant = null;
let selectedLat = null;
let selectedLng = null;
let currentDistanceKm = null;
let currentShippingFee = 0;
let shippingFeePending = false;
let map = null;
let marker = null;
let isSubmitting = false;

function rupiah(value) {
    return "Rp " + Number(value || 0).toLocaleString("id-ID");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getEffectivePrice(source) {
    const price = Number(source?.price || 0);
    const promo = Number(source?.promo_price || 0);
    return promo > 0 && promo < price ? promo : price;
}

function getSelectedShipping() {
    return document.querySelector('input[name="shippingMethod"]:checked')?.value || "pickup";
}

function getSelectedPayment() {
    return document.querySelector('input[name="paymentMethod"]:checked')?.value || "";
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateCodFee(distanceKm) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
    if (distanceKm <= 1) return COD_FIRST_KM_FEE;
    return COD_FIRST_KM_FEE + Math.ceil(distanceKm - 1) * COD_NEXT_KM_FEE;
}

document.addEventListener("DOMContentLoaded", initCheckout);

async function initCheckout() {
    document.getElementById("footerYear").textContent = new Date().getFullYear();
    loadCheckoutPayload();
    setupMap();
    setupEvents();
    restoreFormDraft();
    renderPaymentOptions();
    updateShippingState();

    if (!checkoutItem) {
        blockCheckout("Data produk tidak ditemukan. Silakan pilih produk kembali dari katalog.");
        return;
    }

    await verifyCheckoutItem();
}

function loadCheckoutPayload() {
    try {
        const raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
        checkoutItem = raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error("Checkout payload rusak:", error);
        checkoutItem = null;
    }
}

function setupMap() {
    const mapEl = document.getElementById("checkoutMap");
    if (!mapEl || typeof L === "undefined") return;

    map = L.map(mapEl).setView([STORE_LAT, STORE_LNG], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const storeMarker = L.marker([STORE_LAT, STORE_LNG]).addTo(map);
    storeMarker.bindPopup("CEO Part & Service — ITC Roxy Mas");

    map.on("click", event => {
        setCustomerLocation(event.latlng.lat, event.latlng.lng, true);
    });
}

function setupEvents() {
    document.getElementById("useMyLocationBtn")?.addEventListener("click", useMyLocation);
    document.getElementById("clearLocationBtn")?.addEventListener("click", clearLocation);

    document.querySelectorAll('input[name="shippingMethod"]').forEach(input => {
        input.addEventListener("change", () => {
            renderPaymentOptions();
            updateShippingState();
            saveFormDraft();
        });
    });

    document.getElementById("shippingProvider")?.addEventListener("change", saveFormDraft);

    ["buyerName", "buyerPhone", "buyerEmail", "buyerAddress", "buyerNotes"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", saveFormDraft);
    });

    document.getElementById("termsAgree")?.addEventListener("change", saveFormDraft);
    document.getElementById("submitOrderBtn")?.addEventListener("click", submitOrder);
}

async function verifyCheckoutItem() {
    const submit = document.getElementById("submitOrderBtn");
    if (submit) {
        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa Pesanan';
    }

    const productId = checkoutItem?.product_id;
    if (!productId) {
        blockCheckout("Produk tidak valid. Silakan pilih ulang dari katalog.");
        return;
    }

    const { data: product, error: productError } = await client
        .from("products")
        .select("id,name,description,price,promo_price,stock,is_active,image_url,image_urls,category_id,categories(name)")
        .eq("id", productId)
        .eq("is_active", true)
        .maybeSingle();

    if (productError || !product) {
        console.error("Gagal verifikasi produk:", productError);
        blockCheckout("Produk tidak tersedia atau tidak dapat diverifikasi.");
        return;
    }

    verifiedProduct = product;

    if (checkoutItem.variant_id) {
        const { data: variant, error: variantError } = await client
            .from("product_variants")
            .select("id,product_id,variant_name,ram,storage,color,price,promo_price,stock,is_active")
            .eq("id", checkoutItem.variant_id)
            .eq("product_id", productId)
            .eq("is_active", true)
            .maybeSingle();

        if (variantError || !variant) {
            console.error("Gagal verifikasi varian:", variantError);
            blockCheckout("Varian yang dipilih sudah tidak tersedia. Silakan pilih ulang.");
            return;
        }
        verifiedVariant = variant;
    }

    const source = verifiedVariant || verifiedProduct;
    const currentStock = Number(source.stock || 0);
    const qty = Math.max(1, Number(checkoutItem.qty || 1));

    if (currentStock < qty) {
        blockCheckout(`Stok berubah. Saat ini hanya tersedia ${currentStock} unit. Silakan pilih ulang jumlah pesanan.`);
        return;
    }

    checkoutItem.qty = qty;
    checkoutItem.unit_price = getEffectivePrice(source);
    checkoutItem.product_name = verifiedProduct.name;
    checkoutItem.variant_name = verifiedVariant?.variant_name || "";
    checkoutItem.ram = verifiedVariant?.ram || "";
    checkoutItem.storage = verifiedVariant?.storage || "";
    checkoutItem.color = verifiedVariant?.color || "";
    checkoutItem.image_url = getMainImage(verifiedProduct);

    sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutItem));
    renderProductSummary();
    updateTotals();

    if (submit) {
        submit.disabled = false;
        submit.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> Buat Pesanan';
    }
}

function getMainImage(product) {
    if (Array.isArray(product?.image_urls) && product.image_urls.filter(Boolean).length) {
        return product.image_urls.filter(Boolean)[0];
    }
    return product?.image_url || "images/logo.png";
}

function renderProductSummary() {
    const box = document.getElementById("productSummary");
    if (!box || !checkoutItem) return;

    const specs = [checkoutItem.ram, checkoutItem.storage].filter(Boolean).join(" / ");
    const variantLine = [specs, checkoutItem.color].filter(Boolean).join(" • ");

    box.innerHTML = `
        <img src="${escapeHTML(checkoutItem.image_url || "images/logo.png")}" alt="${escapeHTML(checkoutItem.product_name)}">
        <div>
            <strong>${escapeHTML(checkoutItem.product_name)}</strong>
            ${variantLine ? `<span>${escapeHTML(variantLine)}</span>` : ""}
            <small>${checkoutItem.qty} × ${rupiah(checkoutItem.unit_price)}</small>
        </div>
    `;
}

function useMyLocation() {
    if (!navigator.geolocation) {
        showAlert("Browser ini tidak mendukung akses lokasi.", "error");
        return;
    }

    const button = document.getElementById("useMyLocationBtn");
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengambil lokasi...';

    navigator.geolocation.getCurrentPosition(
        position => {
            setCustomerLocation(position.coords.latitude, position.coords.longitude, true);
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Gunakan Lokasi Saya';
        },
        error => {
            console.error(error);
            showAlert("Lokasi tidak dapat diambil. Izinkan akses lokasi atau klik titik pada peta.", "error");
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Gunakan Lokasi Saya';
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
}

function setCustomerLocation(lat, lng, centerMap = false) {
    selectedLat = Number(lat);
    selectedLng = Number(lng);
    currentDistanceKm = haversineKm(STORE_LAT, STORE_LNG, selectedLat, selectedLng);

    if (map) {
        if (!marker) {
            marker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(map);
            marker.on("dragend", () => {
                const pos = marker.getLatLng();
                setCustomerLocation(pos.lat, pos.lng, false);
            });
        } else {
            marker.setLatLng([selectedLat, selectedLng]);
        }
        if (centerMap) map.setView([selectedLat, selectedLng], 16);
    }

    const info = document.getElementById("locationInfo");
    if (info) {
        info.classList.add("selected");
        info.innerHTML = `<i class="fa-solid fa-location-dot"></i> Titik dipilih • ${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)} • Jarak garis lurus ± ${currentDistanceKm.toFixed(2)} km dari toko.`;
    }

    updateShippingState();
    saveFormDraft();
}

function clearLocation() {
    selectedLat = null;
    selectedLng = null;
    currentDistanceKm = null;
    currentShippingFee = 0;
    if (marker && map) {
        map.removeLayer(marker);
        marker = null;
    }
    const info = document.getElementById("locationInfo");
    if (info) {
        info.classList.remove("selected");
        info.innerHTML = '<i class="fa-solid fa-circle-info"></i> Belum ada titik lokasi dipilih.';
    }
    updateShippingState();
    saveFormDraft();
}

function renderPaymentOptions() {
    const shipping = getSelectedShipping();
    const wrap = document.getElementById("paymentOptions");
    if (!wrap) return;

    let methods = [];
    if (shipping === "pickup") {
        methods = [
            { value: "transfer", icon: "fa-building-columns", title: "Transfer Bank", note: "Bayar melalui rekening toko." },
            { value: "cash", icon: "fa-money-bill-wave", title: "Cash / Tunai", note: "Bayar saat mengambil produk di toko." }
        ];
    } else if (shipping === "cod") {
        methods = [
            { value: "cod", icon: "fa-hand-holding-dollar", title: "COD", note: "Bayar saat produk diterima." }
        ];
    } else {
        methods = [
            { value: "transfer", icon: "fa-building-columns", title: "Transfer Bank", note: "Pembayaran produk melalui rekening toko." }
        ];
    }

    wrap.innerHTML = methods.map((method, index) => `
        <label class="choice-card payment-choice">
            <input type="radio" name="paymentMethod" value="${method.value}" ${index === 0 ? "checked" : ""}>
            <span class="choice-icon"><i class="fa-solid ${method.icon}"></i></span>
            <span class="choice-body"><strong>${method.title}</strong><small>${method.note}</small></span>
        </label>
    `).join("");

    wrap.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
        input.addEventListener("change", () => {
            updatePaymentInfo();
            saveFormDraft();
        });
    });

    updatePaymentInfo();
}

function updatePaymentInfo() {
    const payment = getSelectedPayment();
    const info = document.getElementById("paymentInfo");
    if (!info) return;

    const messages = {
        transfer: "Detail rekening dan instruksi pembayaran akan ditampilkan/dikirim setelah order tercatat.",
        cash: "Pembayaran tunai dilakukan saat mengambil unit di toko.",
        cod: "Pembayaran COD dilakukan saat unit diterima. COD hanya tersedia dalam radius yang ditentukan."
    };

    info.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${messages[payment] || "Pilih metode pembayaran."}`;
}

function updateShippingState() {
    const shipping = getSelectedShipping();
    const panel = document.getElementById("shippingProviderPanel");
    const select = document.getElementById("shippingProvider");
    const label = document.getElementById("shippingProviderLabel");
    const note = document.getElementById("shippingFeeNote");

    currentShippingFee = 0;
    shippingFeePending = false;

    if (shipping === "instant") {
        panel.hidden = false;
        label.textContent = "Kurir Instan";
        select.innerHTML = '<option value="">Pilih kurir</option><option value="gojek">Gojek</option><option value="grab">Grab</option><option value="other_instant">Lainnya</option>';
        note.innerHTML = '<i class="fa-solid fa-clock"></i> Tarif mengikuti aplikasi kurir dan akan dikonfirmasi admin.';
        shippingFeePending = true;
    } else if (shipping === "package") {
        panel.hidden = false;
        label.textContent = "Ekspedisi";
        select.innerHTML = '<option value="">Pilih ekspedisi</option><option value="jne">JNE</option><option value="jnt">J&T</option><option value="sicepat">SiCepat</option><option value="anteraja">AnterAja</option><option value="pos">POS Indonesia</option><option value="other_package">Lainnya</option>';
        note.innerHTML = '<i class="fa-solid fa-clock"></i> Tarif mengikuti ekspedisi dan akan dikonfirmasi admin.';
        shippingFeePending = true;
    } else if (shipping === "cod") {
        panel.hidden = false;
        label.textContent = "Area COD";
        select.innerHTML = '<option value="ceo_cod">COD CEO Part & Service</option>';

        if (!Number.isFinite(currentDistanceKm)) {
            note.innerHTML = '<i class="fa-solid fa-location-dot"></i> Pilih titik lokasi untuk menghitung ongkir COD.';
        } else if (currentDistanceKm > COD_MAX_DISTANCE_KM) {
            note.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Lokasi ± ${currentDistanceKm.toFixed(2)} km. COD maksimal ${COD_MAX_DISTANCE_KM} km.`;
        } else {
            currentShippingFee = calculateCodFee(currentDistanceKm);
            note.innerHTML = `<i class="fa-solid fa-route"></i> Jarak ± ${currentDistanceKm.toFixed(2)} km • Ongkir COD ${rupiah(currentShippingFee)}.`;
        }
    } else {
        panel.hidden = true;
        select.innerHTML = "";
    }

    updateTotals();
}

function updateTotals() {
    const subtotal = checkoutItem ? Number(checkoutItem.unit_price || 0) * Number(checkoutItem.qty || 0) : 0;
    const total = subtotal + currentShippingFee;

    document.getElementById("summarySubtotal").textContent = rupiah(subtotal);
    document.getElementById("summaryShipping").textContent = shippingFeePending ? "Menunggu konfirmasi" : rupiah(currentShippingFee);
    document.getElementById("summaryTotal").textContent = rupiah(total);
    document.getElementById("pendingShippingText").hidden = !shippingFeePending;
}

function validateCheckout() {
    if (!verifiedProduct) return "Produk belum selesai diverifikasi.";

    const name = document.getElementById("buyerName").value.trim();
    const phone = document.getElementById("buyerPhone").value.trim();
    const email = document.getElementById("buyerEmail").value.trim();
    const address = document.getElementById("buyerAddress").value.trim();
    const shipping = getSelectedShipping();
    const provider = document.getElementById("shippingProvider").value;
    const payment = getSelectedPayment();

    if (!name) return "Nama pembeli wajib diisi.";
    if (!phone) return "Nomor WhatsApp wajib diisi.";
    if (!/^0?8\d{7,13}$/.test(phone.replace(/[\s\-]/g, ""))) return "Nomor WhatsApp belum valid.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Format email belum valid.";
    if (!address) return "Alamat lengkap wajib diisi.";

    if ((shipping === "instant" || shipping === "cod") && (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng))) {
        return "Titik lokasi wajib dipilih untuk Kurir Instan dan COD.";
    }

    if ((shipping === "instant" || shipping === "package") && !provider) {
        return shipping === "instant" ? "Pilih kurir instan." : "Pilih ekspedisi.";
    }

    if (shipping === "cod" && currentDistanceKm > COD_MAX_DISTANCE_KM) {
        return `COD hanya tersedia maksimal ${COD_MAX_DISTANCE_KM} km dari toko.`;
    }

    const allowedPayment = {
        pickup: ["transfer", "cash"],
        instant: ["transfer"],
        package: ["transfer"],
        cod: ["cod"]
    };
    if (!allowedPayment[shipping]?.includes(payment)) return "Metode pembayaran tidak sesuai dengan pengiriman.";
    if (!document.getElementById("termsAgree").checked) return "Centang persetujuan sebelum membuat pesanan.";
    return "";
}

function collectOrderDraft() {
    return {
        item: checkoutItem,
        buyer: {
            name: document.getElementById("buyerName").value.trim(),
            phone: document.getElementById("buyerPhone").value.trim(),
            email: document.getElementById("buyerEmail").value.trim(),
            address: document.getElementById("buyerAddress").value.trim()
        },
        location: {
            lat: selectedLat,
            lng: selectedLng,
            distance_km: currentDistanceKm
        },
        shipping: {
            method: getSelectedShipping(),
            provider: document.getElementById("shippingProvider").value || null,
            fee: currentShippingFee,
            fee_pending: shippingFeePending
        },
        payment: {
            method: getSelectedPayment()
        },
        notes: document.getElementById("buyerNotes").value.trim(),
        subtotal: Number(checkoutItem.unit_price || 0) * Number(checkoutItem.qty || 0),
        total_temporary: Number(checkoutItem.unit_price || 0) * Number(checkoutItem.qty || 0) + currentShippingFee,
        created_at: new Date().toISOString()
    };
}

async function submitOrder() {
    if (isSubmitting) return;

    const validationError = validateCheckout();
    if (validationError) {
        showAlert(validationError, "error");
        return;
    }

    const draft = collectOrderDraft();
    sessionStorage.setItem("ceoProductOrderDraft", JSON.stringify(draft));

    /*
     * Tahap berikutnya akan mengganti blok ini dengan INSERT/RPC Supabase
     * setelah struktur tabel orders + order_items diverifikasi.
     * Frontend checkout sengaja tidak menebak nama kolom database.
     */
    showAlert(
        "Checkout sudah valid. Data pesanan siap disimpan. Selanjutnya sambungkan ke struktur tabel orders/order_items Supabase yang sebenarnya.",
        "success"
    );
}

function saveFormDraft() {
    try {
        const data = {
            name: document.getElementById("buyerName")?.value || "",
            phone: document.getElementById("buyerPhone")?.value || "",
            email: document.getElementById("buyerEmail")?.value || "",
            address: document.getElementById("buyerAddress")?.value || "",
            notes: document.getElementById("buyerNotes")?.value || "",
            terms: document.getElementById("termsAgree")?.checked || false,
            shipping: getSelectedShipping(),
            payment: getSelectedPayment(),
            provider: document.getElementById("shippingProvider")?.value || "",
            lat: selectedLat,
            lng: selectedLng
        };
        sessionStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify(data));
    } catch (_) {}
}

function restoreFormDraft() {
    try {
        const raw = sessionStorage.getItem(CHECKOUT_FORM_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        document.getElementById("buyerName").value = data.name || "";
        document.getElementById("buyerPhone").value = data.phone || "";
        document.getElementById("buyerEmail").value = data.email || "";
        document.getElementById("buyerAddress").value = data.address || "";
        document.getElementById("buyerNotes").value = data.notes || "";
        document.getElementById("termsAgree").checked = Boolean(data.terms);

        const shippingInput = document.querySelector(`input[name="shippingMethod"][value="${data.shipping}"]`);
        if (shippingInput) shippingInput.checked = true;

        if (Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))) {
            setTimeout(() => setCustomerLocation(Number(data.lat), Number(data.lng), true), 150);
        }
    } catch (error) {
        console.warn("Draft checkout tidak dapat dipulihkan:", error);
    }
}

function showAlert(message, type = "info") {
    const alertBox = document.getElementById("checkoutAlert");
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = `checkout-alert ${type}`;
    alertBox.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i><span>${escapeHTML(message)}</span>`;
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function blockCheckout(message) {
    showAlert(message, "error");
    const submit = document.getElementById("submitOrderBtn");
    if (submit) {
        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-ban"></i> Pesanan Tidak Dapat Diproses';
    }
    const box = document.getElementById("productSummary");
    if (box) box.innerHTML = '<div class="summary-error">Silakan kembali ke katalog dan pilih produk kembali.</div>';
}
