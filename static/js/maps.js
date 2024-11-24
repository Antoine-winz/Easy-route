let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;
let mapBounds;

function waitForGoogleMaps() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Google Maps failed to load'));
            }, 10000);
        }
    });
}

// Autocomplete functionality temporarily removed

function showMapError(message) {
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
        mapDiv.innerHTML = `
            <div class="alert alert-danger m-3">
                <h4>Map Loading Error</h4>
                <p>${message}</p>
                <p>Please check:</p>
                <ul>
                    <li>Internet connection</li>
                    <li>Google Maps API key configuration</li>
                </ul>
            </div>
        `;
    }
}

async function addMarker(location, label, isStart = false, isEnd = false, isLoopEnd = false) {
    if (!map) return;
    
    try {
        let pinColor;
        let scale;
        let title;
        
        if (isStart) {
            pinColor = "#28a745"; // Green for start
            scale = 1.2;
            title = "Start";
        } else if (isLoopEnd) {
            pinColor = "#28a745"; // Green for loop end (same as start)
            scale = 1.2;
            title = "Return to Start";
        } else if (isEnd) {
            pinColor = "#dc3545"; // Red for end
            scale = 1.2;
            title = "End";
        } else {
            pinColor = "#1a73e8"; // Blue for waypoints
            scale = 1;
            title = `Stop ${label}`;
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: location,
            title: title,
            content: new google.maps.marker.PinElement({
                glyph: label.toString(),
                background: pinColor,
                borderColor: '#FFFFFF'
            })
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
    
    const isLoopRoute = addresses.length >= 2 && 
                       addresses[0] === addresses[addresses.length - 1];

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
            
            const isStart = i === 0;
            const isEnd = i === addresses.length - 1;
            const isLoopEnd = isLoopRoute && isEnd;
            
            await addMarker(
                result,
                isLoopEnd ? 1 : i + 1, // For loop routes, use 1 for the end marker
                isStart,
                isEnd,
                isLoopEnd
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

async function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    try {
        // Wait for Google Maps to be fully loaded
        await waitForGoogleMaps();
        
        // Initialize map
        map = new google.maps.Map(mapContainer, {
            center: { lat: 46.8182, lng: 8.2275 }, // Switzerland center
            zoom: 8,
            restriction: {
                latLngBounds: {
                    north: 47.8084,
                    south: 45.8183,
                    west: 5.9562,
                    east: 10.4922
                }
            }
        });
        
        // Initialize services
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
        
        // Dispatch custom event when map is ready
        const mapReadyEvent = new CustomEvent('mapReady');
        document.dispatchEvent(mapReadyEvent);
        
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError('Failed to initialize Google Maps. Please check your connection and try again.');
    }
}
