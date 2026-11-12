#!/usr/bin/env python3
"""Narrow Gate Fitness: subscription financial forecast (Pro All Access).

Standard library only. Run with:  python3 -I forecast.py
Prints Markdown tables. Every figure is an ESTIMATE unless its source says "verified".
Nothing here is a guarantee of revenue or profit.
"""

import math

# ---------------------------------------------------------------------------
# 0. Approved prices (fixed by the owner; not modelled as variables)
# ---------------------------------------------------------------------------
PRICE_MONTHLY = 19.99      # Pro All Access, per month
PRICE_ANNUAL = 149.99      # Pro All Access, per year (identical features)
ANNUAL_MRR = PRICE_ANNUAL / 12

# AI allowance per Pro member per month (from the brief, matches src/lib/domain/plans.ts limits)
ALLOWANCE = 150
PLAN_LIMIT = 15
SMART_LIMIT = 15
PLAN_RESERVE = 5           # src/lib/coach/routing.ts: complex chat stops escalating 5 early

# ---------------------------------------------------------------------------
# 1. Third-party prices (see FORECAST.md for source URLs and access dates, 2026-10-26)
# ---------------------------------------------------------------------------
# Anthropic API, USD per million tokens (VERIFIED: platform.claude.com/docs/en/about-claude/pricing)
API = {
    "fast": {"model": "claude-haiku-5-5", "in": 0.10, "cw5": 0.125, "cr": 0.01, "out": 0.50},   # prompts <= 100k tokens
    "smart": {"model": "claude-sonnet-5-5", "in": 2.00, "cw5": 2.50, "cr": 0.10, "out": 10.00},
}
TOOL_USE_SYSTEM_TOKENS = 286   # VERIFIED (pricing page, tool use system prompt, auto/none) for both models

APPLE_SBP = 0.15               # VERIFIED: App Store Small Business Program
APPLE_STD_Y1 = 0.30            # VERIFIED: auto-renewable subs, first year of paid service
APPLE_STD_Y2 = 0.15            # VERIFIED: after one year of paid service
GOOGLE = 0.15                  # Search-verified: 10% service fee + 5% Play Billing fee (US/UK/EEA from 2026-06-30) = 15%
STRIPE_PCT = 0.029             # Search-verified (stripe.com/pricing not reachable from this environment)
STRIPE_FIXED = 0.30
STRIPE_BILLING = 0.007         # Stripe Billing pay-as-you-go, % of billing volume (search-verified)
STRIPE_INTL = 0.015            # + international card
STRIPE_FX = 0.01               # + currency conversion
WEB_INTL_SHARE = 0.10          # ASSUMPTION: share of web payments on non-US cards
WEB_FX_SHARE = 0.05            # ASSUMPTION: share of web payments needing conversion
RC_FREE_MTR = 2500.0           # RevenueCat: free up to $2,500 monthly tracked revenue (search-verified)
RC_PCT = 0.01                  # then 1% of all tracked revenue

# ---------------------------------------------------------------------------
# 2. Business assumptions (ALL ESTIMATES; change here)
# ---------------------------------------------------------------------------
CHANNELS = {"iOS": 0.60, "Android": 0.25, "Web": 0.15}   # ASSUMPTION
PLAN_MIXES = {"70/30": 0.70, "50/50": 0.50}             # share on the monthly plan
REFUND_RATE = 0.02            # ASSUMPTION: share of gross revenue refunded
CHURN_MONTHLY = 0.08          # ASSUMPTION: monthly-plan churn per month
ANNUAL_RENEWAL = 0.60         # ASSUMPTION: annual-plan renewal rate
CACS = [20, 40, 80]           # ASSUMPTION: paid acquisition cost per new paying subscriber
HOSTING_VAR_PER_SUB = 0.10    # ESTIMATE: storage/egress/functions per paying sub per month (mostly within included quotas)


def hosting_fixed(n_subs):
    """ESTIMATE of fixed monthly infrastructure: Supabase Pro $25 + Vercel Pro 1 seat $20
    + Apple Developer Program $99/yr ($8.25/mo) + domain/email/misc $10, plus a guessed
    compute upgrade as the user base grows (free users included)."""
    base = 25 + 20 + 99 / 12 + 10
    if n_subs >= 1000:
        base += 50
    elif n_subs >= 500:
        base += 15
    return base


