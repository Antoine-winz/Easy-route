let map;
let markers = [];
let directionsService;
let directionsRenderer;
let isProcessing = false;
let mapBounds;

async function initializeGoogleMaps() {
    try {
        await new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Google Maps failed to load'));
            }, 10000);
        });
        
        return true;
    } catch (error) {
        console.error('Error loading Google Maps:', error);
        return false;
    }
}

function initializeAutocomplete(input) {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.error('Google Maps Places library not loaded');
        showMapError('Places API not loaded. Please refresh the page.');
        return null;
    }
    
    try {
        const switzerlandBounds = {
            north: 47.8084,
            south: 45.8179,
            west: 5.9559,
            east: 10.4921
        };
        
        const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['address', 'establishment'],
            fields: ['formatted_address', 'name', 'place_id', 'geometry'],
            bounds: switzerlandBounds,
            strictBounds: false,
            componentRestrictions: { country: 'ch' }
        });
        
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            handlePlaceSelection(place, input);
        });
        
        return autocomplete;
    } catch (error) {
        console.error('Error initializing autocomplete:', error);
        showMapError('Failed to initialize address autocomplete');
        return null;
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
    if (!map || !location) return null;
    
    try {
        let pinColor;
        let scale;
        let title;
        
        if (isStart) {
            pinColor = "#28a745";
            scale = 1.2;
            title = "Start";
        } else if (isLoopEnd) {
            pinColor = "#28a745";
            scale = 1.2;
            title = "Return to Start";
        } else if (isEnd) {
            pinColor = "#dc3545";
            scale = 1.2;
            title = "End";
        } else {
            pinColor = "#1a73e8";
            scale = 1;
            title = `Stop ${label}`;
        }

        const position = location instanceof google.maps.LatLng ? location : new google.maps.LatLng(location);
        
        const markerContent = document.createElement('div');
        markerContent.className = 'custom-marker';
        markerContent.innerHTML = `
            <div style="
                background-color: ${pinColor};
                border: 2px solid #FFFFFF;
                border-radius: 50%;
                width: ${30 * (scale || 1)}px;
                height: ${30 * (scale || 1)}px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-weight: bold;
                font-size: 14px;">
                ${label}
            </div>
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: position,
            map: map,
            title: title,
            content: markerContent
        });

        markers.push(marker);

        if (!mapBounds) {
            mapBounds = new google.maps.LatLngBounds();
        }
        mapBounds.extend(position);
        
        return marker;
    } catch (error) {
        console.error('Error creating marker:', error);
        return null;
    }
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker) {
            marker.map = null;
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
    
    const isLoopRoute = addresses.length >= 2 && 
                       addresses[0] === addresses[addresses.length - 1];

    // Geocode addresses and create markers
    const geocoder = new google.maps.Geocoder();
    for (let i = 0; i < addresses.length; i++) {
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
            
            const marker = await addMarker(
                result,
                isLoopEnd ? 1 : i + 1,
                isStart,
                isEnd,
                isLoopEnd
            );

            if (!marker) {
                console.error(`Failed to create marker for address ${i + 1}`);
            }
        } catch (error) {
            console.error(`Error processing address ${i + 1}:`, error);
            showMapError(`Failed to process address: ${addresses[i]}`);
            continue;
        }
    }

    // Calculate and display route
    try {
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
        
        if (mapBounds && mapBounds.isEmpty()) {
            response.routes[0].bounds.forEach(coord => mapBounds.extend(coord));
        }
        
        map.fitBounds(mapBounds);

        if (totalDistance !== null && totalDuration !== null) {
            updateRouteInfo(totalDistance, totalDuration);
        }
    } catch (error) {
        console.error('Error displaying route:', error);
        showMapError('Failed to calculate route. Please check the addresses and try again.');
    }
}

function handlePlaceSelection(place, input) {
    if (!place.geometry) {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        return;
    }
    
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    
    if (place.name && place.formatted_address && 
        !place.formatted_address.startsWith(place.name)) {
        input.value = `${place.name}, ${place.formatted_address}`;
    } else {
        input.value = place.formatted_address;
    }
}

async function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    try {
        // Initialize map centered on Switzerland
        map = new google.maps.Map(mapContainer, {
            center: { lat: 46.8182, lng: 8.2275 }, // Switzerland center
            zoom: 8,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_TOP
            },
            fullscreenControl: true
        });
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true
        });
        
        // Initialize Places Autocomplete
        if (google.maps.places) {
            document.querySelectorAll('.address-input').forEach(input => {
                initializeAutocomplete(input);
            });
        }
        
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError('Failed to initialize Google Maps');
    }
}

// Export functions for use in other modules
window.initMap = initMap;
window.initializeAutocomplete = initializeAutocomplete;
window.displayRoute = displayRoute;
window.clearMarkers = clearMarkers;
