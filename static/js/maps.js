let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;
let mapBounds;

async function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    try {
        map = new google.maps.Map(mapContainer, {
            center: { lat: 46.8182, lng: 8.2275 },
            zoom: 8
        });
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });

        // Initialize Places Autocomplete after map is ready
        const inputs = document.querySelectorAll('.address-input');
        inputs.forEach(input => {
            const autocomplete = initializeAutocomplete(input);
            if (autocomplete) {
                console.log('Autocomplete initialized for input:', input);
            }
        });
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError('Failed to initialize Google Maps');
    }
}

function showMapError(message) {
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
        mapDiv.innerHTML = `
            <div class="alert alert-danger m-3">
                <h4>Map Error</h4>
                <p>${message}</p>
                <p>Please try:</p>
                <ul>
                    <li>Refreshing the page</li>
                    <li>Checking your internet connection</li>
                    <li>Verifying the API key configuration</li>
                </ul>
            </div>
        `;
    }
}

async function addMarker(location, label, isStart = false, isEnd = false, isLoopEnd = false) {
    if (!map || !location) {
        console.error('Map not initialized');
        return null;
    }
    
    try {
        let pinColor;
        let title;
        
        if (isStart) {
            pinColor = "#28a745";
            title = "Start";
        } else if (isLoopEnd) {
            pinColor = "#28a745";
            title = "Return to Start";
        } else if (isEnd) {
            pinColor = "#dc3545";
            title = "End";
        } else {
            pinColor = "#1a73e8";
            title = `Stop ${label}`;
        }

        const marker = new google.maps.Marker({
            position: location,
            map: map,
            label: label.toString(),
            title: title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: pinColor,
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
                scale: 12
            }
        });

        markers.push(marker);
        
        if (!mapBounds) {
            mapBounds = new google.maps.LatLngBounds();
        }
        mapBounds.extend(location);
        
        return marker;
    } catch (error) {
        console.error('Error creating marker:', error);
        return null;
    }
}

function buildMarkerContent(label, color, scale = 1) {
    const div = document.createElement('div');
    div.style.width = `${30 * scale}px`;
    div.style.height = `${30 * scale}px`;
    div.style.borderRadius = '50%';
    div.style.backgroundColor = color;
    div.style.border = '2px solid white';
    div.style.display = 'flex';
    div.style.justifyContent = 'center';
    div.style.alignItems = 'center';
    div.style.color = 'white';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '14px';
    div.textContent = label;
    return div;
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker && marker.map) {
            marker.map = null;
        }
    });
    markers = [];
    
    if (directionsRenderer) {
        directionsRenderer.setDirections({routes: []});
    }
    
    mapBounds = null;
}

function formatDistance(meters) {
    return meters < 1000 ? 
        `${Math.round(meters)} m` : 
        `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? 
        `${hours} hr ${minutes} min` : 
        `${minutes} min`;
}

function updateRouteInfo(totalDistance, totalDuration) {
    const routeInfo = document.getElementById('routeInfo');
    const totalDistanceElement = document.getElementById('totalDistance');
    const totalDurationElement = document.getElementById('totalDuration');
    
    if (routeInfo && totalDistanceElement && totalDurationElement) {
        totalDistanceElement.innerHTML = `<i class="fas fa-road"></i> Total Distance: ${formatDistance(totalDistance)}`;
        totalDurationElement.innerHTML = `<i class="fas fa-clock"></i> Estimated Time: ${formatDuration(totalDuration)}`;
        routeInfo.style.display = 'block';
    }
}

async function displayRoute(addresses, totalDistance = null, totalDuration = null) {
    if (!directionsService || !directionsRenderer || !addresses || addresses.length < 2) {
        console.error('Invalid route parameters');
        return;
    }

    clearMarkers();
    mapBounds = new google.maps.LatLngBounds();
    
    const isLoopRoute = addresses.length >= 2 && 
                       addresses[0] === addresses[addresses.length - 1];

    try {
        // Geocode addresses and create markers
        const geocoder = new google.maps.Geocoder();
        const locations = await Promise.all(addresses.map(address => {
            return new Promise((resolve, reject) => {
                geocoder.geocode({ address }, (results, status) => {
                    if (status === 'OK') {
                        resolve(results[0].geometry.location);
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });
        }));

        // Add markers
        for (let i = 0; i < locations.length; i++) {
            const isStart = i === 0;
            const isEnd = i === addresses.length - 1;
            const isLoopEnd = isLoopRoute && isEnd;
            const marker = await addMarker(
                locations[i],
                isLoopEnd ? 1 : i + 1,
                isStart,
                isEnd,
                isLoopEnd
            );
            if (!marker) {
                console.error(`Failed to create marker for address ${i + 1}`);
            }
        }

        // Calculate and display route
        const response = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: addresses[0],
                destination: addresses[addresses.length - 1],
                waypoints: addresses.slice(1, -1).map(address => ({
                    location: address,
                    stopover: true
                })),
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === 'OK') resolve(result);
                else reject(new Error(`Directions request failed: ${status}`));
            });
        });

        directionsRenderer.setDirections(response);
        
        // Ensure mapBounds includes all route points
        const bounds = response.routes[0].bounds;
        map.fitBounds(bounds);

        if (totalDistance !== null && totalDuration !== null) {
            updateRouteInfo(totalDistance, totalDuration);
        }
    } catch (error) {
        console.error('Error displaying route:', error);
        showMapError('Failed to calculate route. Please check the addresses and try again.');
    }
}

// Export necessary functions
window.displayRoute = displayRoute;
window.clearMarkers = clearMarkers;
window.showMapError = showMapError;
window.initMap = initMap;
