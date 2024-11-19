let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;

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

async function addMarker(location, label) {
    if (!map) return;
    
    const pinElement = new google.maps.marker.PinElement({
        glyph: label.toString(),
        glyphColor: '#ffffff',
        background: '#1a73e8'
    });

    const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: location,
        title: `Stop ${label}`,
        content: pinElement.element  // Changed from pinElement to pinElement.element
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

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
}

function updateRouteInfo(totalDistance, totalDuration) {
    const routeInfo = document.getElementById('routeInfo');
    const totalDistanceElement = document.getElementById('totalDistance');
    const totalDurationElement = document.getElementById('totalDuration');
    
    totalDistanceElement.textContent = `Total Distance: ${formatDistance(totalDistance)}`;
    totalDurationElement.textContent = `Estimated Time: ${formatDuration(totalDuration)}`;
    routeInfo.style.display = 'block';
}

async function displayRoute(addresses, totalDistance = null, totalDuration = null) {
    if (!directionsService || !directionsRenderer || addresses.length < 2) return;

    clearMarkers();

    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(1, -1).map(address => ({
        location: address,
        stopover: true
    }));

    try {
        const response = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: origin,
                destination: destination,
                waypoints: waypoints,
                optimizeWaypoints: false, // We're using our own optimization
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === 'OK') resolve(result);
                else reject(new Error(`Directions request failed: ${status}`));
            });
        });

        directionsRenderer.setDirections(response);
        const route = response.routes[0];
        
        // Add markers for each stop
        for (let i = 0; i < route.legs.length; i++) {
            const leg = route.legs[i];
            if (i === 0) {
                await addMarker(leg.start_location, i + 1);
            }
            await addMarker(leg.end_location, i + 2);
        }

        // Update route information if provided
        if (totalDistance !== null && totalDuration !== null) {
            updateRouteInfo(totalDistance, totalDuration);
        }
    } catch (error) {
        console.error('Error displaying route:', error);
        alert('Failed to calculate route. Please check the addresses and try again.');
    }
}
