"""Build the site.

    python3 tools/build.py            -> index.html (main page), <family>/index.html, SOURCES.md
    python3 tools/build.py --preview  -> dist/preview-*.html with local fonts, for screenshots without internet

To add a family: write data/<slug>-family.json (see tools/FAMILY_SPEC.md), check it with
tools/validate.py, add it to FAMILIES below with a category and a teaser, and rebuild.
"""
import json, os, re, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://destinjones.github.io/the-money-files/'
CATEGORIES = [('tech', 'Tech'), ('business', 'Business'), ('entertainment', 'Entertainment'), ('sports', 'Sports'), ('politics', 'Politics')]
# (slug, title, category, teaser). Families whose data file doesn't exist yet are skipped.
FAMILIES = [
    ('musk', 'The Musk family', 'tech', 'The first trillionaire. SpaceX, Tesla, the brothers, the cousins and 14 kids.'),
    ('bezos', 'The Bezos family', 'tech', 'Amazon, Blue Origin, The Washington Post, and about $700 million in homes.'),
    ('zuckerberg', 'The Zuckerberg family', 'tech', 'Meta, a 99% giving pledge, three sisters and a $170 million Miami compound.'),
    ('ellison', 'The Ellison family', 'tech', 'Oracle, 98% of a Hawaiian island, and a son who runs Paramount.'),
    ('gates', 'The Gates family', 'tech', 'Microsoft, a foundation set to close in 2045, and a family office called Cascade.'),
    ('huang', 'The Huang family', 'tech', 'Nvidia, the AI boom, and two children who work at the company.'),
    ('brin', 'The Brin family', 'tech', 'Google, two ex-wives with ventures of their own, and an airship company.'),
    ('buffett', 'The Buffett family', 'business', 'Berkshire Hathaway, the Omaha house he bought in 1958, and billions given away.'),
    ('walton', 'The Walton family', 'business', 'America’s richest family: about 44% of Walmart, the Broncos and four billionaires.'),
    ('arnault', 'The Arnault family', 'business', 'LVMH, Dior, Paris FC and five children running the brands.'),
    ('murdoch', 'The Murdoch family', 'business', 'Fox, News Corp and the trust fight that left Lachlan in control.'),
    ('kardashian', 'The Kardashian-Jenner family', 'entertainment', 'SKIMS, Kylie Cosmetics, Good American: the TV family’s businesses, mapped.'),
    ('swift', 'The Swift family', 'entertainment', 'The masters she bought back, the first $2 billion tour, and a new family.'),
    ('rihanna', 'The Fenty family', 'entertainment', 'Fenty Beauty, Savage X Fenty and the talks over LVMH’s half.'),
    ('carter', 'The Carter family', 'entertainment', 'Jay-Z and Beyoncé: Roc Nation, champagne, cognac, Tidal and two billionaires.'),
    ('winfrey', 'The Winfrey family', 'entertainment', 'Harpo, OWN, WeightWatchers and land in Montecito and Maui.'),
    ('mrbeast', 'The Donaldson family', 'entertainment', 'MrBeast’s Beast Industries, Feastables, Beast Games and a $5 billion valuation.'),
    ('james', 'The James family', 'sports', 'The first active NBA billionaire: Nike for life, Fenway Sports Group and Beats.'),
    ('jordan', 'The Jordan family', 'sports', 'The Nike deal, the Hornets sale, a NASCAR team and a tequila brand.'),
    ('ronaldo', 'The Ronaldo family', 'sports', 'Al-Nassr, Nike, CR7 hotels and football’s first billionaire.'),
    ('trump', 'The Trump family', 'politics', 'Trump Media, World Liberty, the $TRUMP coin, Mar-a-Lago and who runs what.'),
    ('pelosi', 'The Pelosi family', 'politics', 'Her House disclosures, Paul Pelosi’s reported trades, and two Baltimore mayors.'),
]
FONTS = ('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@500;600;700'
         '&family=Permanent+Marker&family=Public+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap')
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
        "%3Ccircle cx='32' cy='32' r='30' fill='%23FFB020'/%3E%3Ctext x='32' y='46' font-family='Impact,Anton,sans-serif' "
        "font-size='40' text-anchor='middle' fill='%231a1205'%3E$%3C/text%3E%3C/svg%3E")
LEDGER_FOOT = '“Our sum” means simple addition of the linked filings or reports.'
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()


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


def live_families():
    return [f for f in FAMILIES if os.path.exists(os.path.join(ROOT, f'data/{f[0]}-family.json'))]


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


def initials(name):
    words = [w for w in re.split(r'[^\w]+', name) if w and w[0].isalpha() and not re.fullmatch(r'Jr|Sr|II|III|IV', w)]
    words = [w for w in words if w[0].isupper()] or words
    return (words[0][0] + words[-1][0]) if len(words) > 1 else words[0][0]


def published_worth(d):
    """The center's fortune if Forbes or Bloomberg publishes one, else None."""
    c = center(d)
    w = c.get('worth') or {}
    if not w.get('value') or not re.search(r'Forbes|Bloomberg', w.get('by', '')):
        return None
    if d.get('calc', {}).get('worth'):
        return d['calc']['worth']
    return d['ladder']['items'][0]['v'] if d.get('ladder') else None


def center(d):
    return next(p for p in d['people'] if p['id'] == d['meta']['center'])


