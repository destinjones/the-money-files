"""Build the site.

    python3 tools/build.py            -> index.html (GitHub Pages) + SOURCES.md
    python3 tools/build.py --artifact -> dist/artifact.html (page body only, for hosts that add their own <head>)
    python3 tools/build.py --preview  -> dist/preview.html (local fonts, for screenshots without internet)

Edit data/musk-family.json, src/style.css, src/app.js or src/body.html, then rebuild.
"""
import json, os, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://destinjones.github.io/the-money-files/'
TITLE = 'The Musk Money File'
DESC = ('The first trillionaire has a family. An interactive, fully sourced map of the Musk family: '
        'who owns what, which stocks you can buy, the homes, and the money on the public record.')
FONTS = ('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@500;600;700'
         '&family=Permanent+Marker&family=Public+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap')
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
        "%3Ccircle cx='32' cy='32' r='30' fill='%23FFB020'/%3E%3Ctext x='32' y='46' font-family='Impact,Anton,sans-serif' "
        "font-size='40' text-anchor='middle' fill='%231a1205'%3E$%3C/text%3E%3C/svg%3E")


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def check(data):
    ids = {s['id'] for s in data['sources']}
    bad = []

    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('src', 'kidsSrc', 'bornSrc'):
                    bad.extend(f'{path}.{k}: {i}' for i in v if i not in ids)
                else:
                    walk(v, f'{path}.{k}')
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f'{path}[{i}]')
    walk(data, 'data')
    if bad:
        sys.exit('Unknown source ids:\n  ' + '\n  '.join(bad))


def page(mode):
    data = json.loads(read('data/musk-family.json'))
    check(data)
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    css, js, body = read('src/style.css'), read('src/app.js'), read('src/body.html')
    fonts = f'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="{FONTS}">'
    if mode == 'preview':
        fonts = '<style>' + read('dist/local-fonts.css') + '</style>'
    head = [f'<title>{TITLE}</title>', f'<meta name="description" content="{html.escape(DESC)}">']
    if mode == 'pages':
        head += [
            '<meta name="theme-color" content="#0B0F17">',
            f'<link rel="icon" href="{ICON}">',
            '<meta property="og:type" content="website">',
            f'<meta property="og:title" content="{TITLE}">',
            f'<meta property="og:description" content="{html.escape(DESC)}">',
            f'<meta property="og:url" content="{SITE}">',
            f'<meta property="og:image" content="{SITE}assets/og.jpg">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta name="twitter:card" content="summary_large_image">',
        ]
    head += [fonts, f'<style>\n{css}</style>']
    tail = f'<script id="mf-data" type="application/json">{blob}</script>\n<script>\n{js}</script>\n'
    if mode == 'artifact':
        return '\n'.join(head) + '\n' + body + tail
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + '\n'.join(head) + '\n</head>\n<body>\n' + body + tail + '</body>\n</html>\n')


def sources_md():
    data = json.loads(read('data/musk-family.json'))
    names = {'family': 'The family', 'money': 'The money', 'record': 'On the record', 'homes': 'The homes'}
    out = ['# Sources', '', f"Every numbered source on the site, as of {data['meta']['asOfLabel']}. "
           'The numbers match the little blue source links on the page.', '']
    n = 0
    for g, title in names.items():
        out += [f'## {title}', '']
        for s in data['sources']:
            if s['group'] != g:
                continue
            n += 1
            out.append(f"{n}. [{s['pub']}]({s['url']}): {s['title']} ({s['date']})")
        out.append('')
    out += ['## Photo credits', '', 'All photos are from Wikimedia Commons and cropped for display. Children are never shown.', '']
    people = {p['id']: p['name'] for p in data['people']}
    for k, ph in data['photos'].items():
        page_url = 'https://commons.wikimedia.org/wiki/File:' + ph['file'].replace(' ', '_')
        out.append(f"- {people.get(k, k)}: [{ph['file']}]({page_url.replace(' ', '%20')}) by {ph['author']} ({ph['year']}), "
                   f"[{ph['license']}]({data['licenses'][ph['license']]})")
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    mode = 'artifact' if '--artifact' in sys.argv else 'preview' if '--preview' in sys.argv else 'pages'
    if mode == 'pages':
        with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page('pages'))
        with open(os.path.join(ROOT, 'SOURCES.md'), 'w', encoding='utf-8') as f:
            f.write(sources_md())
        print('wrote index.html and SOURCES.md')
    else:
        os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
        out = os.path.join(ROOT, 'dist', f'{mode}.html')
        with open(out, 'w', encoding='utf-8') as f:
            f.write(page(mode))
        print('wrote', out)
