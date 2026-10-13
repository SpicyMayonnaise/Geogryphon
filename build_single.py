#!/usr/bin/env python3
"""Inline css/ and js/ into one self-contained HTML file: geogryphon_single.html
Usage: python3 build_single.py      (run it from anywhere; it finds its own folder)"""
import os, re, sys
root = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
html = read('index.html')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + read('css/style.css') + '\n</style>')
def inline(m):
    code = read(m.group(1))
    if '</script' in code.lower():
        sys.exit('refusing to inline %s: contains a closing script tag' % m.group(1))
    return '<script>\n' + code + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = os.path.join(root, 'geogryphon_single.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html), 'bytes')
