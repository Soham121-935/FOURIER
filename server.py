import http.server
import socketserver
import urllib.request
import json

PORT = 8001
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # Forward the request to NVIDIA API
            req = urllib.request.Request(
                NVIDIA_API_URL, 
                data=post_data,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer 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'
                },
                method='POST'
            )
            
            try:
                with urllib.request.urlopen(req) as response:
                    self.send_response(response.status)
                    self.send_cors_headers()
                    for k, v in response.headers.items():
                        if k.lower() not in ['transfer-encoding', 'connection', 'content-length', 'access-control-allow-origin']:
                            self.send_header(k, v)
                    self.end_headers()
                    
                    while True:
                        line = response.readline()
                        if not line:
                            break
                        self.wfile.write(line)
                        self.wfile.flush()
            except urllib.error.HTTPError as e:
                body = e.read()
                self.send_response(e.code)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                err_data = json.dumps({'error': str(e)}).encode('utf-8')
                self.send_header('Content-Length', str(len(err_data)))
                self.end_headers()
                self.wfile.write(err_data)
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()

socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    print(f"Backend proxy server running at http://localhost:{PORT}")
    print("Proxying /api/chat to NVIDIA NIM API (CORS enabled)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
