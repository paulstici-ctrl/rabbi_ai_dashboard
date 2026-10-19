#!/usr/bin/env python3
"""Tiny static server for local use (ES modules need http://, not file://). Usage: python3 scripts/serve.py [port]"""
import http.server, os, socketserver, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json'}
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', port), H) as httpd:
    print(f'RABBIT Command Center on http://127.0.0.1:{port}/index.html  (Ctrl+C to stop)'); httpd.serve_forever()
