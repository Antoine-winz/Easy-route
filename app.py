import os
import atexit
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"

# Create instance directory if it doesn't exist
instance_path = os.path.join(os.getcwd(), 'instance')
os.makedirs(instance_path, exist_ok=True)

# Set database URI using absolute path
db_path = os.path.join(instance_path, 'routes.db')
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["GOOGLE_MAPS_API_KEY"] = os.environ.get("GOOGLE_MAPS_API_KEY")

# Initialize the database
db.init_app(app)

def cleanup_server():
    try:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
            app.logger.info("Server cleanup completed successfully")
    except Exception as e:
        print(f"Error during server cleanup: {str(e)}")

atexit.register(cleanup_server)

# Create tables within application context
with app.app_context():
    try:
        import models
        import routes
        db.create_all()
        app.logger.info("Database tables created successfully")
    except Exception as e:
        app.logger.error(f"Error creating database tables: {str(e)}")
        raise
