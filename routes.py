from flask import render_template, jsonify, request
from app import app, db
from models import Route
from datetime import datetime
import requests
import numpy as np

@app.route('/')
def index():
    return render_template('index.html')

def get_distance_matrix(locations, api_key):
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    
    # Create a matrix of all distances
    n = len(locations)
    distance_matrix = np.zeros((n, n))
    duration_matrix = np.zeros((n, n))
    
    for i in range(n):
        params = {
            'origins': locations[i],
            'destinations': '|'.join(locations),
            'key': api_key,
            'mode': 'driving'
        }
        
        response = requests.get(url, params=params)
        result = response.json()
        
        if result['status'] != 'OK':
            raise Exception(f"Distance Matrix API failed: {result['status']}")
            
        for j in range(n):
            element = result['rows'][0]['elements'][j]
            if element['status'] == 'OK':
                distance_matrix[i][j] = element['distance']['value']
                duration_matrix[i][j] = element['duration']['value']
            else:
                raise Exception(f"Unable to calculate distance between points {i} and {j}")
    
    return distance_matrix, duration_matrix

def nearest_neighbor(distance_matrix):
    n = len(distance_matrix)
    unvisited = set(range(1, n))  # Skip start point
    current = 0  # Start from first location
    path = [current]
    
    while unvisited:
        next_point = min(unvisited, key=lambda x: distance_matrix[current][x])
        path.append(next_point)
        unvisited.remove(next_point)
        current = next_point
    
    return path

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
        coordinates = []
        
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
                
                location = result['results'][0]
                formatted_address = location['formatted_address']
                geocoded_addresses.append(formatted_address)
                coordinates.append(f"{location['geometry']['location']['lat']},{location['geometry']['location']['lng']}")
            except Exception as geo_error:
                app.logger.error(f"Geocoding error: {str(geo_error)}")
                return jsonify({
                    'success': False,
                    'error': f'Failed to geocode address: {address}'
                }), 400

        try:
            # Get distance matrix
            distance_matrix, duration_matrix = get_distance_matrix(coordinates, api_key)
            
            # Calculate optimal route
            optimal_route_indices = nearest_neighbor(distance_matrix)
            optimized_addresses = [geocoded_addresses[i] for i in optimal_route_indices]
            
            # Calculate total distance and duration
            total_distance = sum(distance_matrix[optimal_route_indices[i]][optimal_route_indices[i+1]] 
                               for i in range(len(optimal_route_indices)-1))
            total_duration = sum(duration_matrix[optimal_route_indices[i]][optimal_route_indices[i+1]] 
                               for i in range(len(optimal_route_indices)-1))
            
            # Update route with optimized addresses
            route.optimized_route = optimized_addresses
            db.session.commit()
            
            return jsonify({
                'success': True,
                'route_id': route.id,
                'addresses': optimized_addresses,
                'total_distance': total_distance,
                'total_duration': total_duration
            })
            
        except Exception as opt_error:
            app.logger.error(f"Optimization error: {str(opt_error)}")
            return jsonify({
                'success': False,
                'error': 'Failed to optimize route'
            }), 500

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
