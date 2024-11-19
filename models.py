from app import db
from datetime import datetime

class Route(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    addresses = db.Column(db.JSON, nullable=False)
    optimized_route = db.Column(db.JSON, nullable=True)
    total_distance = db.Column(db.Float, nullable=True)
    total_duration = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'addresses': self.addresses,
            'optimized_route': self.optimized_route,
            'total_distance': self.total_distance,
            'total_duration': self.total_duration,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
