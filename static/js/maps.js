let maps = new Map(); // Store map instances
let markersMap = new Map(); // Store markers for each map
let directionsServiceMap = new Map();
let directionsRendererMap = new Map();

function initMap() {
    try {
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
        showMapError(mapDiv);
    }
}

function initMultipleMaps(mapElements) {
    try {
        if (!google || !google.maps) {
            throw new Error('Google Maps API not loaded');
        }

        mapElements.forEach(element => {
            const mapId = element.id;
            const addresses = JSON.parse(element.dataset.addresses);

            const map = new google.maps.Map(element, {
                center: { lat: 40.7128, lng: -74.0060 },
                zoom: 13,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });

            maps.set(mapId, map);
            markersMap.set(mapId, []);
            directionsServiceMap.set(mapId, new google.maps.DirectionsService());
            directionsRendererMap.set(mapId, new google.maps.DirectionsRenderer({
                map: map,
                suppressMarkers: true
            }));

            if (addresses && addresses.length > 0) {
                displayRoute(addresses, null, null, mapId);
            }
        });
    } catch (error) {
        console.error('Error initializing multiple maps:', error);
        mapElements.forEach(element => {
            showMapError(element);
        });
    }
}

function showMapError(mapDiv) {
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

function addMarker(location, label, mapId) {
    const currentMap = mapId ? maps.get(mapId) : map;
    const currentMarkers = mapId ? markersMap.get(mapId) : markers;
    
    if (!currentMap) return;
    
    const marker = new google.maps.Marker({
        position: location,
        map: currentMap,
        label: label.toString()
    });
    
    currentMarkers.push(marker);
}

function clearMarkers(mapId) {
    const currentMarkers = mapId ? markersMap.get(mapId) : markers;
    const currentDirectionsRenderer = mapId ? directionsRendererMap.get(mapId) : directionsRenderer;
    
    if (currentMarkers) {
        currentMarkers.forEach(marker => marker.setMap(null));
        currentMarkers.length = 0;
    }
    
    if (currentDirectionsRenderer) {
        currentDirectionsRenderer.setDirections({routes: []});
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
    if (!routeInfo) return;
    
    const totalDistanceElement = document.getElementById('totalDistance');
    const totalDurationElement = document.getElementById('totalDuration');
    
    totalDistanceElement.textContent = `Total Distance: ${formatDistance(totalDistance)}`;
    totalDurationElement.textContent = `Estimated Time: ${formatDuration(totalDuration)}`;
    routeInfo.style.display = 'block';
}

function displayRoute(addresses, totalDistance = null, totalDuration = null, mapId = null) {
    const currentMap = mapId ? maps.get(mapId) : map;
    const currentDirectionsService = mapId ? directionsServiceMap.get(mapId) : directionsService;
    const currentDirectionsRenderer = mapId ? directionsRendererMap.get(mapId) : directionsRenderer;

    if (!currentDirectionsService || !currentDirectionsRenderer || addresses.length < 2) return;

    clearMarkers(mapId);

    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(1, -1).map(address => ({
        location: address,
        stopover: true
    }));

    currentDirectionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
    }, (response, status) => {
        if (status === 'OK') {
            currentDirectionsRenderer.setDirections(response);
            const route = response.routes[0];
            
            route.legs.forEach((leg, i) => {
                if (i === 0) {
                    addMarker(leg.start_location, i + 1, mapId);
                }
                addMarker(leg.end_location, i + 2, mapId);
            });

            if (totalDistance !== null && totalDuration !== null) {
                updateRouteInfo(totalDistance, totalDuration);
            }

            // Fit bounds to show all markers
            const bounds = new google.maps.LatLngBounds();
            route.legs.forEach(leg => {
                bounds.extend(leg.start_location);
                bounds.extend(leg.end_location);
            });
            currentMap.fitBounds(bounds);
        } else {
            console.error('Directions request failed:', status);
            if (!mapId) {
                alert('Failed to calculate route. Please check the addresses and try again.');
            }
        }
    });
}
