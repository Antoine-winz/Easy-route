from flask import render_template, jsonify, request
from app import app, db
from models import Route
from datetime import datetime
import requests

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/optimize', methods=['POST'])
def optimize_route():
    try:
        data = request.get_json()
        addresses = data.get('addresses', [])
        
        if not addresses or len(addresses) < 2:
            return jsonify({
                'success': False,
                'error': 'At least two addresses are required'
            }), 400

        # Store initial route in database
        try:
            route = Route(
                name=f"Route {datetime.utcnow()}",
                addresses=addresses,
                optimized_route=addresses  # Initially same as input order
            )
            db.session.add(route)
            db.session.commit()
        except Exception as db_error:
            app.logger.error(f"Database error: {str(db_error)}")
            return jsonify({
                'success': False,
                'error': 'Failed to store route information'
            }), 500

        # Geocode addresses using Google Maps Geocoding API
        api_key = app.config['GOOGLE_MAPS_API_KEY']
        geocoded_addresses = []
        
        for address in addresses:
            try:
                params = {
                    'address': address,
                    'key': api_key
                }
                response = requests.get('https://maps.googleapis.com/maps/api/geocode/json', params=params)
                result = response.json()
                
                if result['status'] != 'OK':
                    raise Exception(f"Geocoding failed for address: {address}")
                
                location = result['results'][0]['formatted_address']
                geocoded_addresses.append(location)
            except Exception as geo_error:
                app.logger.error(f"Geocoding error: {str(geo_error)}")
                return jsonify({
                    'success': False,
                    'error': f'Failed to geocode address: {address}'
                }), 400

        # Update route with geocoded addresses
        try:
            route.addresses = geocoded_addresses
            route.optimized_route = geocoded_addresses
            db.session.commit()
        except Exception as db_error:
            app.logger.error(f"Database update error: {str(db_error)}")
            return jsonify({
                'success': False,
                'error': 'Failed to update route information'
            }), 500
        
        return jsonify({
            'success': True,
            'route_id': route.id,
            'addresses': geocoded_addresses
        })

    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An unexpected error occurred'
        }), 500

@app.route('/export/<int:route_id>')
def export_route(route_id):
    try:
        route = Route.query.get_or_404(route_id)
        # Generate CSV of addresses
        addresses = '\n'.join(route.optimized_route)
        return addresses, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename=route_{route_id}.csv'
        }
    except Exception as e:
        app.logger.error(f"Export error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to export route'
        }), 500
