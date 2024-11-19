let currentRouteId = null;
let isOptimizing = false;

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
    if (e.target.classList.contains('remove-address')) {
        e.target.closest('.mb-3').remove();
    }
});

document.getElementById('addressForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isOptimizing) return;
    
    const optimizeButton = document.getElementById('optimizeButton');
    const spinner = optimizeButton.querySelector('.spinner-border');
    const addresses = Array.from(document.getElementsByClassName('address-input'))
        .map(input => input.value)
        .filter(address => address.trim() !== '');

    if (addresses.length < 2) {
        alert('Please enter at least 2 addresses');
        return;
    }

    const routeName = document.getElementById('routeName').value.trim() || `Route ${new Date().toLocaleString()}`;
    const routeDescription = document.getElementById('routeDescription').value.trim();

    try {
        isOptimizing = true;
        optimizeButton.disabled = true;
        spinner.classList.remove('d-none');

        const response = await fetch('/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                addresses,
                name: routeName,
                description: routeDescription
            })
        });

        const data = await response.json();
        if (data.success) {
            currentRouteId = data.route_id;
            displayRoute(data.addresses, data.total_distance, data.total_duration);
            updateOptimizedRouteList(data.addresses);
            document.getElementById('exportRoute').style.display = 'block';
            document.getElementById('saveRouteForm').style.display = 'none';
            showSuccessAlert('Route optimized and saved successfully!');
        } else {
            showErrorAlert(data.error || 'Failed to optimize route');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorAlert('An error occurred while optimizing the route');
    } finally {
        isOptimizing = false;
        optimizeButton.disabled = false;
        spinner.classList.add('d-none');
    }
});

function updateOptimizedRouteList(addresses) {
    const routeList = document.getElementById('optimizedRoute');
    routeList.innerHTML = '';
    
    addresses.forEach((address, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = address;
        routeList.appendChild(li);
    });
}

document.getElementById('exportRoute').addEventListener('click', () => {
    if (currentRouteId) {
        window.location.href = `/export/${currentRouteId}`;
    }
});

// Helper functions for showing alerts
function showAlert(message, type) {
    const alertsContainer = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertsContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

function showSuccessAlert(message) {
    showAlert(message, 'success');
}

function showErrorAlert(message) {
    showAlert(message, 'danger');
}

// Load saved route if route_id is in URL
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const routeId = urlParams.get('route_id');
    
    if (routeId) {
        try {
            const response = await fetch(`/routes/${routeId}`);
            const data = await response.json();
            
            if (data.success) {
                const route = data.route;
                currentRouteId = route.id;
                
                // Fill in the form
                document.getElementById('routeName').value = route.name;
                document.getElementById('routeDescription').value = route.description || '';
                
                // Add address inputs
                const inputsContainer = document.getElementById('addressInputs');
                inputsContainer.innerHTML = '';
                route.addresses.forEach(address => {
                    const div = document.createElement('div');
                    div.className = 'mb-3';
                    div.innerHTML = `
                        <div class="input-group">
                            <input type="text" class="form-control address-input" value="${address}" placeholder="Enter address">
                            <button type="button" class="btn btn-danger remove-address">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                    inputsContainer.appendChild(div);
                });
                
                // Display the route on the map
                if (route.optimized_route) {
                    displayRoute(route.optimized_route, route.total_distance, route.total_duration);
                    updateOptimizedRouteList(route.optimized_route);
                    document.getElementById('exportRoute').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading saved route:', error);
            showErrorAlert('Failed to load saved route');
        }
    }
});
