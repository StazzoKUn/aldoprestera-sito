# Crea deploy/aldo-prestera-sito.zip: solo il sito statico (contenuto di dist/client), da estrarre in httpdocs.
# Prima esegui: npm run build
import os, zipfile
src = 'dist/client'
out = 'deploy/aldo-prestera-sito.zip'
if not os.path.exists(os.path.join(src, 'index.html')):
    raise SystemExit('dist/client mancante: esegui prima npm run build')
os.makedirs('deploy', exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, src).replace(os.sep, '/'))
z = zipfile.ZipFile(out)
names = z.namelist()
raw = open(out, 'rb').read()
print('voci:', len(names), '| integrità:', z.testzip() or 'ok', '| MB:', round(len(raw) / 1e6, 2))
print('backslash nei percorsi:', raw.count(bytes([92]) + b'client') + sum(bytes([92]) in n.encode() for n in names))
print('radice:', sorted({n.split('/')[0] for n in names}))
