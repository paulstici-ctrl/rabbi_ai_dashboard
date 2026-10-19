#!/usr/bin/env python3
"""Full-page screenshots for design review. Usage: python3 tools/shots.py OUTDIR [route ...]"""
import subprocess, sys, time, signal, os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); out = sys.argv[1]; routes = sys.argv[2:] or ['overview', 'terminal', 'agents', 'lab', 'journal', 'system']
os.makedirs(out, exist_ok=True); srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'scripts/serve.py'), '8802'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); import socket
for _ in range(80):
    try: socket.create_connection(('127.0.0.1', 8802), 0.2).close(); break
    except OSError: time.sleep(0.1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, vp, mob in (('desktop', dict(width=1440, height=900), False), ('phone', dict(width=412, height=915), True)):
            ctx = b.new_context(viewport=vp, device_scale_factor=1, is_mobile=mob, has_touch=mob); pg = ctx.new_page()
            for r in routes:
                pg.goto(f'http://127.0.0.1:8802/index.html#/{r}'); pg.wait_for_selector('#main .panel'); pg.wait_for_timeout(1500); pg.screenshot(path=f'{out}/{name}_{r}_full.png', full_page=True)
            ctx.close()
        b.close()
finally:
    srv.send_signal(signal.SIGINT); srv.wait(timeout=5)
