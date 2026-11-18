"""Jalankan server + buka browser otomatis untuk THE CURE.

Dipakai oleh start.bat. Bisa juga langsung:  python start.py
Tekan Ctrl+C untuk berhenti.
"""

import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_AWAL = 8000
JEDA_PORT = 12


def cari_port():
    for port in range(PORT_AWAL, PORT_AWAL + JEDA_PORT):
        with socket.socket() as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return PORT_AWAL


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):  
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # biar konsol tetap bersih


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = cari_port()
    url = f"http://localhost:{port}/index.html?autoplay=1"

    try:
        httpd = Server(("0.0.0.0", port), Handler)
    except OSError as err:
        print(f"Gagal membuka port {port}: {err}")
        sys.exit(1)

    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    print("THE CURE // lyric.system")
    print(f"Jalan di: {url}")
    print("Refresh browser setelah edit lyrics.js. Ctrl+C untuk berhenti.")

    try:
        webbrowser.open(url)
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\nServer dimatikan.")
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
