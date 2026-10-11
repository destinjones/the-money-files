# How to write a family file

Each family on the site is one JSON file: `data/<slug>-family.json`. The page is built from it, so the file must follow this shape exactly. **Read `data/bezos-family.json` first**: it's a complete, working example. Copy its structure.

Check your file with `python3 tools/validate.py data/<slug>-family.json` and fix every problem until it prints OK.

## Top level

| key | what |
|---|---|
| `meta` | `{"asOf": "2026-10-10", "asOfLabel": "Oct 10, 2026", "file": "File #0NN", "repo": "https://github.com/destinjones/the-money-files", "center": "<person id>", "slug": "<slug>", "og": "assets/og-hub.jpg", "pronoun": "his"}`. `asOf` is the date of the net worth figures you used. `pronoun` is the center's possessive pronoun, `"his"` or `"her"`; the page uses it in lines like "before her fortune runs out". |
| `copy` | Page text (below). |
| `tree` | How the family tree is drawn (below). |
| `sources` | Every source, each cited at least once: `{"id", "group": "family"\|"money"\|"record"\|"homes", "pub", "title", "date", "url"}`. Aim for 15-30. |
| `people` | 6-10 people (below). |
| `photos` | Leave as `{}`. Photos are filled in centrally from each person's `wiki` title. |
| `licenses` | Copy from the Bezos file. |
| `companies` | 2-6 companies for the "Can you buy it?" grid (below). |
| `companiesExtra` | Smaller companies referenced in `owns` but not shown in the grid: `{"id", "name", "status", "who"}`. Can be `[]`. |
| `ladder` | Published net worths only (Forbes/Bloomberg), biggest first: `{"items": [{"name", "short", "v": 374500000000, "label": "$374.5B", "src": [...]}], "rest": "Everyone else on the map"}`. Omit if nobody has one. |
| `calc` | `{"worth": <number>, "compareK", "compareS", "compareV"}`: the center's fortune, plus an optional comparison with the second ladder entry. |
| `homes` | Optional (below). |
| `ledger` | 5-10 rows of money on the public record: `{"who", "what", "amt", "when", "src"}`. Filings, court records, disclosures, deals. |
| `trail` | 8-14 timeline items, oldest first: `{"when", "h", "amt"?, "t", "src"}` (`t` may be `""`). |

## People

```json
{"id": "jeff", "name": "Jeff Bezos", "short": "Jeff", "rel": "The center of the map", "tag": "$374.5B", "tagKind": "money",
 "born": "Born 1964", "bornSrc": ["..."], "group": "center", "layout": {"row": 2, "big": true}, "photo": null,
 "wiki": "Jeff Bezos",
 "summary": {"t": "...", "src": ["..."]},
 "worth": {"value": "$374.5 billion", "by": "Forbes real-time estimate", "date": "Oct 6, 2026", "src": ["..."]},
 "owns": [{"co": "amazon", "t": "...", "src": ["..."]}],
 "record": [{"h": "Heading", "t": "...", "src": ["..."]}],
 "facts": [{"t": "...", "src": ["..."]}]}
```

- `id`: lowercase, no spaces. `short`: first name. `rel`: relation to the center, short ("Mother", "Ex-wife · 1993–2019"), **at most 36 characters** so it fits on the card.
- `tag`: a short chip, **at most 24 characters**. Use a money tag (`"$27.5B"` with `"tagKind": "money"`) only when Forbes or Bloomberg publishes that person's net worth; otherwise a role word ("Author", "Neuralink").
- `worth`: either a published estimate (`value`, `by`, `date`, `src`) or `{"none": "No reliable public estimate."}`.
- `wiki`: the exact English Wikipedia article title for adults who are public figures, else `null`. **Never for minors.**
- Optional: `owns`, `record`, `facts`, `disputed` (`{"h","t","src"}`), `note` (plain text), `born` + `bornSrc`.
- Partner cards (`"layout": {"row": 3, "partner": true}`) can carry the center's children with that partner: `"kids": [{"name": "..."}]` (add `"note"` only for something like "died in infancy"), or `"kidsText": "4 children · names private"` when names aren't public. Add `"kidsSrc"`. Use `"kidsLabel": "Her children"` when the kids aren't the center's.
- The center person may have `"kidsNote": {"t", "src"}`: one sentence under the tree about the children.
- `"connector": true` makes a non-clickable node (for a private person needed only to connect the tree; give no name, e.g. `"name": "Maye’s twin sister"`).

## Tree

```json
"tree": {"groups": [["center", "The center"], ["parents", "Parents"], ["siblings", "Siblings"], ["partners", "Partners & children", "Kids by name only."]],
         "order": ["jeff", "mackenzie", "..."],
         "coParents": ["mackenzie"],
         "couples": [["ted", "jackie", "m. 1963"], ["jackie", "mike", ""]],
         "forks": [{"frm": ["ted", "jackie"], "kids": ["jeff"]}, {"frm": "jeff", "kids": ["mackenzie", "lauren"], "toNodeTop": true}]}
```

