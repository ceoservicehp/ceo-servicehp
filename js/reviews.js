function initReviews(){

const placeId = "ChIJs3Rm5rj3aS4RM2KQVElH7Ww";

const map = new google.maps.Map(document.createElement("div"));

const service = new google.maps.places.PlacesService(map);

service.getDetails({
  placeId: placeId,
  fields: ["name","rating","user_ratings_total","reviews","url"]
}, function(place,status){

if(status === google.maps.places.PlacesServiceStatus.OK){

// ===== RATING SUMMARY =====
const summary = document.getElementById("review-summary");

summary.innerHTML = `
<h3>⭐ ${place.rating} / 5</h3>
<p>${place.user_ratings_total} ulasan Google</p>
<a href="${place.url}" target="_blank">Lihat di Google Maps</a>
`;


// ===== REVIEWS =====
const container = document.getElementById("reviews-container");

place.reviews.slice(0,6).forEach(review => {

const card = document.createElement("div");
card.className = "review-card";

card.innerHTML = `
<div class="review-rating">⭐ ${review.rating}</div>
<p>"${review.text.substring(0,120)}..."</p>

<div class="review-author">
<img src="${review.profile_photo_url}" 
style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px;">
${review.author_name}
</div>
`;

container.appendChild(card);

});

}

});

}