# Apple steady-state blend under the standard programme (30% in year 1, 15% after):
TENURED_MONTHLY = (1 - CHURN_MONTHLY) ** 12           # share of active monthly subs past 12 paid months
TENURED_ANNUAL = ANNUAL_RENEWAL                        # steady state: renewals / all active annual subs
APPLE_CASES = {
    "Apple SBP 15%": {"m": APPLE_SBP, "a": APPLE_SBP},
    "Apple std, launch yr 30%": {"m": APPLE_STD_Y1, "a": APPLE_STD_Y1},
    "Apple std, steady blend": {
        "m": APPLE_STD_Y1 * (1 - TENURED_MONTHLY) + APPLE_STD_Y2 * TENURED_MONTHLY,
        "a": APPLE_STD_Y1 * (1 - TENURED_ANNUAL) + APPLE_STD_Y2 * TENURED_ANNUAL,
    },
}

# ---------------------------------------------------------------------------
# 3. Token inventory, measured from the code (characters / 4 = tokens, ESTIMATE)
#    Measured on branch claude/free-pro-membership by evaluating the TypeScript modules.
# ---------------------------------------------------------------------------
CPT = 4.0
MEASURED_CHARS = {
    "COACH_STATIC_PROMPT (src/lib/coach/knowledge.ts)": 38292,
    "Tool definitions, 17 tools JSON (src/lib/coach/tools.ts)": 14818,
    "FAITH_ENABLED_INSTRUCTIONS (cached 2nd block)": 7945,
    "FAITH_DISABLED_INSTRUCTIONS": 245,
    "PRO_PLAN_NOTE": 116,
    "PLAN_INSTRUCTIONS (src/server/services/ai-coach.ts)": 991,
    "Exercise catalog, 157 exercises (plan mode)": 11530,
    "Plan output JSON schema": 1561,
    "FOOD_PHOTO_INSTRUCTIONS": 995,
    "Food photo output schema": 1661,
    "MEAL_PLAN_INSTRUCTIONS": 898,
    "Meal plan output schema": 918,
    "PRODUCT_EXPLAIN_INSTRUCTIONS": 1288,
    "Product explanation schema": 711,
}
T = {k: v / CPT for k, v in MEASURED_CHARS.items()}
STATIC = T["COACH_STATIC_PROMPT (src/lib/coach/knowledge.ts)"]
TOOLS = T["Tool definitions, 17 tools JSON (src/lib/coach/tools.ts)"]
FAITH_ON = T["FAITH_ENABLED_INSTRUCTIONS (cached 2nd block)"]
FAITH_OFF = T["FAITH_DISABLED_INSTRUCTIONS"]
PLAN_NOTE = T["PRO_PLAN_NOTE"]

# Food photo: compressed client-side to 1024 px long edge (FOOD_PHOTO_MAX_DIMENSION).
# Official formula for Claude 4.7+ models: ceil(w/28) * ceil(h/28) visual tokens.
def image_tokens(w, h):
    return math.ceil(w / 28) * math.ceil(h / 28)

IMG_TYPICAL = image_tokens(1024, 768)    # 4:3 phone photo
IMG_HEAVY = image_tokens(1024, 1024)     # square photo

# Request profiles (ESTIMATES; output includes adaptive thinking, effort "medium")
PROFILES = {
    "typical": {"context": 1500, "memory": 200, "history": 1500, "msg": 40, "tool_result": 600,
                "faith_share": 0.5, "warm_first": {"fast": 0.5, "smart": 0.0}},
    "heavy": {"context": 2500, "memory": 600, "history": 6000, "msg": 1000, "tool_result": 1500,
              "faith_share": 1.0, "warm_first": {"fast": 0.0, "smart": 0.0}},
}
# history cap: HISTORY_TOTAL_CHARS 24,000 -> 6,000 tokens; new message cap 4,000 chars -> 1,000 tokens
CHAT_SHAPE = {
    ("fast", "typical"): {"rounds": 2, "mid_out": 250, "final_out": 600},
    ("fast", "heavy"): {"rounds": 4, "mid_out": 1000, "final_out": 2500},
    ("smart", "typical"): {"rounds": 3, "mid_out": 500, "final_out": 1500},
    ("smart", "heavy"): {"rounds": 6, "mid_out": 2000, "final_out": 5000},   # MAX_TOOL_ROUNDS = 6
}
CHAT_MAX_TOKENS = 12000
PLAN_MAX_TOKENS = 16000


def usd(tier, tin=0.0, tcw=0.0, tcr=0.0, tout=0.0):
    p = API[tier]
    return (tin * p["in"] + tcw * p["cw5"] + tcr * p["cr"] + tout * p["out"]) / 1e6


