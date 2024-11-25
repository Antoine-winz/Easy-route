import json
import requests
from flask import redirect, request, url_for, session
from flask_login import login_user, logout_user, login_required, current_user
from app import app, client, db, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DISCOVERY_URL
from models import User

@app.errorhandler(403)
def forbidden_error(error):
    return render_template('error.html', 
        error_code=403,
        error_message="Access Forbidden. Please check your authentication configuration."), 403

def get_google_provider_cfg():
    try:
        return requests.get(GOOGLE_DISCOVERY_URL).json()
    except Exception as e:
        app.logger.error(f"Failed to get Google provider config: {e}")
        return None

@app.route("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    # Get Google's provider configuration
    google_provider_cfg = get_google_provider_cfg()
    if not google_provider_cfg:
        return render_template('error.html',
            error_code=500,
            error_message="Failed to get Google provider configuration"), 500
    
    # Use the correct redirect URI format
    redirect_uri = url_for('callback', _external=True)
    
    # Construct the request for Google login
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=redirect_uri,
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)

@app.route("/login/callback")
def callback():
    # Get the authorization code from Google
    code = request.args.get("code")
    if not code:
        return render_template('error.html',
            error_code=400,
            error_message="No authorization code provided"), 400

    google_provider_cfg = get_google_provider_cfg()
    if not google_provider_cfg:
        return render_template('error.html',
            error_code=500,
            error_message="Failed to get Google provider configuration"), 500

    token_endpoint = google_provider_cfg["token_endpoint"]
    
    # Prepare and send token request
    try:
        # Use the correct redirect URI here as well
        token_url, headers, body = client.prepare_token_request(
            token_endpoint,
            authorization_response=request.url,
            redirect_url=url_for('callback', _external=True),
            code=code
        )
        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
        )

        client.parse_request_body_response(json.dumps(token_response.json()))
    except Exception as e:
        app.logger.error(f"Token request failed: {e}")
        return "Failed to get token from Google", 500

    # Get user info from Google
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)
    
    if userinfo_response.json().get("email_verified"):
        google_id = userinfo_response.json()["sub"]
        email = userinfo_response.json()["email"]
        name = userinfo_response.json().get("name", email.split('@')[0])
        picture = userinfo_response.json().get("picture")
        
        # Find or create user
        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                profile_pic=picture
            )
            db.session.add(user)
            db.session.commit()
        
        # Begin user session
        login_user(user)
        return redirect(url_for('index'))
    else:
        return render_template('error.html',
            error_code=400,
            error_message="Email not verified by Google. Please verify your email first."), 400

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

from flask import render_template, jsonify, request, redirect, url_for
from app import app, db
from models import Route, Contact
from datetime import datetime
import requests
import numpy as np
from sqlalchemy import func, extract, case

@app.route('/')
def index():
    route_id = request.args.get('route_id')
    route = None
    if route_id:
        route = Route.query.get(route_id)
    return render_template('index.html', route=route)

@app.route('/routes')
def list_routes():
    routes = Route.query.order_by(Route.created_at.desc()).all()
    return render_template('routes.html', routes=routes)

@app.route('/statistics')
def route_statistics():
    # Get basic statistics
    total_routes = Route.query.count()
    avg_distance = db.session.query(func.avg(Route.total_distance)).scalar() or 0
    avg_duration = db.session.query(func.avg(Route.total_duration)).scalar() or 0
    
    # Get routes created per month
    monthly_routes = db.session.query(
        extract('year', Route.created_at).label('year'),
        extract('month', Route.created_at).label('month'),
        func.count(Route.id).label('count')
    ).group_by('year', 'month').order_by('year', 'month').all()
    
    # Format the data for charts
    months_data = [{'year': int(r[0]), 'month': int(r[1]), 'count': int(r[2])} 
                  for r in monthly_routes]
    
    # Get routes by distance ranges
    routes_by_distance = db.session.query(
        case(
            (Route.total_distance < 5000, '<5km'),
            (Route.total_distance < 10000, '5-10km'),
            (Route.total_distance < 20000, '10-20km'),
            else_='>20km'
        ).label('range'),
        func.count(Route.id).label('count')
    ).group_by('range').all()
    
    # Convert routes_by_distance to serializable format
    distance_data = [{'range': str(r[0]), 'count': int(r[1])} for r in routes_by_distance]
    
    # Get most frequent destinations
    all_addresses = []
    routes_with_addresses = Route.query.with_entities(Route.addresses).all()
    for route in routes_with_addresses:
        if route.addresses:
            all_addresses.extend(route.addresses)
    
    address_frequency = {}
    for addr in all_addresses:
        address_frequency[addr] = address_frequency.get(addr, 0) + 1
    
    top_destinations = sorted(
        address_frequency.items(), 
        key=lambda x: x[1], 
        reverse=True
    )[:10]
    
    return render_template('statistics.html',
                         total_routes=total_routes,
                         avg_distance=avg_distance,
                         avg_duration=avg_duration,
                         months_data=months_data,
                         routes_by_distance=distance_data,
                         top_destinations=top_destinations)

