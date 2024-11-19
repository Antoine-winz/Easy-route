import os
import socket
from app import app

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    while is_port_in_use(port):
        port += 1
    app.run(host='0.0.0.0', port=port)