- `layout.row`: 0 = grandparents (optional), 1 = parents, 2 = the center (with siblings and/or spouse), 3 = partner cards or adult children. **Max 6 nodes in a row (5 if the row has partner cards).** Don't set `layout.x`; positions are automatic, left to right in `people` order within each row.
- The center gets `"big": true`.
- `couples`: two people in the same row who must be **next to each other in `people` order, left one first**. The label is short ("m. 1970–79") or `""`.
- `forks` draw parent-to-child lines: `frm` is one id or a couple pair from `couples`; `kids` are ids in a lower row. Use `"toNodeTop": true` when the kids are partner cards. It's fine to fork all children from the famous parent and name the other parent in each child's `rel`.
- `groups` is the phone layout, in display order (center first). Every person's `group` must be one of these keys.
- `coParents`: partner-card people whose `kids` are the center's children (shown in the center's file).

## Companies

```json
{"id": "amazon", "name": "Amazon", "status": "public", "ticker": "AMZN", "exchange": "Nasdaq",
 "quote": "https://www.nasdaq.com/market-activity/stocks/amzn", "color": "#FF9900",
 "who": "Jeff (founder, about 9%)", "t": "...", "src": ["..."]}
```

`status` is `public` (needs `ticker`, `exchange`, `quote`), `private`, `absorbed` (now part of another company; add `"into": "Tesla"` and the chip reads "Part of Tesla"), `nostake` (public but the family has no stake; chip reads "No family stake") or `gone`. Only list companies the family owns, runs or founded, or that are central to the money story; say plainly in `who` and `t` what the family's link is. Pick a `color` that suits the brand.

## Homes (optional)

```json
"homes": {"props": [{"name": "Former Warner estate", "area": "Beverly Hills, Los Angeles", "by": "2020", "b": 165, "note": "...", "src": ["..."]}],
          "summary": {"value": "≈$700M", "note": "...", "src": ["..."]},
          "extra": [{"t": "...", "src": ["..."]}]}
```

`b` is the purchase price in $ millions; add `"s"` (sale price) and `"sy"` (sale year) if sold. **City or neighborhood only, never a street address.** If you include homes, also write the copy keys `homesTitle`, `homesLede`, `homesFlipLabel`, `homesChart`.

## Copy

`title` ("The Gates Money File"), `desc`, `ledgerFoot` (optional: a footnote under the ledger, e.g. explaining a share class; the default is "“Our sum” means simple addition of the linked filings or reports."), `eyebrow` (`"<b>File #0NN</b> · The Gates family · Data as of <span data-asof></span>"`), `h1`, `lede`, `worthLabel` ("Bill Gates’s net worth"), `worthBig` (all digits: "$107,000,000,000"), `familyLede`, `investLede`, `moneyTitle`, `moneyLede`, `recordLede`, `trailLede`, `calcYearsK` ("Years to earn what Bill has"), `footLabel` ("File #0NN: the Gates family").

`h1` is the hook, in the video series' style: one `<span class="gold">…</span>` and one `<span class="u-red">…</span>`. Example: `The first <span class="gold">trillionaire</span> has a family. We followed the <span class="u-red">money</span>.`

Write plainly: short sentences, active voice, no hype words. Use "$27.5 billion" in sentences and "$27.5B" in tags and labels. Mark derived numbers "(our math)".

## Rules

- **Current as of Oct 10, 2026 (today).** Search for the latest. Net worth: the Forbes real-time profile (`https://www.forbes.com/profile/<name>/`) gives the figure and its "as of" date; search for "<name> Forbes profile" so the URL shows up in results, then WebFetch it.
- **Every claim cites a source you actually read.** Prefer primary records (SEC, company investor pages, court records, FEC/OGE/House disclosures) and major outlets (Reuters, AP, Bloomberg, Forbes, CNBC, WSJ, NYT, BBC, Fortune, Business Insider). Wikipedia is acceptable for family relationships when nothing better exists. Never use celebrity-net-worth sites.
- **Privacy:** no street addresses. Minors: first names only, no photos, ages, schools or other details. If a family keeps the kids' names private, use `kidsText` with a count. Leave out private relatives (or use an unnamed connector if the tree needs it). No medical details. No unproven allegations.
- **Neutral:** facts and filings, attributed. No opinions, no loaded adjectives. This matters most for political families.
- **Efficient:** every agent in this session shares one budget of 200 WebSearch calls, so use **at most 12 WebSearch calls per family** and prefer WebFetch.
- **How fetching works here:** WebFetch only opens URLs that already appeared in this session's search results (or that the user posted). A URL you type yourself (a guessed Forbes or SEC address) fails with `PROVENANCE_REQUIRED`. Don't retry it; run a search that surfaces the page, then fetch the URL from the results. Don't use the Firecrawl tools: that account is almost out of credits. The shell has no internet access.