def chat_cost(tier, prof_name, ceiling=False):
    """One coach chat turn = a tool loop of `rounds` API calls. Tools + static prompt (+ faith block)
    are behind cache_control (5-minute TTL); athlete context, memory and history are never cached."""
    pr = PROFILES[prof_name]
    sh = dict(CHAT_SHAPE[(tier, prof_name)])
    if ceiling:   # every round runs to max_tokens: theoretical upper bound only
        sh = {"rounds": 6, "mid_out": CHAT_MAX_TOKENS, "final_out": CHAT_MAX_TOKENS}
    prefix = STATIC + TOOLS + TOOL_USE_SYSTEM_TOKENS + pr["faith_share"] * FAITH_ON
    dyn = PLAN_NOTE + (1 - pr["faith_share"]) * FAITH_OFF + pr["context"] + pr["memory"] + 20
    base = dyn + pr["history"] + pr["msg"]
    warm = pr["warm_first"][tier]
    tin = tcw = tcr = tout = 0.0
    acc = 0.0
    for r in range(sh["rounds"]):
        last = r == sh["rounds"] - 1
        if r == 0:
            tcw += prefix * (1 - warm)
            tcr += prefix * warm
        else:
            tcr += prefix
        tin += base + acc
        out = sh["final_out"] if last else sh["mid_out"]
        tout += out
        acc += out + (0 if last else pr["tool_result"])
    total_in = tin + tcw + tcr
    return {"in": total_in, "out": tout, "calls": sh["rounds"], "usd": usd(tier, tin, tcw, tcr, tout)}


def plan_cost(prof_name, ceiling=False):
    """Plan generation: one Sonnet call, structured output, no tools (so its cached prefix is separate)."""
    pr = PROFILES[prof_name]
    prefix = STATIC + pr["faith_share"] * FAITH_ON
    dyn = PLAN_NOTE + (1 - pr["faith_share"]) * FAITH_OFF + pr["context"] + pr["memory"] + 20
    unc = (dyn + T["PLAN_INSTRUCTIONS (src/server/services/ai-coach.ts)"]
           + T["Exercise catalog, 157 exercises (plan mode)"] + T["Plan output JSON schema"]
           + pr["history"] + pr["msg"])
    out = PLAN_MAX_TOKENS if (ceiling or prof_name == "heavy") else 4000
    return {"in": prefix + unc, "out": out, "calls": 1, "usd": usd("smart", unc, prefix, 0, out)}


def photo_cost(prof_name, ceiling=False):
    img = IMG_HEAVY if prof_name == "heavy" else IMG_TYPICAL
    tin = T["FOOD_PHOTO_INSTRUCTIONS"] + T["Food photo output schema"] + img + (300 if prof_name == "heavy" else 20)
    out = 2000 if (ceiling or prof_name == "heavy") else 700
    return {"in": tin, "out": out, "calls": 1, "usd": usd("fast", tin, 0, 0, out)}


def meal_plan_cost(prof_name, ceiling=False):
    dishes = 150 if prof_name == "heavy" else 40       # eligible dishes (27 app recipes + member recipes)
    tin = T["MEAL_PLAN_INSTRUCTIONS"] + T["Meal plan output schema"] + 150 + dishes * 20 + (300 if prof_name == "heavy" else 0)
    out = 8000 if (ceiling or prof_name == "heavy") else 1500
    return {"in": tin, "out": out, "calls": 1, "usd": usd("fast", tin, 0, 0, out)}


def explain_cost(prof_name, ceiling=False):
    facts = 1500 if prof_name == "heavy" else 500       # compare focus adds 3 alternatives
    tin = T["PRODUCT_EXPLAIN_INSTRUCTIONS"] + T["Product explanation schema"] + facts + 120
    out = 1200 if (ceiling or prof_name == "heavy") else 500
    return {"in": tin, "out": out, "calls": 1, "usd": usd("fast", tin, 0, 0, out)}


FEATURES = {
    "chat_fast": ("Coach chat, quick (Haiku 5.5, tool loop)", lambda p, c=False: chat_cost("fast", p, c)),
    "chat_smart": ("Coach chat, complex (Sonnet 5.5, tool loop)", lambda p, c=False: chat_cost("smart", p, c)),
    "plan": ("AI plan generation (Sonnet 5.5)", plan_cost),
    "food_photo": ("Meal photo analysis (Haiku 5.5, 1 image)", photo_cost),
    "meal_plan": ("AI meal plan (Haiku 5.5)", meal_plan_cost),
    "food_explain": ("Food IQ 'Ask AI' explanation (Haiku 5.5)", explain_cost),
}

