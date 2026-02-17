"use strict";

const db = window.supabaseClient;

function rupiah(n){
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

document.addEventListener("DOMContentLoaded", ()=>{

    loadProducts();

    document.getElementById("saveProduct")
        .addEventListener("click", saveProduct);

});

/* ================= LOAD DATA ================= */
async function loadProducts(){

    const tbody = document.getElementById("productTable");

    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at",{ascending:false});

    if(error){
        tbody.innerHTML=`<tr><td colspan="4">Error load data</td></tr>`;
        return;
    }

    if(!data || data.length===0){
        tbody.innerHTML=`<tr><td colspan="4">Belum ada produk</td></tr>`;
        return;
    }

    tbody.innerHTML="";

    data.forEach((row,i)=>{

        tbody.innerHTML+=`
        <tr>
            <td>${i+1}</td>
            <td>${row.name}</td>
            <td>${rupiah(row.price)}</td>
            <td>
                <button onclick="editProduct(${row.id})">Edit</button>
                <button onclick="deleteProduct(${row.id})">Hapus</button>
            </td>
        </tr>
        `;
    });

}

/* ================= SAVE ================= */
async function saveProduct(){

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value;
    const price = parseInt(document.getElementById("productPrice").value);
    const desc = document.getElementById("productDesc").value;
    const file = document.getElementById("productImage").files[0];

    if(!name || !price){
        alert("Nama dan harga wajib diisi");
        return;
    }

    let imageUrl = null;

    /* ===== Upload gambar jika ada ===== */
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

    /* ===== INSERT ===== */
    if(!id){

        const { error } = await db
            .from("products")
            .insert({
                name,
                price,
                description: desc,
                image_url: imageUrl
            });

        if(error){
            alert("Gagal tambah produk");
            return;
        }

    }else{

        const { error } = await db
            .from("products")
            .update({
                name,
                price,
                description: desc,
                image_url: imageUrl
            })
            .eq("id",id);

        if(error){
            alert("Gagal update produk");
            return;
        }

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
    document.getElementById("productPrice").value = data.price;
    document.getElementById("productDesc").value = data.description;
}

/* ================= DELETE ================= */
async function deleteProduct(id){

    if(!confirm("Hapus produk ini?")) return;

    await db
        .from("products")
        .delete()
        .eq("id",id);

    loadProducts();
}

/* ================= RESET ================= */
function resetForm(){

    document.getElementById("productId").value="";
    document.getElementById("productName").value="";
    document.getElementById("productPrice").value="";
    document.getElementById("productDesc").value="";
    document.getElementById("productImage").value="";
}