def card(slug, title, cat, teaser):
    d = family(slug)
    c = center(d)
    v = {'musk': 1.046e12}.get(slug) or published_worth(d)
    return dict(slug=slug, title=title, cat=cat, teaser=teaser, file=d['meta']['file'], name=c['name'], short=c['short'],
                worthV=v, worthShort=c.get('tag') or '', photo=d['photos'].get(c.get('photo')), initials=initials(c['name']),
                people=len([p for p in d['people'] if not p.get('connector')]), sources=len(d['sources']),
                asOf=d['meta']['asOf'], asOfLabel=d['meta']['asOfLabel'], by=(c.get('worth') or {}).get('by', ''))


def face_html(f, size_cls=''):
    """Server-side version of the circular face crop used by the site."""
    ph = f.get('photo')
    img = ''
    if ph:
        r = ph['h'] / ph['w']
        w = max(1, ph['w'] / ph['h']) * ph['zoom']
        hh = w * r
        left = min(0, max(1 - w, 0.5 - ph['fx'] * w))
        top = min(0, max(1 - hh, 0.46 - ph['fy'] * hh))
        name = ph['file'].replace(' ', '_')
        from urllib.parse import quote
        src = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + quote(name, safe='') + ('?width=400' if ph['w'] > 400 else '')
        img = (f'<img src="{html.escape(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" '
               f'style="width:{w * 100:.2f}%;left:{left * 100:.2f}%;top:{top * 100:.2f}%" onerror="this.remove()">')
    return f'<span class="face{size_cls}" data-initials="{html.escape(f["initials"])}">{img}</span>'


def more_files(slug, cards):
    """Up to four other files: the next and previous files, then others in the same category, then the richest."""
    order = [c['slug'] for c in cards]
    i = order.index(slug)
    me = cards[i]
    picks = []
    for s in [order[(i + 1) % len(order)], order[(i - 1) % len(order)]]:
        if s != slug and s not in picks:
            picks.append(s)
    for c in cards:
        if c['cat'] == me['cat'] and c['slug'] not in picks + [slug]:
            picks.append(c['slug'])
    for c in sorted(cards, key=lambda c: -(c['worthV'] or 0)):
        if c['slug'] not in picks + [slug]:
            picks.append(c['slug'])
    by = {c['slug']: c for c in cards}
    out = []
    for s in picks[:4]:
        c = by[s]
        out.append(f'<a class="more-card" href="../{s}/">{face_html(c)}<span class="mc-text"><span class="mc-file">{html.escape(c["file"])}</span>'
                   f'<span class="mc-name">{html.escape(c["title"])}</span><span class="mc-worth">{html.escape(c["worthShort"])}</span></span></a>')
    return '\n'.join(out)


def family_page(slug, cards, preview=False):
    d = family(slug)
    check(d)
    d.pop('cases', None)
    extra = {'his': d['meta'].get('pronoun', 'his'), 'ledgerFoot': d['copy'].get('ledgerFoot', LEDGER_FOOT),
             'moreFiles': more_files(slug, cards), 'fileCount': str(len(cards)),
             'h1Class': 'long' if len(re.sub(r'<[^>]+>', '', d['copy']['h1'])) > 62 else ''}
    body = re.sub(r'\{\{(\w+)\}\}', lambda m: extra.get(m.group(1), d['copy'].get(m.group(1), '')), read('src/body.html'))
    body += f'<script id="mf-data" type="application/json">{blob(d)}</script>\n<script>\n{read("src/app.js")}</script>\n'
    return doc(d['copy']['title'], d['copy']['desc'], d['meta']['og'], body, preview)


def date_range(cards):
    ds = sorted({c['asOf'] for c in cards})
    def lab(s):
        y, m, dd = s.split('-')
        return MONTHS[int(m) - 1], int(dd), y
    a, b = lab(ds[0]), lab(ds[-1])
    if a == b:
        return f'{a[0]} {a[1]}, {a[2]}'
    if a[0] == b[0] and a[2] == b[2]:
        return f'{a[0]} {a[1]}–{b[1]}, {a[2]}'
    return f'{a[0]} {a[1]} – {b[0]} {b[1]}, {b[2]}'


def hub_page(cards, preview=False):
    musk = family('musk')
    redirects = {p['id']: 'musk/' for p in musk['people']}  # old deep links from when the Musk file was the home page
    data = dict(asOfLabel=date_range(cards), repo=musk['meta']['repo'], families=cards, cats=CATEGORIES,
                redirects=redirects, cases=musk['cases'])
    body = read('src/hub.html').replace('{{HUBDATA}}', blob(data)).replace('{{COUNT}}', str(len(cards)))
    return doc('The Money Files', f'Follow the money: interactive, fully sourced maps of {len(cards)} of the richest and most famous families on Earth. '
               'Who owns what, which stocks you can buy, the homes, and the receipts.', 'assets/og-hub.jpg', body, preview)


def sources_md(fams):
    names = {'family': 'The family', 'money': 'The money', 'record': 'On the record', 'homes': 'The homes'}
    out = ['# Sources', '', 'Every numbered source on the site. Each family page numbers its own sources; '
           'the numbers below match the little blue links on that page.', '']
    for slug, title, _, _ in fams:
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
        if d['photos']:
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
    fams = live_families()
    cards = [card(*f) for f in fams]
    if preview:
        write('dist/preview-hub.html', hub_page(cards, True))
        for slug, *_ in fams:
            write(f'dist/preview-{slug}.html', family_page(slug, cards, True))
    else:
        write('index.html', hub_page(cards))
        for slug, *_ in fams:
            write(f'{slug}/index.html', family_page(slug, cards))
        write('SOURCES.md', sources_md(fams))
