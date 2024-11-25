import os
from datetime import timedelta
from flask import Flask, redirect, url_for, session, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_login import LoginManager, current_user
from oauthlib.oauth2 import WebApplicationClient
import json
import requests

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or os.urandom(24)

# OAuth 2.0 client setup
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", None)
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", None)
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    app.logger.error("Missing Google OAuth credentials")

# Initialize OAuth client
try:
    client = WebApplicationClient(GOOGLE_CLIENT_ID)
except Exception as e:
    app.logger.error(f"Failed to initialize OAuth client: {e}")
    client = None

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

# Session configuration
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)
app.config['PREFERRED_URL_SCHEME'] = 'https'

# Ensure session is secure
@app.before_request
def before_request():
    if not request.is_secure and not app.debug:
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///routes.db"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["GOOGLE_MAPS_API_KEY"] = os.environ.get("GOOGLE_MAPS_API_KEY")
app.config["GOOGLE_MAPS_MAP_ID"] = "DEMO_MAP_ID"  # We'll use a default Map ID for now
db.init_app(app)

with app.app_context():
    import models
    import routes
    db.create_all()
