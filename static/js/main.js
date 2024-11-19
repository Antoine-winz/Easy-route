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

    try {
        isOptimizing = true;
        optimizeButton.disabled = true;
        spinner.classList.remove('d-none');

        const response = await fetch('/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addresses })
        });

        const data = await response.json();
        if (data.success) {
            currentRouteId = data.route_id;
            displayRoute(data.addresses, data.total_distance, data.total_duration);
            updateOptimizedRouteList(data.addresses);
            document.getElementById('exportRoute').style.display = 'block';
        } else {
            alert(data.error || 'Failed to optimize route');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while optimizing the route');
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
