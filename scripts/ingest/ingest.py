# Adds Learning English episodes to static/data (audio, transcript, manifest).
# Stages, run in order from the project root:
#   python3 scripts/ingest/ingest.py sitemaps           # slugged article list from the sitemaps
#   python3 scripts/ingest/ingest.py crawl 400          # parse the newest N candidates, staged in .cache/stage
#   python3 scripts/ingest/ingest.py select 100         # pick the newest N usable items not yet in the manifest
#   python3 scripts/ingest/ingest.py build              # write transcripts, download audio, append manifest
# Afterwards run `npm run align` and `npm run dict`. Only stdlib + curl (no custom User-Agent: the site returns 406).
# shortcut: article IDs only resolve with their slug (ID-only URLs return an empty shell); pages from
# March 2025 onward stay empty, so the crawl only finds older items. Upgrade the slug source if the site changes.
import gzip, html, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'static', 'data')
CACHE = os.path.join(ROOT, 'scripts', 'ingest', '.cache')
BATCH = 'learning-english-2025'
BASE = 'https://learningenglish.voanews.com'


def curl(url, out=None):
    args = ['curl', '-sL', '-m', '300']
    if out:
        return subprocess.run(args + ['-o', out, url], check=True)
    return subprocess.run(args + [url], capture_output=True).stdout.decode('utf-8', 'replace')


def clean(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t))).strip()


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def sitemaps():
    # The sitemap index lists four article sitemaps. Only the slugged /a/<slug>/<id>.html entries are readable.
    os.makedirs(CACHE, exist_ok=True)
    rows = []
    for n in range(1, 5):
        url = f'{BASE}/sitemap_428_{n}.xml.gz'
        xml = gzip.decompress(subprocess.run(['curl', '-sL', '-m', '300', url], capture_output=True).stdout).decode()
        for m in re.finditer(r'<url>(.*?)</url>', xml, re.S):
            loc = re.search(r'<loc>([^<]+)', m.group(1)).group(1)
            lm = re.search(r'<lastmod>([^<]+)', m.group(1))
            s = re.search(r'/a/([^/]+)/(\d+)\.html$', loc)
            if s and lm:
                rows.append([lm.group(1)[:10], s.group(2), loc])
    rows.sort(reverse=True)
    json.dump(rows, open(f'{CACHE}/slugged.json', 'w'))
    print('slugged articles', len(rows))


def parse(loc, lastmod, id_):
    page = curl(loc)
    title = re.search(r'og:title"?\s*content="([^"]+)"|content="([^"]+)" property="og:title"', page)
    date = re.search(r'<time[^>]*datetime="(\d{4}-\d\d-\d\d)', page)
    cats = [clean(x) for x in re.findall(r'<span class="article-categories__text">(.*?)</span>', page, re.S)]
    mp3 = re.search(r'https://voa-audio\.voanews\.eu/[^"&\s]+?\.mp3(?=[&"\s])', page)
    paras = []
    k = page.find('class="wsw">')
    if k >= 0:
        end = page.find('link-content-sharing', k)
        seg = page[k: end if end > 0 else k + 200000]
        for p in re.findall(r'<p[^>]*>(.*?)</p>', seg, re.S):
            c = clean(p)
            if c and 'No media source' not in c:
                paras.append(c)
    t = title.group(1) or title.group(2) if title else ''
    return dict(id=id_, lastmod=lastmod, url=loc, title=clean(t), date=date.group(1) if date else '',
                section=cats[1] if len(cats) > 1 else '', mp3=mp3.group(0) if mp3 else '', paras=paras)


def crawl(n):
    rows = json.load(open(f'{CACHE}/slugged.json'))
    have = {str(e['id']) for e in json.load(open(f'{DATA}/episodes.json'))}
    cands = [(d, i, loc) for d, i, loc in rows if d >= '2024-01-01' and i not in have][:n]
    os.makedirs(f'{CACHE}/stage', exist_ok=True)
    with ThreadPoolExecutor(6) as ex:
        recs = list(ex.map(lambda c: parse(c[2], c[0], c[1]), cands))
    for r in recs:
        json.dump(r, open(f"{CACHE}/stage/{r['id']}.json", 'w'), ensure_ascii=False, indent=1)
    print('usable', sum(1 for r in recs if r['paras'] and r['mp3'] and r['date'] and r['section']), 'of', len(recs))


def select(n):
    have = {str(e['id']) for e in json.load(open(f'{DATA}/episodes.json'))}
    recs = [json.load(open(f'{CACHE}/stage/{x}')) for x in os.listdir(f'{CACHE}/stage')]
    ok = [r for r in recs if r['paras'] and r['mp3'] and r['date'] and r['section'] and r['id'] not in have]
    ok.sort(key=lambda r: (r['date'], r['id']), reverse=True)
    json.dump(ok[:n], open(f'{CACHE}/selected.json', 'w'), ensure_ascii=False, indent=1)
    print('selected', min(n, len(ok)), 'of', len(ok))


def build():
    sel = json.load(open(f'{CACHE}/selected.json'))
    entries = []
    for r in sel:
        sec = slugify(r['section'])
        base = f"{r['id']}-{r['date']}"
        entries.append(dict(batch=BATCH, section=sec, id=r['id'], title=r['title'], date=r['date'],
                            story_url=r['url'], transcript_file=f'data/transcripts/{sec}/{base}.txt',
                            transcript_source=r['url'], audio_file=f'data/audio/{sec}/{base}.mp3',
                            audio_source=r['mp3']))
        for d in (f'{DATA}/audio/{sec}', f'{DATA}/transcripts/{sec}'):
            os.makedirs(d, exist_ok=True)
        open(f"{DATA}/{entries[-1]['transcript_file'][5:]}", 'w', encoding='utf-8').write(
            r['title'] + '\n\n' + '\n\n'.join(r['paras']) + '\n')
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda e: curl(e['audio_source'], f"{DATA}/{e['audio_file'][5:]}"), entries))
    man = json.load(open(f'{DATA}/episodes.json'))
    man += entries
    json.dump(man, open(f'{DATA}/episodes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(f'{DATA}/episodes.json', 'a').write('\n')
    print('added', len(entries), 'manifest', len(man), '- now run: npx prettier --write static/data/episodes.json; npm run align; npm run dict')


if __name__ == '__main__':
    cmd = sys.argv[1]
    arg = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    {'sitemaps': sitemaps, 'crawl': lambda: crawl(arg), 'select': lambda: select(arg), 'build': build}[cmd]()
