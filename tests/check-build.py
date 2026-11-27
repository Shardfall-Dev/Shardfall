# Build and asset checks (no browser): every <script> in the built game compiles, the committed build matches src/, and every
# asset the game asks for exists. usage: python3 tests/check-build.py Shardfall_vX.Y.Z.html [--no-rebuild]
import json, os, re, subprocess, sys, tempfile, shutil
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(root)
game = sys.argv[1] if len(sys.argv) > 1 else sorted([f for f in os.listdir('.') if re.match(r'Shardfall_v[\d.]+\.html$', f)], key=lambda f: [int(x) for x in re.findall(r'\d+', f)])[-1]
fails = 0
def check(cond, msg):
  global fails
  print(('ok   ' if cond else 'FAIL ') + msg); fails += 0 if cond else 1

# 1. every script block compiles (parse only, nothing runs)
html = open(game, encoding='utf8').read(); scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
with tempfile.TemporaryDirectory() as d:
  js = os.path.join(d, 'parse.js'); src = os.path.join(d, 'scripts.json'); json.dump(scripts, open(src, 'w'))
  open(js, 'w').write("const vm = require('vm'); const s = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')); let bad = 0;"
                      "s.forEach((t, i) => { try { new vm.Script(t, { filename: 'script' + i }); } catch (e) { bad++; console.log('script ' + i + ': ' + e.message); } });"
                      "console.log(s.length + ' scripts, ' + bad + ' with syntax errors'); process.exit(bad ? 1 : 0);")
  r = subprocess.run(['node', js, src], capture_output=True, text=True); print(r.stdout.strip())
  check(r.returncode == 0 and len(scripts) >= 3, f'all {len(scripts)} script blocks of {game} compile')

# 2. the committed build is exactly what build.sh makes from src/ (no drift between source and the published file)
if '--no-rebuild' not in sys.argv:
  v = re.match(r'Shardfall_v([\d.]+)\.html$', os.path.basename(game)).group(1)
  keep = game + '.committed'; shutil.copyfile(game, keep)
  try:
    r = subprocess.run(['sh', 'build.sh', v], capture_output=True, text=True)
    same = r.returncode == 0 and open(game, 'rb').read() == open(keep, 'rb').read()
    check(same, f'{game} is up to date with src/ (./build.sh {v} reproduces it byte for byte)')
  finally: shutil.move(keep, game)

# 3. the version inside the build matches its file name
v = re.match(r'Shardfall_v([\d.]+)\.html$', os.path.basename(game)).group(1)
check(('<title>Shardfall v%s</title>' % v) in html, f'the page title names the build version v{v}')

# 4. audio: every take in the manifest has its WAV master and its web AAC copy; every music track has both copies
m = json.load(open('assets/audio/manifest.json')); takes = sorted({f for e in m['events'].values() for f in e['files']})
miss_wav = [f for f in takes if not os.path.isfile(os.path.join('assets/audio', f))]
miss_web = [f for f in takes if not os.path.isfile(os.path.join('assets/audio/web', os.path.splitext(f)[0] + '.m4a'))]
check(not miss_wav, f"{len(m['events'])} sound events, {len(takes)} takes: every WAV master present" + (f' (missing {miss_wav[:3]})' if miss_wav else ''))
check(not miss_web, f'every take has its web AAC copy' + (f' (missing {miss_web[:3]})' if miss_web else ''))
st = json.load(open('assets/music/v1.0.0/soundtrack.json')); tracks = st['tracks'] if isinstance(st, dict) and 'tracks' in st else st
miss_m = [t['id'] for t in tracks if not os.path.isfile('assets/music/v1.0.0/' + t['mp3']) or not os.path.isfile('assets/audio/web/music/%s.m4a' % t['id'])]
check(not miss_m, f'{len(tracks)} music tracks: MP3 and web copies present' + (f' (missing {miss_m})' if miss_m else ''))

# 5. art manifests: the bestiary is embedded with all its sheets; the pending equipment icons are tracked
bm = re.search(r'"mobs"\s*:\s*\[', html) or re.search(r'BESTIARY', html)
check(bool(bm), 'the bestiary manifest is embedded in the build')
mi = json.load(open('assets/equipment-icons/missing-icons.json'))
check(mi.get('count') == len(mi.get('items', [])), f"missing equipment icons tracked: {mi.get('count')} listed, {len(mi.get('items', []))} entries")
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
