"""Build the site.

    python3 tools/build.py            -> index.html (main page), <family>/index.html, SOURCES.md
    python3 tools/build.py --preview  -> dist/preview-*.html with local fonts, for screenshots without internet

To add a family: write data/<slug>-family.json (same shape as the Musk or Bezos file),
add it to FAMILIES below with a teaser, and rebuild.
"""
import json, os, re, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://destinjones.github.io/the-money-files/'
FAMILIES = [
    ('musk', 'The Musk family', 'The first trillionaire. SpaceX, Tesla, the brothers, the cousins and 14 kids.'),
    ('bezos', 'The Bezos family', 'Amazon, Blue Origin, The Washington Post, and about $700 million in homes.'),
]
FONTS = ('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@500;600;700'
         '&family=Permanent+Marker&family=Public+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap')
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
        "%3Ccircle cx='32' cy='32' r='30' fill='%23FFB020'/%3E%3Ctext x='32' y='46' font-family='Impact,Anton,sans-serif' "
        "font-size='40' text-anchor='middle' fill='%231a1205'%3E$%3C/text%3E%3C/svg%3E")


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def write(p, text):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(text)
    print('wrote', p)


def family(slug):
    return json.loads(read(f'data/{slug}-family.json'))


def check(data):
    ids = {s['id'] for s in data['sources']}
    bad = []

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('src', 'kidsSrc', 'bornSrc'):
                    bad.extend(i for i in v if i not in ids)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(data)
    if bad:
        sys.exit('Unknown source ids: ' + ', '.join(bad))


def blob(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


def doc(title, desc, og, body, preview):
    fonts = (f'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
             f'<link rel="stylesheet" href="{FONTS}">')
    if preview:
        fonts = '<style>' + read('dist/local-fonts.css') + '</style>'
    head = [f'<title>{title}</title>', f'<meta name="description" content="{html.escape(desc)}">',
            '<meta name="theme-color" content="#0B0F17">', f'<link rel="icon" href="{ICON}">',
            '<meta property="og:type" content="website">', f'<meta property="og:title" content="{html.escape(title)}">',
            f'<meta property="og:description" content="{html.escape(desc)}">', f'<meta property="og:image" content="{SITE}{og}">',
            '<meta name="twitter:card" content="summary_large_image">', fonts, '<style>\n' + read('src/style.css') + '</style>']
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + '\n'.join(head) + '\n</head>\n<body>\n' + body + '</body>\n</html>\n')


def family_page(slug, preview=False):
    d = family(slug)
    check(d)
    d.pop('cases', None)
    body = re.sub(r'\{\{(\w+)\}\}', lambda m: d['copy'][m.group(1)], read('src/body.html'))
    body += f'<script id="mf-data" type="application/json">{blob(d)}</script>\n<script>\n{read("src/app.js")}</script>\n'
    return doc(d['copy']['title'], d['copy']['desc'], d['meta']['og'], body, preview)


def hub_page(preview=False):
    fams, redirects = [], {}
    for slug, title, teaser in FAMILIES:
        d = family(slug)
        c = next(p for p in d['people'] if p['id'] == d['meta']['center'])
        v = {'musk': 1.046e12}.get(slug) or next(i['v'] for i in d['ladder']['items'])
        words = re.sub(r'[^A-Za-z ]', '', c['name']).split()
        fams.append(dict(slug=slug, title=title, teaser=teaser, file=d['meta']['file'], name=c['name'], worthV=v,
                         worthShort=c['tag'], photo=d['photos'].get(c['photo']), initials=words[0][0] + words[-1][0],
                         people=len([p for p in d['people'] if not p.get('connector')]), sources=len(d['sources'])))
        for p in d['people']:
            redirects.setdefault(p['id'], slug + '/')
    musk = family('musk')
    data = dict(asOfLabel=musk['meta']['asOfLabel'], repo=musk['meta']['repo'], families=fams, redirects=redirects, cases=musk['cases'])
    body = read('src/hub.html').replace('{{HUBDATA}}', blob(data))
    return doc('The Money Files', 'Follow the money: interactive, fully sourced maps of the richest families on Earth. Who owns what, which stocks you can buy, the homes, and the receipts.',
               'assets/og-hub.jpg', body, preview)


def sources_md():
    names = {'family': 'The family', 'money': 'The money', 'record': 'On the record', 'homes': 'The homes'}
    out = ['# Sources', '', 'Every numbered source on the site. Each family page numbers its own sources; '
           'the numbers below match the little blue links on that page.', '']
    for slug, title, _ in FAMILIES:
        d = family(slug)
        out += [f"## {title} ({d['meta']['file']}, data as of {d['meta']['asOfLabel']})", '']
        n = 0
        for g, gt in names.items():
            rows = [s for s in d['sources'] if s['group'] == g]
            if not rows:
                continue
            out += [f'### {gt}', '']
            for s in rows:
                n += 1
                out.append(f"{n}. [{s['pub']}]({s['url']}): {s['title']} ({s['date']})")
            out.append('')
        out += ['### Photo credits', '']
        people = {p['id']: p['name'] for p in d['people']}
        for k, ph in d['photos'].items():
            page_url = 'https://commons.wikimedia.org/wiki/File:' + ph['file'].replace(' ', '_')
            out.append(f"- {people.get(k, k)}: [{ph['file']}]({page_url.replace(' ', '%20')}) by {ph['author']} ({ph['year']}), "
                       f"[{ph['license']}]({d['licenses'][ph['license']]})")
        out.append('')
    return '\n'.join(out)


if __name__ == '__main__':
    preview = '--preview' in sys.argv
    if preview:
        write('dist/preview-hub.html', hub_page(True))
        for slug, _, _ in FAMILIES:
            write(f'dist/preview-{slug}.html', family_page(slug, True))
    else:
        write('index.html', hub_page())
        for slug, _, _ in FAMILIES:
            write(f'{slug}/index.html', family_page(slug))
        write('SOURCES.md', sources_md())
