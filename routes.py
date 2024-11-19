from flask import render_template, jsonify, request
from app import app, db
from models import Route

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/optimize', methods=['POST'])
def optimize_route():
    data = request.get_json()
    addresses = data.get('addresses', [])
    
    # Store route in database
    route = Route(
        name=f"Route {datetime.utcnow()}",
        addresses=addresses,
        optimized_route=addresses  # Initially same as input order
    )
    db.session.add(route)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'route_id': route.id,
        'addresses': addresses
    })

@app.route('/export/<int:route_id>')
def export_route(route_id):
    route = Route.query.get_or_404(route_id)
    # Generate CSV of addresses
    addresses = '\n'.join(route.optimized_route)
    return addresses, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename=route_{route_id}.csv'
    }
