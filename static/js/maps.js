let map;
let markers = [];
let directionsService;
let directionsRenderer;

function initMap() {
    try {
        // Check if google maps API is loaded properly
        if (!google || !google.maps) {
            throw new Error('Google Maps API not loaded');
        }

        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 40.7128, lng: -74.0060 },
            zoom: 13
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
    } catch (error) {
        console.error('Error initializing map:', error);
        const mapDiv = document.getElementById('map');
        mapDiv.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">Map Loading Error</h4>
                <p>We're unable to load Google Maps at the moment. This might be because:</p>
                <ul>
                    <li>The Google Maps API key is invalid or missing</li>
                    <li>Required Google Maps APIs are not enabled</li>
                    <li>There's a network connectivity issue</li>
                </ul>
                <p>Please try refreshing the page. If the problem persists, contact support.</p>
            </div>
        `;
    }
}

function addMarker(location, label) {
    if (!map) return;
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
    if (directionsRenderer) {
        directionsRenderer.setDirections({routes: []});
    }
}

function displayRoute(addresses) {
    if (!directionsService || !directionsRenderer || addresses.length < 2) return;

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
        } else {
            console.error('Directions request failed:', status);
            alert('Failed to calculate route. Please check the addresses and try again.');
        }
    });
}
