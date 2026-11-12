# Crea i due pacchetti per Plesk in aldo-prestera/deploy/:
#   aldo-prestera-sito.zip  -> app Node del sito (dist + package.json), da estrarre nella cartella dell'app sito
#   ordini-api.zip          -> app Node dell'API (sorgenti + prisma), da estrarre nella cartella dell'app API
# Prima esegui `npm run build` nel sito. Nessun .env, nessun node_modules: si installano sul server.
import os, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITO = os.path.join(ROOT, 'aldo-prestera')
API = os.path.join(ROOT, 'ordini-api')
OUT = os.path.join(SITO, 'deploy')
SKIP = {'node_modules', 'generated', '.env', 'dist-old'}

def pack(nome, base, voci):
    if not os.path.isdir(OUT): os.makedirs(OUT)
    path = os.path.join(OUT, nome)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for v in voci:
            p = os.path.join(base, v)
            if os.path.isdir(p):
                for d, dirs, files in os.walk(p):
                    dirs[:] = [x for x in dirs if x not in SKIP]
                    for f in sorted(files):
                        if f.startswith('.env') and f != '.env.example': continue
                        fp = os.path.join(d, f)
                        z.write(fp, os.path.relpath(fp, base).replace(os.sep, '/'))
            else:
                z.write(p, v)
    z = zipfile.ZipFile(path)
    n = z.namelist()
    print(nome, '| voci:', len(n), '| integrità:', z.testzip() or 'ok', '| MB:', round(os.path.getsize(path) / 1e6, 2),
          '| backslash:', sum(chr(92) in x for x in n), '| radice:', sorted({x.split('/')[0] for x in n}))

if not os.path.exists(os.path.join(SITO, 'dist', 'server', 'entry.mjs')):
    raise SystemExit('dist/server mancante: esegui prima npm run build nel sito')
pack('aldo-prestera-sito.zip', SITO, ['dist', 'app.cjs', 'package.json', 'package-lock.json', '.env.example'])
pack('ordini-api.zip', API, ['src', 'prisma', 'scripts', 'app.cjs', 'prisma.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', '.env.example'])
