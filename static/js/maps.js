let map;
let markers = [];
let directionsService;
let directionsRenderer;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 13
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true
    });
}

function addMarker(location, label) {
    const marker = new google.maps.Marker({
        position: location,
        map: map,
        label: label.toString()
    });
    markers.push(marker);
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    directionsRenderer.setDirections({routes: []});
}

function displayRoute(addresses) {
    if (addresses.length < 2) return;

    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(1, -1).map(address => ({
        location: address,
        stopover: true
    }));

    directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    }, (response, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(response);
            const route = response.routes[0];
            
            // Add markers for each stop
            route.legs.forEach((leg, i) => {
                if (i === 0) {
                    addMarker(leg.start_location, i + 1);
                }
                addMarker(leg.end_location, i + 2);
            });
        }
    });
}

// Initialize map when the page loads
window.addEventListener('load', initMap);