# Monthly usage mixes (requests). Every kind counts against the 150 allowance; Sonnet capped at 15.
MIX_FULL_REALISTIC = {"chat_fast": 100, "chat_smart": 10, "plan": 5, "food_photo": 15, "meal_plan": 5, "food_explain": 15}
MIX_FULL_WORST_A = {"chat_fast": 135, "chat_smart": SMART_LIMIT - PLAN_RESERVE, "plan": PLAN_RESERVE}
MIX_FULL_WORST_B = {"chat_fast": 135, "plan": PLAN_LIMIT}


def mix_cost(mix, prof, scale=1.0):
    return sum(FEATURES[k][1](prof)["usd"] * n * scale for k, n in mix.items())


def worst_full(prof):
    return max(mix_cost(MIX_FULL_WORST_A, prof), mix_cost(MIX_FULL_WORST_B, prof))


AI_LIGHT = mix_cost(MIX_FULL_REALISTIC, "typical", 0.2)
AI_TYPICAL = mix_cost(MIX_FULL_REALISTIC, "typical", 0.5)
AI_FULL = worst_full("typical")            # 150 requests, most expensive legal mix, typical-size requests
AI_STRESS = worst_full("heavy")            # 150 requests, near the code's caps
AI_LEVELS = {"AI typical": AI_TYPICAL, "AI full": AI_FULL}

# ---------------------------------------------------------------------------
# 4. Helpers
# ---------------------------------------------------------------------------

