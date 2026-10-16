#!/usr/bin/env python3
"""Reassemble official vendor archive, verify every part and full SHA256, extract without install scripts."""
import argparse,hashlib,json,platform,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--arch',choices=['amd64','arm64']);p.add_argument('--dest',default=str(ROOT/'runtime'));p.add_argument('--verify-only',action='store_true');a=p.parse_args()
 arch=a.arch or {'x86_64':'amd64','aarch64':'arm64','arm64':'arm64'}.get(platform.machine())
 if not arch:raise SystemExit('Unsupported architecture')
 m=json.loads((ROOT/'resources/manifest.json').read_text())['packages'][arch];cache=ROOT/'.runtime-cache';cache.mkdir(exist_ok=True);target=cache/m['filename'];total=hashlib.sha256()
 with target.open('wb') as out:
  for item in m['parts']:
   path=ROOT/'resources'/arch/item['name'];h=hashlib.sha256()
   with path.open('rb') as f:
    while True:
     b=f.read(1024*1024)
     if not b:break
     h.update(b);total.update(b);out.write(b)
   if h.hexdigest()!=item['sha256']:target.unlink(missing_ok=True);raise SystemExit('Part integrity failure: '+item['name'])
 if total.hexdigest()!=m['sha256']:target.unlink(missing_ok=True);raise SystemExit('Package integrity failure')
 print('Verified official package:',m['filename'],flush=True)
 if not a.verify_only:
  dest=Path(a.dest).resolve();dest.mkdir(parents=True,exist_ok=True)
  subprocess.run(['dpkg-deb','-x',str(target),str(dest)],check=True)
  print('Extracted; vendor installation scripts NOT executed:',dest)
if __name__=='__main__':main()
