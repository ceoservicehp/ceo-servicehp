window.CEO_ADMIN_NAV = [
  {
    label:"Service", icon:"fa-screwdriver-wrench",
    pages:["dapur.html","keuangan.html"],
    items:[
      {href:"dapur.html", label:"Order Service", icon:"fa-kitchen-set"},
      {href:"keuangan.html", label:"Keuangan Service", icon:"fa-wallet"}
    ]
  },
  {
    label:"Produk HP", icon:"fa-mobile-screen-button",
    pages:["produk.html","order-produk.html","keuangan-produk.html","histori-imei.html","garansi-produk.html"],
    items:[
      {href:"produk.html", label:"Kelola Produk", icon:"fa-box-open"},
      {href:"order-produk.html", label:"Order Produk", icon:"fa-cart-shopping"},
      {href:"keuangan-produk.html", label:"Keuangan Produk", icon:"fa-chart-line"},
      {href:"histori-imei.html", label:"Histori IMEI", icon:"fa-barcode"},
      {href:"garansi-produk.html", label:"Garansi Produk", icon:"fa-shield-halved"}
    ]
  },
  {
    label:"Administrasi", icon:"fa-users-gear",
    pages:["admin-users.html","profile.html"],
    items:[
      {href:"profile.html", label:"Profil", icon:"fa-user"},
      {href:"admin-users.html", label:"Kelola Admin", icon:"fa-user-gear"}
    ]
  },
  {
    label:"Website", icon:"fa-globe",
    pages:["kelola-website.html"],
    items:[
      {href:"kelola-website.html", label:"Kelola Website", icon:"fa-pen-ruler"},
      {href:"index.html", label:"Lihat Website", icon:"fa-arrow-up-right-from-square", external:true}
    ]
  }
];