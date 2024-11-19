let currentRouteId = null;
let currentOptimizedAddresses = null;

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
            body: JSON.stringify({ addresses })
        });

        const data = await response.json();
        if (data.success) {
            currentOptimizedAddresses = data.addresses;
            displayRoute(data.addresses, data.total_distance, data.total_duration);
            updateOptimizedRouteList(data.addresses);
            document.getElementById('routeActions').style.display = 'block';
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
        li.textContent = address;
        routeList.appendChild(li);
    });
}

document.getElementById('saveRoute').addEventListener('click', async () => {
    if (!currentOptimizedAddresses) {
        alert('Please optimize a route first');
        return;
    }

    const routeName = prompt('Enter a name for this route:', `Route ${new Date().toLocaleDateString()}`);
    if (!routeName) return;

    try {
        const response = await fetch('/save-route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: routeName,
                addresses: currentOptimizedAddresses,
                optimized_route: currentOptimizedAddresses
            })
        });

        const data = await response.json();
        if (data.success) {
            currentRouteId = data.route_id;
            alert('Route saved successfully!');
            document.getElementById('viewRoute').style.display = 'inline-block';
        } else {
            alert(data.error || 'Failed to save route');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while saving the route');
    }
});

document.getElementById('exportRoute').addEventListener('click', () => {
    if (currentRouteId) {
        window.location.href = `/export/${currentRouteId}`;
    }
});

document.getElementById('viewRoute').addEventListener('click', () => {
    if (currentRouteId) {
        window.location.href = `/routes/${currentRouteId}`;
    }
});