@app.route('/routes/<int:route_id>', methods=['GET'])
def get_route(route_id):
    try:
        route = Route.query.get_or_404(route_id)
        return jsonify({
            'success': True,
            'route': route.to_dict()
        })
    except Exception as e:
        app.logger.error(f"Error fetching route: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch route'
        }), 404

@app.route('/routes/<int:route_id>', methods=['DELETE'])
def delete_route(route_id):
    try:
        route = Route.query.get_or_404(route_id)
        db.session.delete(route)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error deleting route: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete route'
        }), 500

@app.route('/optimize', methods=['POST'])
def optimize_route():
    try:
        data = request.get_json()
        addresses = data.get('addresses', [])
        has_end_point = data.get('has_end_point', False)
        end_point = data.get('end_point')
        is_loop_route = data.get('is_loop_route', False)
        route_name = data.get('name', f"Route {datetime.utcnow()}")
        route_description = data.get('description', '')
        
        app.logger.info(f"Received {len(addresses)} addresses for optimization")
        
        if not addresses or len(addresses) < 2:
            return jsonify({
                'success': False,
                'error': 'At least two addresses are required'
            }), 400

        # Handle loop route
        if is_loop_route:
            app.logger.info("Processing loop route")
            has_end_point = False
            end_point = addresses[0]
            if addresses[0] != addresses[-1]:
                app.logger.info("Adding start point as end point for loop route")
                addresses.append(addresses[0])
        elif has_end_point and not end_point:
            return jsonify({
                'success': False,
                'error': 'End point is required when has_end_point is true'
            }), 400
        elif has_end_point and end_point:
            if end_point not in addresses:  # Only add if not already present
                addresses.append(end_point)

        # Store initial route in database
        try:
            app.logger.info("Storing initial route in database")
            route = Route()
            route.name = route_name
            route.description = route_description
            route.addresses = addresses
            route.optimized_route = addresses  # Initially same as input order
            db.session.add(route)
            db.session.commit()
            app.logger.info(f"Initial route stored with ID: {route.id}")
        except Exception as db_error:
            app.logger.error(f"Database error: {str(db_error)}")
            return jsonify({
                'success': False,
                'error': 'Failed to store route information'
            }), 500

        # Geocode addresses using Google Maps Geocoding API
        app.logger.info("Starting geocoding process")
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
        if not api_key:
            app.logger.error("Google Maps API key not found in environment variables")
            return jsonify({
                'success': False,
                'error': 'Missing API configuration'
            }), 500
            
        geocoded_addresses = []
        coordinates = []
        
        for address in addresses:
            try:
                params = {
                    'address': address,
                    'key': api_key
                }
                app.logger.info(f"Geocoding address: {address}")
                response = requests.get('https://maps.googleapis.com/maps/api/geocode/json', params=params)
                result = response.json()
                
                if result['status'] != 'OK':
                    raise Exception(f"Geocoding failed for address: {address}")
                
                location = result['results'][0]
                formatted_address = location['formatted_address']
                geocoded_addresses.append(formatted_address)
                coordinates.append(f"{location['geometry']['location']['lat']},{location['geometry']['location']['lng']}")
                app.logger.info(f"Successfully geocoded address: {formatted_address}")
            except Exception as geo_error:
                app.logger.error(f"Geocoding error: {str(geo_error)}")
                return jsonify({
                    'success': False,
                    'error': f'Failed to geocode address: {address}'
                }), 400

        try:
            # Get distance matrix
            app.logger.info("Calculating distance matrix")
            distance_matrix, duration_matrix = get_distance_matrix(coordinates, api_key)
            app.logger.info("Distance matrix calculation complete")
            
            # Calculate optimal route
            app.logger.info("Calculating optimal route")
            optimal_route_indices = nearest_neighbor(
                distance_matrix, 
                has_end_point=has_end_point,
                is_loop_route=is_loop_route
            )
            optimized_addresses = [geocoded_addresses[i] for i in optimal_route_indices]
            app.logger.info("Route optimization complete")
            
            # Calculate total distance and duration
            total_distance = sum(distance_matrix[optimal_route_indices[i]][optimal_route_indices[i+1]] 
                            for i in range(len(optimal_route_indices)-1))
            total_duration = sum(duration_matrix[optimal_route_indices[i]][optimal_route_indices[i+1]] 
                            for i in range(len(optimal_route_indices)-1))
            
            # Update route with optimized addresses and statistics
            app.logger.info("Updating route with optimized addresses")
            route.optimized_route = optimized_addresses
            route.total_distance = total_distance
            route.total_duration = total_duration
            db.session.commit()
            app.logger.info(f"Route {route.id} successfully optimized")
            
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

