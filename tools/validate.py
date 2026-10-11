"""Check a family data file before it goes on the site.

    python3 tools/validate.py data/<slug>-family.json [...]

Prints problems and exits non-zero if any are found.
"""
import json, re, sys

COPY_KEYS = ['title', 'desc', 'eyebrow', 'h1', 'lede', 'worthLabel', 'worthBig', 'familyLede', 'investLede', 'moneyTitle',
             'moneyLede', 'recordLede', 'trailLede', 'calcYearsK', 'footLabel']
HOME_KEYS = ['homesTitle', 'homesLede', 'homesFlipLabel', 'homesChart']
GROUPS = {'family', 'money', 'record', 'homes'}
STATUS = {'public', 'private', 'absorbed', 'nostake', 'gone'}
ADDRESS = re.compile(r'\b\d{2,5}\s+[A-Z][a-z]+\s+(Street|St\.|Avenue|Ave\.|Road|Rd\.|Drive|Dr\.|Lane|Ln\.|Boulevard|Blvd\.|Way|Court|Ct\.)\b')


def check(path):
    errs = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        return [f'not valid JSON: {e}']

    def need(obj, key, where):
        if key not in obj or obj[key] in (None, '', [], {}):
            errs.append(f'missing {where}.{key}')

    for k in ('meta', 'copy', 'tree', 'sources', 'people', 'photos', 'licenses'):
        if k not in d:
            errs.append(f'missing top-level "{k}"')
    if errs:
        return errs
    for k in ('asOf', 'asOfLabel', 'file', 'repo', 'center', 'slug', 'og'):
        need(d['meta'], k, 'meta')
    if d['meta'].get('pronoun') not in ('his', 'her'):
        errs.append('meta.pronoun must be "his" or "her"')
    for k in COPY_KEYS + (HOME_KEYS if d.get('homes') else []):
        need(d['copy'], k, 'copy')
    ids = set()
    for s in d['sources']:
        for k in ('id', 'group', 'pub', 'title', 'date', 'url'):
            need(s, k, f"source {s.get('id')}")
        if s.get('group') not in GROUPS:
            errs.append(f"source {s.get('id')}: group must be one of {sorted(GROUPS)}")
        if not str(s.get('url', '')).startswith('http'):
            errs.append(f"source {s.get('id')}: url must be a full http(s) link")
        if s.get('id') in ids:
            errs.append(f"duplicate source id {s.get('id')}")
        ids.add(s.get('id'))
    used = set()

    def walk(o, where):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('src', 'kidsSrc', 'bornSrc'):
                    if not isinstance(v, list) or not v:
                        errs.append(f'{where}.{k} must be a non-empty list of source ids')
                        continue
                    for i in v:
                        if i not in ids:
                            errs.append(f'{where}: unknown source id "{i}"')
                        used.add(i)
                elif isinstance(v, str) and ADDRESS.search(v):
                    errs.append(f'{where}.{k}: looks like a street address: "{ADDRESS.search(v).group(0)}"')
                else:
                    walk(v, f'{where}.{k}')
        elif isinstance(o, list):
            for n, v in enumerate(o):
                walk(v, f'{where}[{n}]')
    walk({k: v for k, v in d.items() if k != 'sources'}, 'data')
    for s in d['sources']:
        if s['id'] not in used:
            errs.append(f"source {s['id']} is never cited (cite it or remove it)")
    people = {p.get('id'): p for p in d['people']}
    if d['meta'].get('center') not in people:
        errs.append('meta.center must be a person id')
    cos = {c['id'] for c in d.get('companies', []) + d.get('companiesExtra', [])}
    for c in d.get('companies', []) + d.get('companiesExtra', []):
        if c.get('status') not in STATUS:
            errs.append(f"company {c.get('id')}: status must be one of {sorted(STATUS)}")
        if c.get('status') == 'public' and not (c.get('ticker') and c.get('exchange')):
            errs.append(f"company {c.get('id')}: public companies need ticker and exchange")
    groups = {g[0] for g in d['tree'].get('groups', [])}
    rows = {}
    for p in d['people']:
        pid = p.get('id', '?')
        for k in ('id', 'name', 'short', 'rel', 'group', 'layout', 'summary'):
            need(p, k, f'person {pid}')
        if len(p.get('rel', '')) > 36 and not p.get('connector'):
            errs.append(f'person {pid}: rel is {len(p["rel"])} characters; keep it to 36 or fewer')
        if len(p.get('tag') or '') > 24:
            errs.append(f'person {pid}: tag is {len(p["tag"])} characters; keep it to 24 or fewer')
        if p.get('group') not in groups:
            errs.append(f'person {pid}: group "{p.get("group")}" is not in tree.groups')
        L = p.get('layout') or {}
        if L.get('row') not in (0, 1, 2, 3):
            errs.append(f'person {pid}: layout.row must be 0-3')
        rows.setdefault(L.get('row'), []).append(L.get('partner'))
        if p.get('photo') and p['photo'] not in d['photos']:
            errs.append(f'person {pid}: photo key not in photos')
        for o in p.get('owns', []):
            if o.get('co') not in cos:
                errs.append(f'person {pid}: owns unknown company "{o.get("co")}"')
        w = p.get('worth')
        if w and not (w.get('value') or w.get('none')):
            errs.append(f'person {pid}: worth needs value+by+date+src, or none')
        for k in p.get('kids') or []:
            if set(k) - {'name', 'note'}:
                errs.append(f'person {pid}: kids entries may only have name and note')
    for r, parts in rows.items():
        cap = 5 if any(parts) else 6
        if len(parts) > cap:
            errs.append(f'row {r} has {len(parts)} nodes; max {cap} (5 if the row has partner cards)')
    for c in d['tree'].get('couples', []):
        for i in c[:2]:
            if i not in people:
                errs.append(f'tree.couples: unknown id {i}')
        if all(i in people for i in c[:2]):
            a, b = people[c[0]], people[c[1]]
            if a['layout'].get('row') != b['layout'].get('row'):
                errs.append(f'tree.couples {c[:2]}: both must be in the same row')
            else:
                rowp = [p for p in d['people'] if p['layout'].get('row') == a['layout'].get('row')]
                if all('x' in p['layout'] for p in rowp):
                    rowp.sort(key=lambda p: p['layout']['x'])
                row = [p['id'] for p in rowp]
                if row.index(c[1]) != row.index(c[0]) + 1:
                    errs.append(f'tree.couples {c[:2]}: list them next to each other (left one first) in people order')
    for f in d['tree'].get('forks', []):
        for i in ([f.get('frm')] if isinstance(f.get('frm'), str) else f.get('frm', [])) + f.get('kids', []):
            if i not in people:
                errs.append(f'tree.forks: unknown id {i}')
        if isinstance(f.get('frm'), list) and f['frm'] not in [c[:2] for c in d['tree'].get('couples', [])]:
            errs.append(f'tree.forks: {f["frm"]} is not a couple in tree.couples')
    for i in d['tree'].get('coParents', []):
        if i not in people:
            errs.append(f'tree.coParents: unknown id {i}')
    if d.get('ladder'):
        for it in d['ladder']['items']:
            if not isinstance(it.get('v'), (int, float)):
                errs.append('ladder items need numeric v')
    if d.get('calc') and not isinstance(d['calc'].get('worth'), (int, float)):
        errs.append('calc.worth must be a number')
    for h in (d.get('homes') or {}).get('props', []):
        if not isinstance(h.get('b'), (int, float)):
            errs.append(f"home {h.get('name')}: b (price in $M) must be a number")
    return errs


if __name__ == '__main__':
    bad = 0
    for path in sys.argv[1:]:
        e = check(path)
        print(f"{path}: {'OK' if not e else str(len(e)) + ' problem(s)'}")
        for x in e:
            print('  -', x)
        bad += bool(e)
    sys.exit(1 if bad else 0)
