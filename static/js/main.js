let currentRouteId = null;

document.getElementById('addAddress').addEventListener('click', () => {
    const inputsContainer = document.getElementById('addressInputs');
    const newInput = document.createElement('div');
    newInput.className = 'mb-3';
    newInput.innerHTML = `
        <div class="input-group">
            <input type="text" class="form-control address-input" placeholder="Enter address">
            <button type="button" class="btn btn-danger remove-address">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    inputsContainer.appendChild(newInput);
});

document.getElementById('addressInputs').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-address') || e.target.closest('.remove-address')) {
        e.target.closest('.mb-3').remove();
    }
});

document.getElementById('addressForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const routeName = document.getElementById('routeName').value.trim() || `Route ${new Date().toLocaleString()}`;
    const addresses = Array.from(document.getElementsByClassName('address-input'))
        .map(input => input.value)
        .filter(address => address.trim() !== '');

    if (addresses.length < 2) {
        alert('Please enter at least 2 addresses');
        return;
    }

    try {
        const response = await fetch('/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                addresses,
                name: routeName
            })
        });

        const data = await response.json();
        if (data.success) {
            currentRouteId = data.route_id;
            displayRoute(data.addresses, data.total_distance, data.total_duration);
            updateOptimizedRouteList(data.addresses);
            document.getElementById('exportRoute').style.display = 'block';
            loadSavedRoutes(); // Refresh the saved routes list
        } else {
            alert(data.error || 'Failed to optimize route');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while optimizing the route');
    }
});

function updateOptimizedRouteList(addresses) {
    const routeList = document.getElementById('optimizedRoute');
    routeList.innerHTML = '';
    
    addresses.forEach((address, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${index + 1}. ${address}`;
        routeList.appendChild(li);
    });
}

document.getElementById('exportRoute').addEventListener('click', () => {
    if (currentRouteId) {
        window.location.href = `/export/${currentRouteId}`;
    }
});

async function loadSavedRoutes() {
    try {
        const response = await fetch('/routes');
        const data = await response.json();
        
        if (data.success) {
            const savedRoutesList = document.getElementById('savedRoutes');
            savedRoutesList.innerHTML = '';
            
            data.routes.forEach(route => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">${route.name}</h6>
                            <small class="text-muted">${route.address_count} addresses • ${route.created_at}</small>
                        </div>
                        <button class="btn btn-outline-primary btn-sm load-route" data-route-id="${route.id}">
                            Load Route
                        </button>
                    </div>
                `;
                savedRoutesList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error loading saved routes:', error);
    }
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('load-route') || e.target.closest('.load-route')) {
        const button = e.target.classList.contains('load-route') ? e.target : e.target.closest('.load-route');
        const routeId = button.dataset.routeId;
        
        try {
            const response = await fetch(`/routes/${routeId}`);
            const data = await response.json();
            
            if (data.success) {
                const route = data.route;
                currentRouteId = route.id;
                
                // Update form with saved addresses
                const inputsContainer = document.getElementById('addressInputs');
                inputsContainer.innerHTML = '';
                
                route.addresses.forEach(address => {
                    const newInput = document.createElement('div');
                    newInput.className = 'mb-3';
                    newInput.innerHTML = `
                        <div class="input-group">
                            <input type="text" class="form-control address-input" value="${address}" placeholder="Enter address">
                            <button type="button" class="btn btn-danger remove-address">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                    inputsContainer.appendChild(newInput);
                });
                
                document.getElementById('routeName').value = route.name;
                
                // Display the route on the map
                if (route.optimized_route) {
                    displayRoute(route.optimized_route);
                    updateOptimizedRouteList(route.optimized_route);
                    document.getElementById('exportRoute').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading route:', error);
            alert('Failed to load the selected route');
        }
    }
});

// Load saved routes when the page loads
document.addEventListener('DOMContentLoaded', loadSavedRoutes);