def md(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def m(x, d=2):
    s = f"{abs(x):,.{d}f}"
    return f"-${s}" if x < 0 else f"${s}"


def pct(x, d=1):
    return f"{x * 100:.{d}f}%"


def payment_fee(channel, amount, apple_rate):
    if channel == "iOS":
        return amount * apple_rate
    if channel == "Android":
        return amount * GOOGLE
    intl = WEB_INTL_SHARE * STRIPE_INTL + WEB_FX_SHARE * STRIPE_FX
    return amount * (STRIPE_PCT + STRIPE_BILLING + intl) + STRIPE_FIXED


def unit(channel, plan, apple_case, ai, rc_on=True):
    """Per active subscriber per month, MRR basis (annual normalised to /12)."""
    rate = APPLE_CASES[apple_case]["m" if plan == "monthly" else "a"]
    if plan == "monthly":
        gross = PRICE_MONTHLY
        fee = payment_fee(channel, PRICE_MONTHLY, rate)
    else:
        gross = ANNUAL_MRR
        fee = payment_fee(channel, PRICE_ANNUAL, rate) / 12
    rc = gross * RC_PCT if (rc_on and channel != "Web") else 0.0
    net = gross - fee - rc
    refunds = gross * REFUND_RATE
    contrib = net - refunds - ai - HOSTING_VAR_PER_SUB
    return {"gross": gross, "fee": fee, "rc": rc, "net": net, "refunds": refunds, "contrib": contrib}


def blended(monthly_share, apple_case, ai, rc_on=True):
    keys = ("gross", "fee", "rc", "net", "refunds", "contrib")
    tot = {k: 0.0 for k in keys}
    for ch, cs in CHANNELS.items():
        for plan, ps in (("monthly", monthly_share), ("annual", 1 - monthly_share)):
            u = unit(ch, plan, apple_case, ai, rc_on)
            for k in keys:
                tot[k] += u[k] * cs * ps
    return tot


def replacement_rate(monthly_share):
    """New subs needed per active sub per month to hold the base flat (steady state)."""
    return monthly_share * CHURN_MONTHLY + (1 - monthly_share) * (1 - ANNUAL_RENEWAL) / 12


# ---------------------------------------------------------------------------
# 5. Report sections
# ---------------------------------------------------------------------------

def section_api():
    print("## A. Anthropic API prices used (USD per million tokens, verified 2026-10-26)\n")
    rows = []
    for tier, p in API.items():
        rows.append([tier, p["model"], m(p["in"], 3), m(p["cw5"], 3), m(p["cr"], 3), m(p["out"], 2)])
    print(md(["Tier", "Model", "Input", "5-min cache write", "Cache read", "Output"], rows))
    print()


def section_tokens():
    print("## B. Prompt inventory measured from the code (characters / 4 = tokens, estimate)\n")
    rows = [[k, f"{v:,}", f"{v / CPT:,.0f}"] for k, v in MEASURED_CHARS.items()]
    rows.append(["Tool-use system prompt (API adds it)", "n/a", f"{TOOL_USE_SYSTEM_TOKENS}"])
    rows.append(["Meal photo, 1024x768 after compression (ceil(w/28)*ceil(h/28))", "n/a", f"{IMG_TYPICAL:,}"])
    rows.append(["Meal photo, 1024x1024 (worst case)", "n/a", f"{IMG_HEAVY:,}"])
    print(md(["Component", "Characters", "Tokens (est.)"], rows))
    cached = STATIC + TOOLS + TOOL_USE_SYSTEM_TOKENS
    print(f"\nCached chat prefix (tools + static prompt + tool system prompt): ~{cached:,.0f} tokens, "
          f"+{FAITH_ON:,.0f} if the faith section is on. Per-user context, memory and history are not cached.\n")


def section_requests():
    print("## C. Cost per AI request (estimates)\n")
    rows = []
    for key, (label, fn) in FEATURES.items():
        t = fn("typical")
        h = fn("heavy")
        c = fn("heavy", True)
        rows.append([label, t["calls"], f"{t['in']:,.0f}", f"{t['out']:,.0f}", m(t["usd"], 4),
                     h["calls"], f"{h['in']:,.0f}", f"{h['out']:,.0f}", m(h["usd"], 4), m(c["usd"], 3)])
    print(md(["Feature", "Calls (typ)", "Input tok (typ)", "Output tok (typ)", "Cost (typ)",
              "Calls (heavy)", "Input tok (heavy)", "Output tok (heavy)", "Cost (heavy)", "Ceiling*"], rows))
    print("\n*Ceiling: every call runs to its max_tokens cap (chat 12,000 x 6 rounds; plan 16,000; photo 2,000; "
          "meal plan 8,000; explain 1,200) with heavy inputs. Theoretical bound only, not expected.\n")


def section_ai_per_user():
    print("## D. AI cost per Pro member per month (estimates)\n")
    rows = [
        ["Light (20% = 30 requests)", "realistic mix x0.2", m(AI_LIGHT), pct(AI_LIGHT / PRICE_MONTHLY), pct(AI_LIGHT / ANNUAL_MRR)],
        ["Typical (50% = 75 requests)", "realistic mix x0.5", m(AI_TYPICAL), pct(AI_TYPICAL / PRICE_MONTHLY), pct(AI_TYPICAL / ANNUAL_MRR)],
        ["Full (100% = 150), realistic mix", "100 quick chats, 10 complex, 5 plans, 15 photos, 5 meal plans, 15 explains",
         m(mix_cost(MIX_FULL_REALISTIC, "typical")), pct(mix_cost(MIX_FULL_REALISTIC, "typical") / PRICE_MONTHLY),
         pct(mix_cost(MIX_FULL_REALISTIC, "typical") / ANNUAL_MRR)],
        ["**Full (100%), most expensive legal mix** (used as 'AI full')", "135 quick chats + 15 Sonnet (worst of 10 chats+5 plans / 15 plans)",
         m(AI_FULL), pct(AI_FULL / PRICE_MONTHLY), pct(AI_FULL / ANNUAL_MRR)],
        ["Stress: full + heavy requests near code caps", "same mix, long history, 4-6 tool rounds", m(AI_STRESS),
         pct(AI_STRESS / PRICE_MONTHLY), pct(AI_STRESS / ANNUAL_MRR)],
    ]
    print(md(["Usage level", "Mix", "AI cost / month", "% of $19.99", "% of $12.50 (annual/12)"], rows))
    print()


def section_unit():
    print("## E. Contribution per subscriber per month by channel (MRR basis, estimates)\n")
    print("Contribution = price - store/payment fee - RevenueCat 1% (mobile, once MTR > $2,500) - refunds 2% "
          f"- AI - variable hosting ${HOSTING_VAR_PER_SUB:.2f}. Excludes fixed costs and acquisition.\n")
    rows = []
    for plan in ("monthly", "annual"):
        for ch in CHANNELS:
            cases = ["Apple SBP 15%", "Apple std, launch yr 30%"] if ch == "iOS" else ["Apple SBP 15%"]
            for case in cases:
                u_t = unit(ch, plan, case, AI_TYPICAL)
                u_f = unit(ch, plan, case, AI_FULL)
                u_s = unit(ch, plan, case, AI_STRESS)
                label = ch if ch != "iOS" else f"iOS ({'15%' if case == 'Apple SBP 15%' else '30% yr 1'})"
                rows.append([plan, label, m(u_t["gross"]), m(u_t["fee"]), m(u_t["rc"]), m(u_t["net"]),
                             m(u_t["refunds"]), m(u_t["contrib"]), m(u_f["contrib"]), m(u_s["contrib"]), pct(u_t["contrib"] / u_t["gross"], 0)])
    print(md(["Plan", "Channel", "Gross MRR", "Store/payment fee", "RevenueCat", "Net revenue", "Refunds",
              f"Contribution (AI typ {m(AI_TYPICAL)})", f"Contribution (AI full {m(AI_FULL)})", f"Contribution (AI stress {m(AI_STRESS)})", "CM % (typ)"], rows))
    sb = APPLE_CASES["Apple std, steady blend"]
    print(f"\nApple standard programme, steady state: monthly-plan commission blends to {pct(sb['m'])} "
          f"({pct(TENURED_MONTHLY, 0)} of active monthly subs past 12 paid months at {pct(CHURN_MONTHLY, 0)} churn); "
          f"annual blends to {pct(sb['a'])} ({pct(TENURED_ANNUAL, 0)} renewals).\n")


def scenario_row(n, monthly_share, apple_case, ai):
    b = blended(monthly_share, apple_case, ai, rc_on=False)
    mrr = b["gross"] * n
    mobile_mtr = mrr * (CHANNELS["iOS"] + CHANNELS["Android"])
    rc = mobile_mtr * RC_PCT if mobile_mtr > RC_FREE_MTR else 0.0
    fees = b["fee"] * n
    net = mrr - fees - rc
    refunds = b["refunds"] * n
    ai_total = ai * n
    host_var = HOSTING_VAR_PER_SUB * n
    host_fix = hosting_fixed(n)
    gross_profit = net - refunds - ai_total - host_var - host_fix
    contrib = net - refunds - ai_total - host_var
    new = replacement_rate(monthly_share) * n
    annual_subs = n * (1 - monthly_share)
    return {"n": n, "monthly_subs": n * monthly_share, "annual_subs": annual_subs, "new": new, "mrr": mrr,
            "annual_cash": annual_subs / 12 * PRICE_ANNUAL, "monthly_cash": n * monthly_share * PRICE_MONTHLY,
            "fees": fees, "rc": rc, "net": net, "refunds": refunds, "ai": ai_total, "host_var": host_var,
            "host_fix": host_fix, "gp": gross_profit, "gm": gross_profit / mrr, "contrib": contrib,
            "cm": contrib / mrr}


def section_scenarios():
    print("## F. Forecast at 100 / 250 / 500 / 750 / 1,000 active paying subscribers (steady-state month, estimates)\n")
    print("Active subscribers are the paying base in a month; 'new subs needed' is the replacement for churn and "
          "non-renewal only (no growth). MRR counts annual plans at $149.99/12. 'Annual cash' is the steady-state "
          "average of upfront annual payments landing per month (it is lumpy in reality, see section H).\n")
    sizes = [100, 250, 500, 750, 1000]
    for mix_name, ms in PLAN_MIXES.items():
        for case in ("Apple SBP 15%", "Apple std, launch yr 30%"):
            rt = [scenario_row(n, ms, case, AI_TYPICAL) for n in sizes]
            rf = [scenario_row(n, ms, case, AI_FULL) for n in sizes]
            print(f"### Plan mix {mix_name} monthly/annual, {case}, channels iOS 60 / Android 25 / Web 15\n")
            rows = [
                ["Active paying subscribers"] + [f"{r['n']:,}" for r in rt],
                ["  on monthly / on annual"] + [f"{r['monthly_subs']:.0f} / {r['annual_subs']:.0f}" for r in rt],
                ["New subs needed per month (replacement)"] + [f"{r['new']:.1f}" for r in rt],
                ["MRR (annual normalised /12)"] + [m(r["mrr"], 0) for r in rt],
                ["Cash: monthly-plan payments"] + [m(r["monthly_cash"], 0) for r in rt],
                ["Cash: upfront annual payments (avg/month)"] + [m(r["annual_cash"], 0) for r in rt],
                ["Store + payment fees"] + [m(-r["fees"], 0) for r in rt],
                ["RevenueCat (0 below $2.5k MTR)"] + [m(-r["rc"], 0) for r in rt],
                ["**Net revenue after fees**"] + [m(r["net"], 0) for r in rt],
                ["Refunds (2%)"] + [m(-r["refunds"], 0) for r in rt],
                ["AI (typical usage)"] + [m(-r["ai"], 0) for r in rt],
                ["Hosting variable"] + [m(-r["host_var"], 0) for r in rt],
                ["**Contribution margin (AI typical)**"] + [f"{m(r['contrib'], 0)} ({pct(r['cm'], 0)})" for r in rt],
                ["**Contribution margin (AI full)**"] + [f"{m(r['contrib'], 0)} ({pct(r['cm'], 0)})" for r in rf],
                ["Hosting fixed"] + [m(-r["host_fix"], 0) for r in rt],
                ["**Gross margin (AI typical)**"] + [f"{m(r['gp'], 0)} ({pct(r['gm'], 0)})" for r in rt],
                ["**Gross margin (AI full)**"] + [f"{m(r['gp'], 0)} ({pct(r['gm'], 0)})" for r in rf],
            ]
            for cac in CACS:
                rows.append([f"Ad spend to replace churn @ ${cac} CAC"] + [m(-r["new"] * cac, 0) for r in rt])
            for cac in CACS:
                rows.append([f"Result after fixed hosting + replacement ads @ ${cac}, before salaries/other fixed (AI typ / full)"] +
                            [f"{m(t['gp'] - t['new'] * cac, 0)} / {m(f['gp'] - f['new'] * cac, 0)}" for t, f in zip(rt, rf)])
            print(md(["Line (per month)"] + [f"{n:,} subs" for n in sizes], rows))
            print()


def payback_months(cac, contrib):
    return cac / contrib if contrib > 0 else float("inf")


def section_payback():
    print("## G. CAC payback and lifetime value per new subscriber (estimates)\n")
    print("Payback (MRR basis) = CAC / monthly contribution. Expected paid life: monthly plan 1/churn = "
          f"{1 / CHURN_MONTHLY:.1f} months; annual plan 12/(1-renewal) = {12 / (1 - ANNUAL_RENEWAL):.0f} months. "
          "Annual plans pay upfront, so on a cash basis the CAC is recovered at purchase when first-year net cash exceeds it.\n")
    rows = []
    for plan in ("monthly", "annual"):
        for ch in CHANNELS:
            case = "Apple SBP 15%"
            for ai_name, ai in AI_LEVELS.items():
                u = unit(ch, plan, case, ai)
                life = (1 / CHURN_MONTHLY) if plan == "monthly" else 12 / (1 - ANNUAL_RENEWAL)
                ltv = u["contrib"] * life
                cells = [plan, ch, ai_name, m(u["contrib"])]
                for cac in CACS:
                    cells.append(f"{payback_months(cac, u['contrib']):.1f} mo, LTV/CAC {ltv / cac:.1f}")
                rows.append(cells)
    print(md(["Plan", "Channel", "AI", "Contribution / mo"] + [f"CAC ${c}" for c in CACS], rows))
    print("\niOS shown at Apple 15% (Small Business Program). At 30% (standard, first year) see blended table below.\n")
    rows = []
    for mix_name, ms in PLAN_MIXES.items():
        for case in ("Apple SBP 15%", "Apple std, launch yr 30%"):
            for ai_name, ai in AI_LEVELS.items():
                b = blended(ms, case, ai)
                cells = [mix_name, case, ai_name, m(b["contrib"])]
                for cac in CACS:
                    cells.append(f"{payback_months(cac, b['contrib']):.1f}")
                rows.append(cells)
    print(md(["Plan mix", "Apple", "AI", "Blended contribution / sub / mo"] + [f"Payback months @ ${c}" for c in CACS], rows))
    print()


def section_cash():
    print("## H. Simple 12-month cash view (one scenario, estimates)\n")
    NEW_PER_MONTH = 80
    CAC = 40
    MS = 0.70
    CASE = "Apple SBP 15%"
    FIXED_OTHER = 0.0
    print(f"Scenario: launch from 0, {NEW_PER_MONTH} new paying subs/month, plan mix 70/30, channels 60/25/15, {CASE}, "
          f"AI typical ({m(AI_TYPICAL)}/sub/mo), CAC ${CAC}, refunds 2%, monthly churn 8%, no annual renewals inside "
          "12 months. Store payouts arrive 1-2 months after the sale in reality (Apple ~33-45 days); this view books "
          "cash when the customer pays, so real bank cash lags.\n")
    act_m = 0.0
    act_a = 0.0
    cum = 0.0
    rows = []
    for month in range(1, 13):
        new_m = NEW_PER_MONTH * MS
        new_a = NEW_PER_MONTH * (1 - MS)
        act_m = act_m * (1 - CHURN_MONTHLY) + new_m
        act_a += new_a
        active = act_m + act_a
        mrr = act_m * PRICE_MONTHLY + act_a * ANNUAL_MRR
        cash_gross = 0.0
        fees = 0.0
        mobile_cash = 0.0
        for ch, cs in CHANNELS.items():
            rate = APPLE_CASES[CASE]
            cm_ = act_m * cs * PRICE_MONTHLY
            ca_ = new_a * cs * PRICE_ANNUAL
            cash_gross += cm_ + ca_
            if ch == "Web":
                fees += act_m * cs * payment_fee(ch, PRICE_MONTHLY, 0) + new_a * cs * payment_fee(ch, PRICE_ANNUAL, 0)
            else:
                fees += payment_fee(ch, cm_, rate["m"]) + payment_fee(ch, ca_, rate["a"])
                mobile_cash += cm_ + ca_
        rc = mobile_cash * RC_PCT if mobile_cash > RC_FREE_MTR else 0.0
        refunds = cash_gross * REFUND_RATE
        net_in = cash_gross - fees - rc - refunds
        costs = active * (AI_TYPICAL + HOSTING_VAR_PER_SUB) + hosting_fixed(active) + FIXED_OTHER
        ads = NEW_PER_MONTH * CAC
        flow = net_in - costs - ads
        cum += flow
        rows.append([month, NEW_PER_MONTH, f"{act_m:.0f}", f"{act_a:.0f}", f"{active:.0f}", m(mrr, 0), m(cash_gross, 0),
                     m(-(fees + rc + refunds), 0), m(net_in, 0), m(-costs, 0), m(-ads, 0), m(flow, 0), m(cum, 0)])
    print(md(["Month", "New subs", "Active monthly", "Active annual", "Total active", "MRR", "Cash collected (gross)",
              "Fees+RC+refunds", "Net cash in", "AI+hosting", "Ads", "Net cash flow", "Cumulative"], rows))
    print("\nOwner salary, legal, accounting, design, taxes on profit, sales tax/VAT handling and app-review time are "
          "not included. Month 13 brings the first annual renewals (60% assumed).\n")


def section_breakeven():
    print("## I. Break-even sensitivity on fixed costs (steady state, estimates)\n")
    print("Break-even active subscribers = fixed monthly costs / (blended contribution per sub - churn replacement "
          "cost per sub). Replacement cost per sub per month = (share monthly x 8% + share annual x 40%/12) x CAC. "
          "Fixed costs here = everything not per-subscriber (hosting base, tools, contractors, salary).\n")
    fixed_levels = [100, 250, 500, 1000, 2500, 5000, 10000]
    for case in ("Apple SBP 15%", "Apple std, launch yr 30%"):
        for ai_name, ai in AI_LEVELS.items():
            ms = 0.70
            b = blended(ms, case, ai)
            rr = replacement_rate(ms)
            heads = ["Fixed costs / month"] + [f"CAC ${c}" for c in [0] + CACS]
            rows = []
            for f in fixed_levels:
                cells = [m(f, 0)]
                for cac in [0] + CACS:
                    per = b["contrib"] - rr * cac
                    cells.append(f"{math.ceil(f / per):,}" if per > 0 else "never")
                rows.append(cells)
            print(f"### Mix 70/30, {case}, {ai_name}: contribution {m(b['contrib'])}/sub/mo, replacement {rr * 100:.2f}% of base/mo\n")
            print(md(heads, rows))
            print()


def section_legacy():
    print("## J. Footnote: legacy subscribers' AI worst case (docs/MEMBERSHIPS.md grandfathering)\n")
    rows = []
    for label, allowance, plans_lim, smart in (("Legacy Pro (400 msgs / 20 plans / 40 Sonnet)", 400, 20, 40),
                                                ("Legacy Plus (60 msgs / 0 plans / 6 Sonnet cap; routing lets chat use 1)", 60, 0, 6)):
        # routing.ts: chat escalates to Sonnet only while smartUsed < smartLimit - min(PLAN_RESERVE, smartLimit)
        chat_budget = smart - min(PLAN_RESERVE, smart)
        pa = min(plans_lim, smart - chat_budget)
        pb = min(plans_lim, smart)
        cb = min(chat_budget, smart - pb)
        mix_a = {"chat_fast": allowance - chat_budget - pa, "chat_smart": chat_budget, "plan": pa}
        mix_b = {"chat_fast": allowance - cb - pb, "chat_smart": cb, "plan": pb}
        typ = max(mix_cost(mix_a, "typical"), mix_cost(mix_b, "typical"))
        hvy = max(mix_cost(mix_a, "heavy"), mix_cost(mix_b, "heavy"))
        rows.append([label, m(typ), m(hvy)])
    print(md(["Legacy terms", "Full use, typical-size requests", "Full use, heavy requests"], rows))
    print("\nOnly applies to Stripe subscriptions that existed when migration 20261022000022 ran; cost per legacy member per month.\n")


def main():
    print("# Narrow Gate Fitness: Pro subscription forecast (script output)\n")
    print(f"Prices (approved, fixed): ${PRICE_MONTHLY}/month or ${PRICE_ANNUAL}/year (= {m(ANNUAL_MRR)}/month). "
          "All outputs are estimates; no profitability is guaranteed.\n")
    section_api()
    section_tokens()
    section_requests()
    section_ai_per_user()
    section_unit()
    section_scenarios()
    section_payback()
    section_cash()
    section_breakeven()
    section_legacy()


if __name__ == "__main__":
    main()
