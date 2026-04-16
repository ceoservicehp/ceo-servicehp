function initReviews(){
  const placeId = "ChIJs3Rm5rj3aS4RM2KQVElH7Ww";
  const map = new google.maps.Map(document.createElement("div"));
  const service = new google.maps.places.PlacesService(map);

service.getDetails({
    placeId: placeId,
    fields: ["reviews","rating","user_ratings_total"]
}, function(place,status){
  
  if(status === google.maps.places.PlacesServiceStatus.OK){
    const container = document.getElementById("reviews-container");
    place.reviews.slice(0,5).forEach(review => {
      
      const card = document.createElement("div");
      card.className = "review-card";
      
      card.innerHTML = `
      <div class="review-rating">⭐ ${review.rating}</div>
      <p>"${review.text}"</p>
      <div class="review-author">— ${review.author_name}</div>
      `;
      
      
      container.appendChild(card);

});

}

});

}

window.onload = initReviews;
