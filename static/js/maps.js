let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;

function initMap() {
    try {
        if (!google || !google.maps) {
            throw new Error('Google Maps API not loaded');
        }

        const mapOptions = {
            center: { lat: 40.7128, lng: -74.0060 },
            zoom: 13,
            mapId: 'DEMO_MAP_ID' // This enables Advanced Markers
        };

        map = new google.maps.Map(document.getElementById('map'), mapOptions);
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError();
    }
}

function showMapError() {
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

async function addMarker(location, label) {
    if (!map) return;
    
    try {
        // Create a marker
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: location,
            title: `Stop ${label}`,
            content: new google.maps.marker.PinElement({
                glyph: label.toString(),
                glyphColor: "#ffffff",
                background: "#1a73e8"
            }).element
        });
        markers.push(marker);
    } catch (error) {
        console.error('Error creating marker:', error);
    }
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker && marker.setMap) {
            marker.setMap(null);
        }
    });
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

    // First, geocode all addresses and create markers
    for (let i = 0; i < addresses.length; i++) {
        const geocoder = new google.maps.Geocoder();
        try {
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: addresses[i] }, (results, status) => {
                    if (status === 'OK') resolve(results[0].geometry.location);
                    else reject(new Error(`Geocoding failed: ${status}`));
                });
            });
            await addMarker(result, i + 1);
        } catch (error) {
            console.error(`Error creating marker for address ${i + 1}:`, error);
            continue;
        }
    }

    // Then calculate and display the route
    try {
        const origin = addresses[0];
        const destination = addresses[addresses.length - 1];
        const waypoints = addresses.slice(1, -1).map(address => ({
            location: address,
            stopover: true
        }));

        const response = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: origin,
                destination: destination,
                waypoints: waypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === 'OK') resolve(result);
                else reject(new Error(`Directions request failed: ${status}`));
            });
        });

        directionsRenderer.setDirections(response);

        // Update route information if provided
        if (totalDistance !== null && totalDuration !== null) {
            updateRouteInfo(totalDistance, totalDuration);
        }
    } catch (error) {
        console.error('Error displaying route:', error);
        alert('Failed to calculate route. Please check the addresses and try again.');
    }
}
