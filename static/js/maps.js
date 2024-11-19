let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;
let mapBounds;

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    try {
        const mapOptions = {
            center: { lat: 46.8182, lng: 8.2275 }, // Switzerland center
            zoom: 8,
            mapId: 'DEMO_MAP_ID'
        };
        
        map = new google.maps.Map(mapContainer, mapOptions);
        
        // Initialize services after map is created
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
        
        // Add a visual check for map loading
        mapContainer.style.border = '1px solid #ccc';
        
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

async function addMarker(location, label, isStart = false, isEnd = false) {
    if (!map) return;
    
    try {
        let pinColor;
        let scale;
        
        if (isStart) {
            pinColor = "#28a745"; // Green for start
            scale = 1.2;
        } else if (isEnd) {
            pinColor = "#dc3545"; // Red for end
            scale = 1.2;
        } else {
            pinColor = "#1a73e8"; // Blue for waypoints
            scale = 1;
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: location,
            title: isStart ? "Start" : (isEnd ? "End" : `Stop ${label}`),
            content: new google.maps.marker.PinElement({
                glyph: label.toString(),
                glyphColor: "#ffffff",
                background: pinColor,
                scale: scale,
                borderColor: "#ffffff"
            }).element
        });

        // Add tooltip
        const tooltip = new bootstrap.Tooltip(marker.element, {
            title: marker.title,
            placement: 'top'
        });

        markers.push(marker);
        if (!mapBounds) {
            mapBounds = new google.maps.LatLngBounds();
        }
        mapBounds.extend(location);
        map.fitBounds(mapBounds);
    } catch (error) {
        console.error('Error creating marker:', error);
    }
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker) {
            if (marker.setMap) marker.setMap(null);
            // Cleanup any tooltips
            const tooltip = bootstrap.Tooltip.getInstance(marker.element);
            if (tooltip) tooltip.dispose();
        }
    });
    markers = [];
    if (directionsRenderer) {
        directionsRenderer.setDirections({routes: []});
    }
    if (mapBounds) {
        mapBounds = new google.maps.LatLngBounds();
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
    
    totalDistanceElement.innerHTML = `<i class="fas fa-road"></i> Total Distance: ${formatDistance(totalDistance)}`;
    totalDurationElement.innerHTML = `<i class="fas fa-clock"></i> Estimated Time: ${formatDuration(totalDuration)}`;
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
            await addMarker(
                result, 
                i + 1, 
                i === 0, // isStart
                i === addresses.length - 1 // isEnd
            );
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
        if (mapBounds) {
            map.fitBounds(mapBounds);
        }

        // Update route information if provided
        if (totalDistance !== null && totalDuration !== null) {
            updateRouteInfo(totalDistance, totalDuration);
        }
    } catch (error) {
        console.error('Error displaying route:', error);
        showErrorAlert('Failed to calculate route. Please check the addresses and try again.');
    }
}
