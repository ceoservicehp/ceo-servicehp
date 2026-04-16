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
<div class="review-rating">⭐ ${review.rating}</div>

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

let position = 0;

setInterval(()=>{

const cardWidth = slider.querySelector(".review-card")?.offsetWidth || 300;

position += cardWidth + 20;

slider.scrollTo({
left: position,
behavior: "smooth"
});

if(position >= slider.scrollWidth - slider.clientWidth){
position = 0;
}

},4000);

}
