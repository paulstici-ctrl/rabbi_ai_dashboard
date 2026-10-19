#!/usr/bin/env python3
"""Browser smoke test (dev only): needs `pip install playwright` + a Chromium. Starts scripts/serve.py, visits every route on
desktop and phone viewports, fails on console errors / uncaught exceptions / horizontal overflow / blank canvases.
Usage: python3 tools/smoke.py [--shots DIR]"""
import subprocess, sys, time, json, os, signal
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PORT = 8801
ROUTES = ['overview', 'terminal', 'agents', 'lab', 'journal', 'system']
VIEWS = {'desktop': dict(width=1440, height=900), 'phone': dict(width=412, height=915, device_scale_factor=2, is_mobile=True, has_touch=True)}
shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'scripts/serve.py'), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import socket
for _ in range(80):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
problems, report = [], []
CANVAS_JS = """() => [...document.querySelectorAll('canvas')].map(c => { const x = c.getContext('2d'); if (!c.width || !c.height) return {w:0,h:0,ink:0};
  const d = x.getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) ink++; return {w:c.width,h:c.height,ink}; })"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vname, vp in VIEWS.items():
            ctx = b.new_context(viewport={'width': vp['width'], 'height': vp['height']}, device_scale_factor=vp.get('device_scale_factor', 1), is_mobile=vp.get('is_mobile', False), has_touch=vp.get('has_touch', False), reduced_motion='no-preference')
            page = ctx.new_page(); errs = []
            page.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            page.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
            page.goto(f'http://127.0.0.1:{PORT}/index.html#/overview'); page.wait_for_selector('.kpis', timeout=8000)
            for r in ROUTES:
                page.goto(f'http://127.0.0.1:{PORT}/index.html#/{r}'); page.wait_for_selector(f'#main .panel', timeout=8000); page.wait_for_timeout(1400)
                ov = page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
                cv = page.evaluate(CANVAS_JS); blank = [c for c in cv if c['ink'] < 30]
                npan = page.locator('#main .panel').count()
                report.append(dict(view=vname, route=r, panels=npan, canvases=len(cv), blank=len(blank), overflow_px=ov))
                if ov > 1: problems.append(f'{vname}/{r}: horizontal overflow {ov}px')
                if npan < 2: problems.append(f'{vname}/{r}: only {npan} panels')
                if r in ('overview', 'terminal', 'agents', 'lab') and (not cv or blank): problems.append(f'{vname}/{r}: blank/missing canvas {blank or cv}')
                if shots: os.makedirs(shots, exist_ok=True); page.screenshot(path=os.path.join(shots, f'{vname}_{r}.png'), full_page=False)
            # interactions
            page.goto(f'http://127.0.0.1:{PORT}/index.html#/terminal'); page.wait_for_selector('canvas'); page.wait_for_timeout(600)
            page.click('[data-action="t-tf"][data-value="H1"]'); page.wait_for_timeout(500); page.click('[data-action="t-symbol"][data-value="EURUSD"]'); page.wait_for_timeout(500)
            assert page.locator('.seg__btn[aria-pressed="true"]').count() >= 2
            page.goto(f'http://127.0.0.1:{PORT}/index.html#/journal'); page.wait_for_selector('.tbl'); page.click('a[data-action="j-open"] >> nth=0'); page.wait_for_selector('.drawer'); page.wait_for_timeout(500)
            if shots: page.screenshot(path=os.path.join(shots, f'{vname}_journal_drawer.png'))
            page.keyboard.press('Escape')
            page.goto(f'http://127.0.0.1:{PORT}/index.html#/lab'); page.wait_for_selector('.params'); page.fill('[data-key="min_stop_pips"]', '150'); page.wait_for_timeout(200)
            assert 'unreachable' in page.inner_text('[data-validation]'), 'lab validation did not flag the unreachable stop'
            page.click('[data-action="l-run"]'); page.wait_for_timeout(400)
            if vname == 'desktop':
                page.keyboard.press('Control+k'); page.wait_for_selector('.palette'); page.keyboard.type('gbpjpy'); page.keyboard.press('Enter'); page.wait_for_timeout(500)
                assert 'terminal' in page.url
            real = [e for e in errs if 'favicon' not in e]
            if real: problems.append(f'{vname}: {real[:4]}')
            ctx.close()
        b.close()
finally:
    srv.send_signal(signal.SIGINT); srv.wait(timeout=5)
print(json.dumps(report, indent=1)); print('PROBLEMS:', problems or 'none'); sys.exit(1 if problems else 0)
