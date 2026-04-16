window.initReviews = function(){

const placeId = "ChIJc5ryGwD3aS4Rq9ega0ifNZo";

const map = new google.maps.Map(document.createElement("div"));

const service = new google.maps.places.PlacesService(map);

service.getDetails({
placeId: placeId,
fields: ["name","rating","user_ratings_total","reviews","url"]
}, function(place,status){

if(status === google.maps.places.PlacesServiceStatus.OK){

// HERO BADGE
const hero = document.getElementById("hero-rating");

if(hero){
hero.innerHTML = `
<span>⭐ ${place.rating}</span> Google Rating
`;
}

// SUMMARY
const summary = document.getElementById("review-summary");

if(summary){
summary.innerHTML = `
⭐ ${place.rating} / 5 dari ${place.user_ratings_total} ulasan Google
`;
}

// REVIEWS
const container = document.getElementById("reviews-container");

place.reviews.slice(0,6).forEach(review => {

const card = document.createElement("div");

card.className = "review-card";

card.innerHTML = `
const stars = "⭐".repeat(review.rating);

<div class="review-text">
"${review.text.substring(0,100)}..."
</div>

<div class="review-author">
<img src="${review.profile_photo_url}">
${review.author_name}
</div>
`;

container.appendChild(card);

});

startAutoSlide();

}

});

}

// ================= AUTO SLIDER =================

function startAutoSlide(){

const slider = document.querySelector(".reviews-slider");

if(!slider) return;

// duplicate card supaya infinite
slider.innerHTML += slider.innerHTML;

let position = 0;
let speed = 0.3;
let isPaused = false;

function animate(){

if(!isPaused){

position -= speed;

if(Math.abs(position) >= slider.scrollWidth / 2){
position = 0;
}

slider.style.transform = `translateX(${position}px)`;

}

requestAnimationFrame(animate);

}

animate();


// pause saat hover
slider.addEventListener("mouseenter",()=>{
isPaused = true;
});


// lanjut saat keluar
slider.addEventListener("mouseleave",()=>{
isPaused = false;
});


// pause saat klik
slider.addEventListener("click",()=>{
isPaused = true;
});

}
