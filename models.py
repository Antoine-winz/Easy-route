from app import db
from datetime import datetime
from sqlalchemy import JSON

class Route(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    addresses = db.Column(JSON, nullable=False)
    optimized_route = db.Column(JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __init__(self, name, addresses, optimized_route=None):
        self.name = name
        self.addresses = addresses
        self.optimized_route = optimized_route