def get_distance_matrix(locations, api_key):
    if not api_key:
        raise ValueError("API key is required for distance matrix calculation")
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

def nearest_neighbor(distance_matrix, has_end_point=False, is_loop_route=False):
    n = len(distance_matrix)
    
    if n <= 2:  # If only start and end points, return as is
        return list(range(n))
        
    if has_end_point or is_loop_route:
        # Only optimize intermediate points (excluding start and end)
        unvisited = set(range(1, n-1))  # Skip start and end points
        current = 0  # Start from first location
        path = [current]
        
        while unvisited:
            next_point = min(unvisited, key=lambda x: distance_matrix[current][x])
            path.append(next_point)
            unvisited.remove(next_point)
            current = next_point
            
        if is_loop_route:
            path.append(0)  # Return to start point for loop routes
        else:
            path.append(n-1)  # Add end point for regular routes
    else:
        # Optimize all points except start
        unvisited = set(range(1, n))  # Skip start point
        current = 0  # Start from first location
        path = [current]
        
        while unvisited:
            next_point = min(unvisited, key=lambda x: distance_matrix[current][x])
            path.append(next_point)
            unvisited.remove(next_point)
            current = next_point
    
    return path
# Contact Management Routes
@app.route('/contacts')
def list_contacts():
    contacts = Contact.query.order_by(Contact.business_name).all()
    return render_template('contacts.html', contacts=contacts)

@app.route('/contacts/new', methods=['GET'])
def new_contact():
    return render_template('contact_form.html', contact=None)

@app.route('/contacts', methods=['POST'])
def create_contact():
    try:
        contact = Contact(
            business_name=request.form['business_name'],
            contact_name=request.form['contact_name'],
            address=request.form['address'],
            notes=request.form['notes']
        )
        db.session.add(contact)
        db.session.commit()
        return redirect(url_for('list_contacts'))
    except Exception as e:
        app.logger.error(f"Error creating contact: {str(e)}")
        return render_template('contact_form.html', error="Failed to create contact"), 400

@app.route('/contacts/<int:contact_id>', methods=['GET'])
def edit_contact(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    return render_template('contact_form.html', contact=contact)

@app.route('/contacts/<int:contact_id>', methods=['POST'])
def update_contact(contact_id):
    try:
        contact = Contact.query.get_or_404(contact_id)
        contact.business_name = request.form['business_name']
        contact.contact_name = request.form['contact_name']
        contact.address = request.form['address']
        contact.notes = request.form['notes']
        db.session.commit()
        return redirect(url_for('list_contacts'))
    except Exception as e:
        app.logger.error(f"Error updating contact: {str(e)}")
        return render_template('contact_form.html', contact=contact, error="Failed to update contact"), 400

@app.route('/contacts/<int:contact_id>/select')
def select_contact_address(contact_id):
    contact = Contact.query.get_or_404(contact_id)
    return jsonify({
        'success': True,
        'address': contact.address
    })


@app.route('/contacts/suggest')
def suggest_contacts():
    search_term = request.args.get('term', '').lower()
    if not search_term:
        return jsonify({'suggestions': []})
    
    # Search contacts where business name, contact name, or address contains the search term
    contacts = Contact.query.filter(
        db.or_(
            Contact.business_name.ilike(f'%{search_term}%'),
            Contact.contact_name.ilike(f'%{search_term}%'),
            Contact.address.ilike(f'%{search_term}%')
        )
    ).limit(5).all()
    
    suggestions = [{
        'label': f"{contact.business_name} - {contact.address}",
        'value': contact.address
    } for contact in contacts]
    
    return jsonify({'suggestions': suggestions})