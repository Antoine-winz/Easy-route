let currentRouteId = null;
let isOptimizing = false;
let autocompleteInstances = [];

function initializeAutocomplete(input) {
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address']
    });
    autocomplete.addListener('place_changed', () => {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    });
    autocompleteInstances.push(autocomplete);
}

function updateProgress(step, total = 3) {
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = progressContainer.querySelector('.progress-bar');
    const indicators = progressContainer.querySelectorAll('.step-indicator');
    
    progressContainer.classList.remove('d-none');
    const progress = (step / total) * 100;
    progressBar.style.width = `${progress}%`;
    
    indicators.forEach((indicator, index) => {
        if (index + 1 < step) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
        } else if (index + 1 === step) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
        } else {
            indicator.classList.remove('active', 'completed');
        }
    });
}

function showLoadingOverlay(message = 'Processing...') {
    const overlay = document.querySelector('.loading-overlay');
    const messageElement = document.getElementById('loading-message');
    messageElement.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    overlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    // Update the first address input placeholder and tooltip
    const firstInput = document.querySelector('.address-input');
    if (firstInput) {
        firstInput.placeholder = 'Enter starting point address';
        firstInput.setAttribute('data-bs-toggle', 'tooltip');
        firstInput.setAttribute('data-bs-title', 'This will be your route starting point');
        initializeAutocomplete(firstInput);
    }
});

document.getElementById('addAddress').addEventListener('click', () => {
    const inputsContainer = document.getElementById('addressInputs');
    const newInput = document.createElement('div');
    newInput.className = 'mb-3';
    newInput.innerHTML = `
        <div class="input-group has-validation">
            <input type="text" class="form-control address-input" 
                   placeholder="Enter delivery address" required
                   data-bs-toggle="tooltip" 
                   title="Enter a delivery address">
            <button type="button" class="btn btn-danger remove-address">
                <i class="fas fa-times"></i>
            </button>
            <div class="invalid-feedback">Please enter a valid address.</div>
        </div>
    `;
    inputsContainer.appendChild(newInput);
    
    const newAddressInput = newInput.querySelector('.address-input');
    initializeAutocomplete(newAddressInput);
    
    // Initialize tooltip for new elements
    const tooltips = newInput.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(el => new bootstrap.Tooltip(el));
});

document.getElementById('addressInputs').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-address') || 
        e.target.closest('.remove-address')) {
        const inputGroup = e.target.closest('.mb-3');
        if (inputGroup) {
            const input = inputGroup.querySelector('.address-input');
            const autocomplete = autocompleteInstances.find(
                ac => ac.inputField === input
            );
            if (autocomplete) {
                google.maps.event.clearInstanceListeners(autocomplete);
                autocompleteInstances = autocompleteInstances.filter(
                    ac => ac !== autocomplete
                );
            }
            inputGroup.remove();
        }
    }
});

document.getElementById('clearForm').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all fields?')) {
        document.getElementById('routeName').value = '';
        document.getElementById('routeDescription').value = '';
        const addressInputs = document.getElementById('addressInputs');
        const firstInput = addressInputs.querySelector('.address-input');
        if (firstInput) firstInput.value = '';
        
        while (addressInputs.children.length > 1) {
            addressInputs.lastChild.remove();
        }
        
        document.getElementById('optimizedRoute').innerHTML = '';
        document.getElementById('routeInfo').style.display = 'none';
        document.getElementById('exportRoute').style.display = 'none';
        clearMarkers();
    }
});

document.getElementById('addressForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isOptimizing) return;
    
    const form = e.target;
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }
    
    const optimizeButton = document.getElementById('optimizeButton');
    const spinner = optimizeButton.querySelector('.spinner-border');
    const addresses = Array.from(document.getElementsByClassName('address-input'))
        .map(input => input.value)
        .filter(address => address.trim() !== '');

    if (addresses.length < 2) {
        showErrorAlert('Please enter at least 2 addresses');
        return;
    }

    const routeName = document.getElementById('routeName').value.trim() || 
                     `Route ${new Date().toLocaleString()}`;
    const routeDescription = document.getElementById('routeDescription').value.trim();

    try {
        isOptimizing = true;
        optimizeButton.disabled = true;
        spinner.classList.remove('d-none');
        showLoadingOverlay('Optimizing route...');
        updateProgress(1);

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
            updateProgress(2);
            currentRouteId = data.route_id;
            await displayRoute(data.addresses, data.total_distance, data.total_duration);
            updateProgress(3);
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
        hideLoadingOverlay();
    }
});

function updateOptimizedRouteList(addresses) {
    const routeList = document.getElementById('optimizedRoute');
    routeList.innerHTML = '';
    
    addresses.forEach((address, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${address}</span>
            <span class="badge bg-${index === 0 ? 'primary' : 
                                   index === addresses.length - 1 ? 'success' : 
                                   'secondary'} rounded-pill">
                ${index === 0 ? 'Start' : 
                  index === addresses.length - 1 ? 'End' : 
                  'Stop ' + index}
            </span>
        `;
        routeList.appendChild(li);
    });
}

document.getElementById('exportRoute').addEventListener('click', () => {
    if (currentRouteId) {
        window.location.href = `/export/${currentRouteId}`;
    }
});

function showAlert(message, type) {
    const alertsContainer = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertsContainer.appendChild(alert);
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
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
            showLoadingOverlay('Loading saved route...');
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
                        <div class="input-group has-validation">
                            <input type="text" class="form-control address-input" 
                                   value="${address}" required
                                   data-bs-toggle="tooltip" 
                                   title="Enter delivery address">
                            <button type="button" class="btn btn-danger remove-address">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="invalid-feedback">Please enter a valid address.</div>
                        </div>
                    `;
                    inputsContainer.appendChild(div);
                    initializeAutocomplete(div.querySelector('.address-input'));
                });
                
                // Display the route on the map
                if (route.optimized_route) {
                    await displayRoute(route.optimized_route, route.total_distance, route.total_duration);
                    updateOptimizedRouteList(route.optimized_route);
                    document.getElementById('exportRoute').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading saved route:', error);
            showErrorAlert('Failed to load saved route');
        } finally {
            hideLoadingOverlay();
        }
    }
});
