import os
import re
from pathlib import Path

root = Path(__file__).resolve().parent
pat = re.compile(r'next/document|from\s+["\']next/document["\']|<Html|Html\s*,\s*Head', re.I)
exclude = {'.next', 'node_modules', '.git'}
hits = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude]
    for filename in filenames:
        if not filename.lower().endswith(('.ts', '.tsx', '.js', '.jsx')):
            continue
        p = Path(dirpath) / filename
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue
        if pat.search(text):
            hits.append(str(p.relative_to(root)))

print('\n'.join(sorted(hits)) if hits else 'NO_MATCHES')
