import json, sys
# usage: journey_table.py <prefix-before> [<prefix-after>]  (files <prefix>-<account>.json)
pre = sys.argv[1]; post = sys.argv[2] if len(sys.argv) > 2 else None
accts = ["new", "occasional", "established"]
def load(p, a):
    try: return {r["id"]: r for r in json.load(open(f"{p}-{a}.json"))}
    except FileNotFoundError: return {}
B = {a: load(pre, a) for a in accts}; A = {a: load(post, a) for a in accts} if post else None
ids = sorted({i for a in accts for i in B[a]})
def cell(r):
    if not r: return "—"
    s = f"{r['interactions']} ({r['taps']}t{'+'+str(r['fields'])+'f' if r['fields'] else ''}), {r['scrolls']} scr"
    if not r["ok"]: s = "FAILED: " + r["note"][:40]
    elif r["note"].startswith("BLOCKED") or "no Start button" in r["note"]: s += " — blocked"
    return s
print("| Task | Target | " + " | ".join(f"{a} before" + (f" | {a} after" if A else "") for a in accts) + " |")
print("|---|---|" + "---|" * (len(accts) * (2 if A else 1)))
for i in ids:
    r0 = next(B[a][i] for a in accts if i in B[a])
    row = [r0["title"], r0["target"]]
    for a in accts:
        row.append(cell(B[a].get(i)))
        if A: row.append(cell(A[a].get(i)))
    print("| " + " | ".join(row) + " |")
