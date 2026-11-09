# Gearhead Labs — Freemium Growth & 90-Day SEO Plan

Status: **planning document (2026-11-09). Nothing here is implemented.** Based on `main` at `d25afa2` ("Create CNAME").

Labels:
- **[V]** verified in the repository or by a check made for this plan;
- **[R]** recommendation;
- **[A]** assumption or open question;
- **[N/A]** data that was unavailable.

**Data limits for this plan:**
- I could not load the live site (`www.gearhead-labs.com`) or Google Search Console from the research environment. Findings come from the code GitHub Pages serves from `main`, plus a public web search.
- No search volumes or difficulty scores were measured. The keyword workbook holds only six volumes, all unverified (section 3). Prioritisation is therefore **qualitative**.

---

## 1. Executive summary

- **The product is ahead of its discoverability [V].**
  - The catalogue has 757 tools, including **585 free public calculators** (universal 315, gasoline 162, diesel 42, EV 39, towing 27) and 172 Premium-only.
  - The Engineering Encyclopedia has **806 entries**: 757 calculator entries, 38 concept articles and 11 abbreviations.
  - To a search engine, almost none of it exists as separate pages:
    - every calculator lives behind one shell page and a 4.7 MB JavaScript application inside an iframe;
    - the site has no sitemap or robots.txt;
    - most calculator navigation is JavaScript clicks, not links;
    - the per-calculator titles and canonicals are written into the iframe document, under a versioned file name.
  - A public web search for `site:gearhead-labs.com` returned nothing from the site. **[A]** That engine is not Google; Search Console is the real test.
- **Priority 1 is making the free calculators crawlable [R]:** one real, static HTML landing page per calculator at a stable URL, with an explanation, the formula, a worked example and links to related tools. That one change turns 585 tools into potential search entry points. Nothing else in this plan pays off until it's done.
- **The existing keyword workbook is good and still valid [V].** It was built for YouTube planning: 289 keywords in 19 families, every one mapped to a real calculator ID. Its research points to the same strongest clusters for the website: **tires and gearing, towing, drag-strip math (ET/trap speed), horsepower truth (drivetrain loss), and compression.**
- **[R] First 90 days:**
  - **days 1–30:** fix crawlability and build the first 25 landing pages;
  - **days 31–60:** honest community participation and Shorts, from the workbook's "settle the argument" topics;
  - **days 61–90:** measure in Search Console and improve whatever gets impressions.
- **Success in 90 days** means pages indexed, impressions growing for target queries, first organic clicks and first referral visits from communities. It does not mean a traffic or revenue figure; nobody can honestly promise one for a new domain.

---

## 2. Verified website SEO findings

| # | Finding | Evidence | Impact |
| --- | --- | --- | --- |
| 1 | **The site is one shell page plus an iframe.** `index.html` (2.5 KB) loads `F1_12_4_…batch9_1.html` (**4.7 MB**) in `<iframe id="app">`. Calculators, labs and pages are routes (`?calc=<id>`, `?lab=<key>`, `?page=about…`) rendered by JavaScript. | [V] `index.html`, `app-shell.js` (`route()`, `sync()`), `ghRoute()` | A crawler fetching `/?calc=tire_size` gets the same generic shell every time. The content exists only after JavaScript runs inside a frame. |
| 2 | **The shell's metadata is generic.** Title "Gearhead Labs — The Automotive Math Encyclopedia \| The Science of Speed"; description "Gearhead Labs — The Automotive Math Encyclopedia."; no canonical, no Open Graph tags, no structured data. | [V] `index.html` `<head>` | Every shared or crawled URL looks identical. Social shares show no preview. |
| 3 | **Per-calculator metadata exists, but in the wrong document.** `ghUpdateMeta()` / `ghE110Meta()` set a unique title ("{name} \| Gearhead Labs — The Science of Speed"), a templated description, Open Graph tags and a canonical. `ghE110` also injects JSON-LD: WebSite, WebPage, BreadcrumbList, FAQPage. All of it runs **inside the iframe**. | [V] `F1_12_4…html` lines ~8420, ~10160, ~10210 | The canonical becomes `…/F1_12_4_Gearhead_Labs_…batch9_1.html?calc=<id>`, which changes every release (F1_12_3 → F1_12_4). The descriptions are near-identical templates. FAQ rich results are no longer shown for most sites (Google limited them to authoritative government and health sites in 2023), so the FAQPage markup has little value. |
| 4 | **No robots.txt, no sitemap.xml, no static calculator pages** in this repository or in `Gearhead-freemium`. | [V] repository trees, all 34 branches | Search engines have no list of the pages. **[A]** Earlier records mention a `build-static.js` that pre-rendered calculators and generated robots.txt, ads.txt and sitemap.xml. It is not in either repository, so it may exist only locally. If it exists, it is the fastest route to fixes 1–2 in section 9. |
| 5 | **The custom domain is now configured.** `CNAME` = `www.gearhead-labs.com` (committed 2026-11-08). | [V] `CNAME` | Good: robots.txt and the sitemap can now live at the domain root. **[A]** DNS, HTTPS enforcement and the apex-to-www redirect could not be checked from here. |
| 6 | **Old full copies are still published:** `F1_12_1`, `F1_12_2`, `F1_12_3` and `E1_3_4` (each a complete encyclopedia) sit beside `F1_12_4`. | [V] repository root | Duplicate content risk. Older canonicals point at old file names. |
| 7 | **Internal links are mostly not crawlable.** In the calculator app, navigation is mostly `onclick="renderCalc(…)"` (17 handlers; 2 static `?calc=` links). | [V] `F1_12_4…html` | Crawlers can't follow `onclick`. Related-tool links don't pass discovery. |
| 8 | **Trust-page links point to paths that don't exist.** The footer links to `/about/`, `/methodology/`, `/privacy/`, `/terms/` and `/contact/`, but there are no such folders. The content is reachable only as `?page=about` and so on. | [V] | Crawlers get 404s on the pages that signal trust (methodology, about, contact). |
| 9 | **The Encyclopedia is client-rendered.** `encyclopedia.html` (8 KB) fetches an 888 KB JSON file and renders it. It sets a per-entry title but no per-entry description or canonical. Links are real `href`s (good), but they are created by JavaScript. | [V] `encyclopedia.js` (line 243) | The concept articles (38), the best authority content, are not independently indexable as written. |
| 10 | **Mobile and performance.** The viewport meta is present. The first meaningful content needs the 4.7 MB frame. | [V] size; **[A]** Core Web Vitals not measured | Probably a slow mobile first paint. Measure with PageSpeed Insights (free) once the domain resolves. |
| 11 | **Robots meta allows indexing** (`index,follow,…`) inside the frame. No `noindex` anywhere. | [V] | Not a blocker. |
| 12 | **Catalogue quality flags [V]:** 14 calculators with incomplete descriptions, 21 with incomplete formulas, 13 concept drafts unreviewed (`gearhead-encyclopedia.json` counts). | [V] | These should not get public landing pages until complete; that avoids thin pages. |

**What Google can independently crawl today [V/A]:**
- `index.html` (generic);
- `encyclopedia.html` (generic until JavaScript runs);
- five large versioned HTML files.

**What exists only inside the application:** every calculator, every lab page, every encyclopedia entry and every trust page.

---

## 3. Existing keyword research assessment

- **The workbook [V]:** `Gearhead_Labs_YouTube_Keyword_Master_List.xlsx` (v1), followed by v2 and the 15-tab "Content Intelligence System" v3, plus a separate "First 30 YouTube Research" workbook.
  - It was built in an earlier Claude chat (Sept 2026) and is **not in the repository or Google Drive**. This assessment uses the recorded design and findings from that work, not a fresh read of the file.
  - **[A]** Attach v3 if any detail below needs re-checking.
  - **Structure:** 289 keywords in **19 families**:
    - Tires & Wheels;
    - Gearing & RPM;
    - Engine Math — Displacement, Compression, and Horsepower & Torque;
    - Camshaft & Valvetrain; Airflow & Cylinder Heads;
    - Drag Racing & Performance; Aero & Top Speed;
    - Carburetion; Fuel Injection & Fuel System; Turbo & Supercharger; Nitrous; Diesel;
    - Towing; EV;
    - Suspension, Handling & Brakes; Ownership & Fuel Economy; Shop Math & Conversions.

    Each keyword has a level (1 = big traffic term, 2 = high-intent tool search, 3 = question or comparison), an intent, an estimated competition and a mapped calculator ID (all 289 checked against F1.12.3).
- **Data quality:**
  - only **6** keywords have volumes, Semrush U.S. figures from Aug 2026 relayed through ChatGPT and **never independently verified** (for example "tire size calculator" 110k, "tire calculator" 49.5k);
  - the competition and potential scores are estimates;
  - YouTube view counts could not be observed.

  **[N/A]** No volumes or difficulty scores are invented here.
- **What it tells us for the website [R]** (the workbook was YouTube-first, so its Level 1–2 terms matter most for the site):

| Rank | Family / cluster | Why | Verdict for site SEO |
| --- | --- | --- | --- |
| 1 | Tires & Wheels + Gearing & RPM | Biggest stated demand; strongest debate evidence (3.73 vs 4.10, 33s vs 35s); deep calculator coverage (`tire_size`, `tire_size_comparison`, `effective_gear_ratio`, `engine_rpm_speed`, `speedometer_cal`) | **Top priority.** "Tire size calculator" is very competitive, so win on the gearing, RPM and speedometer consequences others don't show |
| 2 | Towing | A surprise leader in the research: broad audience, safety stakes, 23 free tools | **Top priority.** A clear, safety-first explanation is rare and valuable |
| 3 | Drag Racing & Performance | Classic enthusiast intent: `et_mph_prediction`, `hp_trap_speed`, `hp_quarter_mile`, `et_weight_change` | High. Calculators are common here, so worked examples and real-slip comparisons decide it |
| 4 | Horsepower truth (drivetrain loss, dyno correction) | Broadest debate ("15% loss?"); `drivetrain_loss`, `dyno_correction` | High: the myth-versus-math angle |
| 5 | Compression (static, dynamic, pump-gas limit) | Strong engine-builder intent; concept entries already exist (Static and Dynamic Compression Ratio, Intake Valve Closing) | High: the best match between the encyclopedia and the calculators |
| 6 | Displacement / strokers, carburetion, cam, heads | Loyal niche audiences that fit the Mopar and muscle-car identity | Medium |
| 7 | Fuel system, boost, nitrous | Useful tools, but injector and fuel-pump searches are crowded with calculators and parts-seller pages | Medium: landing pages yes, YouTube no ("calculator traps") |
| 8 | Diesel | 28 free tools; a distinct audience | Medium-low for now: build after the core |
| 9 | EV | The research found it owned by measured-data incumbents (winter range and similar) | **Deprioritise** |
| 10 | Conversions / shop math | High volume but generic, commercially weak, dominated by big utility sites | **Low**: keep as supporting pages, don't lead with them |

- **Excluded or too weak [V/R]:**
  - parts and repair searches with no formula behind them (the workbook already excluded "valve cover gasket");
  - pure unit conversions as headline targets;
  - topics where incumbents own the answer with measured data (EV winter range; rod ratio and the 5,252 RPM crossover as *video* topics, though they are still fine as landing pages).
- **Gaps [R]:**
  - "how much can my truck tow / payload" (the towing explainer is missing);
  - "3.73 vs 4.10";
  - "how much compression for pump gas";
  - "hp per psi of boost";
  - "do bigger tires change gear ratio".

  These are question searches with no landing page today. Each gets a hub article tied to its calculators (section 4).
- **Competition observed in a public web search [V, not ranking data]:** dedicated calculator sites already appear for automotive-calculator queries: inchcalculator.com, firgelliauto.com, speed-wiz.com, Wolfram|Alpha, corvetteactioncenter.com. Gearhead Labs' edges are breadth, formula transparency and connected tools, so pages must show the math and the connections, not just an input box.

---

## 4. Prioritized first 25 SEO opportunities

The order combines relevance, intent, realistic ranking potential for a new domain, and business value (funnel to Premium).
- **"Improve"** means building a crawlable static landing page for an existing calculator.
- **"New"** means a new hub article built around existing calculators.
- **Every page must include** what the calculation is for, the formula with units, one worked example with real-world numbers, how to read the result, honest limits, and links to 3–6 related tools plus the matching encyclopedia concept.
- **Audiences:**
  - E = enthusiast or hot-rodder;
  - T = truck and towing owner;
  - R = drag or road racer;
  - B = engine builder or shop.

| # | Page / topic | Target phrase | Intent | Aud. | Connect to | Type |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tire Size Calculator | tire size calculator | Tool | E, T | `tire_size` | Improve |
| 2 | Tire Size Comparison (old vs new) | tire size comparison calculator | Tool | E, T | `tire_size_comparison` | Improve |
| 3 | Bigger tires and your gear ratio | do bigger tires change gear ratio / effective gear ratio | Question | E, T | `effective_gear_ratio`, `tire_size_comparison` | New hub |
| 4 | RPM at Speed (gear + tire) | rpm calculator gear ratio tire size | Tool | E, T, R | `engine_rpm_speed`, `gear_ratio_speed` | Improve |
| 5 | 3.73 vs 4.10 gears, by the numbers | 3.73 vs 4.10 gears | Comparison | E, T | `engine_rpm_speed`, `final_drive_ratio`, `effective_gear_ratio` | New hub |
| 6 | Speedometer correction after a tire or gear change | speedometer calibration tire size | Tool / problem | E, T | `speedometer_cal`, `speedo_driven_gear` | Improve |
| 7 | GCWR & Payload: what your truck can really tow | how much can my truck tow / payload calculator | Question + tool | T | `gcwr_payload`, `tow_gcwr_margin` | New hub + improve |
| 8 | Tongue Weight Calculator | tongue weight calculator | Tool | T | `tongue_weight`, `tow_axle_load` | Improve |
| 9 | Towing up a grade: the horsepower it takes | towing grade horsepower | Question | T | `tow_grade_power`, `tow_aero_drag`, `tow_brake_energy` | New hub |
| 10 | Quarter-Mile ET & MPH Calculator | quarter mile calculator | Tool | R, E | `et_mph_prediction`, `eighth_to_quarter` | Improve |
| 11 | Horsepower from Trap Speed | trap speed horsepower calculator | Tool | R, E | `hp_trap_speed`, `hp_quarter_mile` | Improve |
| 12 | What it takes to run 10s (HP, weight, gearing) | horsepower to run 10s | Question | R, E | `et_mph_prediction`, `et_weight_change`, `et_hp_change` | New hub |
| 13 | Drivetrain loss: percentage or fixed amount? | drivetrain loss calculator / wheel hp to crank hp | Question + tool | E, R | `drivetrain_loss`, `dyno_correction` | New hub + improve |
| 14 | Static Compression Ratio Calculator | compression ratio calculator | Tool | B, E | `static_compression` + concept *Static Compression Ratio* | Improve |
| 15 | Dynamic compression and the pump-gas limit | how much compression on pump gas / dynamic compression | Question | B, E | concepts *Dynamic Compression Ratio*, *Intake Valve Closing*; `camshaft_ivc`, `cranking_compression` | New hub |
| 16 | Engine Displacement & stroker math | engine displacement calculator / stroker displacement | Tool | B, E | `engine_displacement`, `reverse_displacement`, `cubic_inches_to_liters`, `cubic_inches_to_cc` + concept *Engine Displacement* | Improve |
| 17 | 426 Hemi vs 440 Six Pack, by the numbers | 426 hemi vs 440 six pack | Comparison | E (Mopar) | free: `engine_displacement`, `hp_trap_speed`, `et_mph_prediction`; Premium mention: `hp_from_specs` | New article |
| 18 | Carburetor CFM Calculator | carburetor cfm calculator | Tool | E, B | `carb_sizing`, `engine_airflow` | Improve |
| 19 | Fuel Injector Sizing | fuel injector size calculator | Tool | B, E | `injector_sizing`, `injector_duty`, `fuel_flow_from_hp` | Improve |
| 20 | Fuel Pump Sizing | fuel pump size calculator | Tool | B, E | `fuel_pump_sizing`, `fuel_system_hp` | Improve |
| 21 | How much horsepower per psi of boost? | hp per psi boost | Question | E, B | `hp_from_boost`, `boost_for_hp`, `compressor_pr`, `boost_cr` | New hub |
| 22 | Horsepower & Torque (and why they cross at 5,252) | horsepower to torque calculator | Tool | E | `hp_from_torque`, `torque_from_hp` | Improve |
| 23 | Rod/Stroke Ratio | rod ratio calculator | Tool | B | `rod_stroke_ratio`, `deck_height` + concept *Rod/Stroke Ratio* | Improve |
| 24 | Mean Piston Speed | piston speed calculator | Tool | B | `mean_piston_speed` + concept *Mean Piston Speed* | Improve |
| 25 | Density Altitude for racers | density altitude calculator drag racing | Tool | R | `density_altitude`, `dyno_correction`, `jetting` | Improve |

**What each page should provide, its internal links, and why it's here:**
1. **Tire Size Calculator.**
   - *Provides:* how to read a size (P/LT, aspect, rim); diameter, width, sidewall and revolutions per mile; and a worked example (275/60R15 vs 295/50R15).
   - *Links:* #2, #3, #6, #4.
   - *Why:* the largest stated demand in the workbook. Competitive, but it's the gateway to the whole tires-and-gearing cluster.
2. **Tire Size Comparison.**
   - *Provides:* side-by-side diameter, % change and speedometer error; a 31" to 35" example; what it does to effective gearing.
   - *Links:* #3, #5, #6.
   - *Why:* the "33s vs 35s" debate is strongly evidenced in the research.
3. **Bigger tires and gear ratio.**
   - *Provides:* why a taller tire lowers the effective ratio (with the formula); when a regear pays back; an example (3.55 with 35s ≈ 3.08 on stock tires).
   - *Links:* #2, #4, #5, #6.
   - *Why:* a question search with no landing page today; very debated.
4. **RPM at Speed.**
   - *Provides:* cruise RPM from gear, final drive and tire; overdrive examples; how to pick a ratio for the highway.
   - *Links:* #3, #5, #10.
   - *Why:* high tool intent that pairs with every tire and gear page.
5. **3.73 vs 4.10.**
   - *Provides:* cruise RPM and acceleration trade-off tables for common tires and transmissions; when each makes sense (towing, street, strip).
   - *Links:* #3, #4, #10, #7.
   - *Why:* the workbook's strongest debate anchor.
6. **Speedometer correction.**
   - *Provides:* % error; the driven-gear tooth count for mechanical speedometers; when to recalibrate electronically.
   - *Links:* #2, #3.
   - *Why:* a practical, problem-solving search; good service in action.
7. **GCWR & Payload.**
   - *Provides:* GVWR, GCWR, payload and tongue weight explained plainly; using the door-jamb sticker; a worked example (half-ton towing 10,000 lb); safety margins; "verify with your owner's manual".
   - *Links:* #8, #9.
   - *Why:* a broad audience and real safety value; towing was the research's surprise leader.
8. **Tongue Weight.**
   - *Provides:* the 10–15% rule (conventional) and 15–25% (fifth wheel and gooseneck) with the math; how to measure; sway risk.
   - *Links:* #7, axle load.
   - *Why:* simple, high-intent, safety-related.
9. **Towing up a grade.**
   - *Provides:* power needed on a 6% grade at 60 mph with a 10,000 lb combination, including aero drag; why trucks downshift.
   - *Links:* #7, #8, towing aero drag.
   - *Why:* engineering depth that the typical towing guide lacks.
10. **Quarter-Mile ET & MPH.**
    - *Provides:* the classic HP/weight formulas, their assumptions, how traction and gearing change reality, and an example compared against a real time slip.
    - *Links:* #11, #12, #25.
    - *Why:* core racer intent.
11. **HP from Trap Speed.**
    - *Provides:* why trap speed estimates power better than ET; worked example; limits.
    - *Links:* #10, #13.
    - *Why:* fits the "horsepower truth" theme.
12. **Running 10s.**
    - *Provides:* HP needed at several weights, with gearing and launch notes.
    - *Links:* #10, #11, #5.
    - *Why:* a goal-based question, so a strong video tie-in.
13. **Drivetrain loss.**
    - *Provides:* both models (percentage versus fixed), what dyno types read, SAE correction, and the "15%" myth tested.
    - *Links:* #11, #22, #25.
    - *Why:* the broadest-reach debate in the research.
14. **Static Compression Ratio.**
    - *Provides:* the swept + clearance volume formula (gasket, deck, dome/dish, chamber); a worked small-block or big-block example.
    - *Links:* #15, #16, #23.
    - *Why:* an engine-builder staple; a ready-made encyclopedia tie-in.
15. **Dynamic compression.**
    - *Provides:* why intake valve closing timing matters more than the static number; the pump-gas guideline range with caveats (fuel, chamber, quench); the cranking-pressure link.
    - *Links:* #14, the cam pages.
    - *Why:* a recurring argument, and authority content no tool site explains well.
16. **Displacement and strokers.**
    - *Provides:* the bore × stroke formula; the 408 stroker vs 360 example; conversions on the same page instead of thin conversion pages.
    - *Links:* #14, #23, #24.
    - *Why:* consolidates several weak conversion keywords into one strong page.
17. **426 vs 440 Six Pack.**
    - *Provides:* published ratings versus the math (period time slips through the free trap-speed and ET tools), with cited sources. It also gives one honest Premium mention: `hp_from_specs` (Premium) estimates power from engine specifications.
    - *Links:* #13, #10.
    - *Why:* Mopar credibility; the research found conflicting published sources (a real gap); it fits the founder's audience and the MoparCenter partnership.
18. **Carb CFM.**
    - *Provides:* the CFM = CID × RPM × VE ÷ 3456 formula, VE assumptions, the "bigger isn't better" explanation.
    - *Links:* #16, #24.
    - *Why:* a loyal carburetted audience.
19. **Injector sizing.**
    - *Provides:* HP × BSFC ÷ (injectors × duty); E85 versus gasoline; a duty-cycle caution.
    - *Links:* #20, #21.
    - *Why:* steady tool intent (crowded, so the page must be the clearest).
20. **Fuel pump sizing.**
    - *Provides:* flow needed at base pressure plus boost; voltage effects.
    - *Links:* #19, #21.
    - *Why:* pairs with #19.
21. **HP per psi.**
    - *Provides:* pressure-ratio math (about 1 + boost ÷ 14.7) and why real gains are lower (heat, efficiency, intercooling).
    - *Links:* #19, #14 (boost compression).
    - *Why:* a classic debate with clean math behind it.
22. **HP and torque.**
    - *Provides:* HP = torque × RPM ÷ 5,252, explained without hype.
    - *Links:* #13, #11.
    - *Why:* huge but competitive. It's a supporting page, so keep it excellent and short.
23. **Rod/stroke ratio.**
    - *Provides:* what the ratio changes (dwell, side load) and what it doesn't; worked examples.
    - *Links:* #16, #24.
    - *Why:* engine-builder authority. A landing page, not a video (incumbents own the video).
24. **Mean piston speed.**
    - *Provides:* the formula, typical limits by build type, and the correction of the "faster than a race car" myth (≈40–50 mph mean).
    - *Links:* #23, #16.
    - *Why:* concept already exists; a myth-busting angle.
25. **Density altitude.**
    - *Provides:* how weather changes ET and jetting; a worked example.
    - *Links:* #10, #13, jetting.
    - *Why:* racers check it before every event, so it's a return-visit tool.

**Pages deliberately not on the list [R]:**
- individual unit-conversion pages (fold them into #16 and #22 instead);
- EV range topics (owned by measured-data incumbents);
- any calculator whose catalogue description or formula is incomplete.

---

## 5. Content strategy

- **Calculator landing pages:**
  - **Template [R]**, built by a static generator from the catalogue and encyclopedia data, then **hand-finished** for the top 25:
    - H1 = the calculator name;
    - a two-sentence answer of what it does;
    - the interactive calculator, loaded on demand;
    - "Why this matters";
    - the formula with defined variables and units;
    - a worked example with realistic numbers;
    - how to read the result and its limits;
    - related tools;
    - the related encyclopedia concept;
    - sources.
  - **[R]** Generate pages for all free calculators with complete data. Keep pages with incomplete descriptions or formulas as `noindex` until they're finished, so there are no thin pages.
- **Engineering Encyclopedia:**
  - **[R]** Give each of the 38 concepts its own static page. They're the authority layer: each links to every calculator that uses it, and each calculator page links back.
  - Finish the 13 unreviewed concept drafts before indexing them.
  - Add concepts where the top 25 need them: Gross Vehicle / Combined Weight Ratings, Tongue Weight, Effective Gear Ratio, Drivetrain Loss, Density Altitude, Volumetric Efficiency.
- **Educational articles:**
  - **[R]** The "new hub" items in section 4 (#3, #5, #7, #9, #12, #13, #15, #17, #21).
  - Format: a real question → the math → a worked table → "what this means in your garage" → the calculators.
  - About 1,000–1,800 words, written or edited from Trent's hands-on experience. Include a shop anecdote or a real time slip where possible, since that's what generic AI-written content can't fake.
  - One a week is sustainable.
- **Video:**
  - **[R]** Use the workbook research's **Final 10**:
    1. regear threshold;
    2. 3.73 vs 4.10;
    3. 33s vs 35s;
    4. pump-gas compression;
    5. HP per psi;
    6. drivetrain loss / underrating;
    7. HP for a 10-second ET goal;
    8. half-ton towing 10,000 lb;
    9. 426 vs 440;
    10. what horsepower a set of heads can support.
  - **Shorts format:** a hook question in 2 seconds → real numbers in the calculator on screen → the answer plus one surprise → "every formula is free at Gearhead Labs".
  - Every video links its matching landing page; every landing page embeds or links its video.
  - Avoid the research's "calculator traps" as videos (injector and fuel-pump sizing, the 5,252 crossover, EV winter range, piston speed, stall speed, rod ratio). They stay as landing pages.
- **Quality bar [R]:**
  - every number checked by the calculator itself;
  - sources cited where a claim isn't pure math;
  - no keyword stuffing;
  - no near-duplicate pages;
  - corrections published openly.

  This follows the existing Methodology / "encyclopedia of equations" standard.

---

## 6. Organic marketing strategy

| Channel | How (no spam) | First actions |
| --- | --- | --- |
| **MoparCenter partnership** (existing reciprocal agreement) | Co-branded "by the numbers" articles (#17, the 426/440, Mopar gearing); cross-links | Agree the first joint piece and links in month 1 |
| **Mopar and muscle-car forums** | Join as Trent, a Red Seal truck and trailer technician and lifelong Mopar person. Answer gearing, compression and tire questions **with the math in the post**. Link only where the forum allows and the page adds something (the worked table). Use a profile signature where allowed | Pick 2–3 forums; read the rules; 2 helpful answers a week before any link |
| **Reddit** | Answer only in relevant threads, with full answers in the comment itself. Disclose the affiliation when linking. Follow each subreddit's self-promotion rules | Before linking anywhere, establish a track record of genuine answers |
| **Facebook groups** (Mopar, classic trucks, towing/RV) | Ask the admins before sharing tools. Offer a "math of the week" post that the admins approve | Contact 3 group admins |
| **YouTube Shorts / long-form** | Final 10 topics; 2–3 Shorts a week; a long-form video only after Shorts show which topics hold retention | 4 Shorts in days 31–45 |
| **Collector-car and insurance network** | Trent's industry relationships (clubs, appraisers, restorers) can earn natural links from club newsletters and tech pages. Offer free, useful tools, not ads | Five personal emails with one relevant tool each |
| **Racing community** | Local drag strips and bracket racers: density altitude, ET prediction and consistency tools. Offer track-day printouts or a QR card | One track or club contact |
| **Education** | Automotive technician programmes: compression, displacement and gear-ratio pages as teaching aids | One instructor contact (earned links from school sites) |

**Not recommended:** paid ads before the landing pages exist; link buying; mass-posting the same link; AI-generated forum replies.

---

## 7. Free-to-Premium customer journey

1. **Google → a calculator landing page [R].**
   - It must fully solve the visitor's problem for free. No gates on free calculators; formulas are visible even on locked Premium tools (an existing owner decision, 2026-10-17).
2. **Related tools.**
   - Each page links its natural next steps: tire size → effective gear → RPM at speed → speedometer.
   - A "next calculation" box after the result is the main engagement lever.
3. **Encyclopedia.**
   - "What's really going on" links to the concept page; concept pages link back to every tool.
4. **Reasons to return.**
   - Racer tools (density altitude, ET prediction) are naturally repeat-use.
   - **[R]** Later: an optional email list for "math of the week" and new tools. **[A]** That needs a sending service, which is an owner decision on cost.
   - Shorts and the MoparCenter content keep the brand in view.
5. **Premium when it adds real value.**
   - **[V, design]** Premium = My Garage (vehicle profiles, builds), saved calculations and test setups, analyses, and the Engineering Lab.
   - **[A]** Stripe checkout is in a draft PR (#28) and is not live. Premium features are partly built; this plan doesn't assume any are finished.
   - **[R] Introduce Premium:**
     - after a completed calculation ("Save this setup to your Garage and compare it with your next combination");
     - on comparison-heavy pages (gearing, tires, compression);
     - on the locked Premium calculators.
   - **Never:** before the free answer is shown, as a pop-up, or as a reason the free calculator gives a partial result.

---

## 8. Search Console and measurement recommendations

- **Status [V]:** nothing in the repository shows Google Search Console, Bing Webmaster Tools or any analytics being configured. **[A]** Accounts may exist outside the repository; check before creating new ones.
- **Minimum setup [R]** (all free, and Trent must do these himself because they need his Google account and DNS):
  1. A Search Console **Domain property** for `gearhead-labs.com`, verified with a DNS TXT record at the domain registrar. It covers www, the apex and https together.
  2. Submit `https://www.gearhead-labs.com/sitemap.xml` once it exists.
  3. URL Inspection → request indexing for the home page and the top 25 pages.
  4. Bing Webmaster Tools, imported from Search Console in one click.
  5. PageSpeed Insights spot checks on the home page and 3 landing pages.
- **Weekly report** (a spreadsheet is fine until the first-party dashboard exists):
  - indexed pages (Pages report: "Indexed" and the reasons pages aren't);
  - impressions, clicks, CTR and average position for the top 25 pages and their target queries;
  - new queries appearing (content ideas);
  - top organic landing pages;
  - pages with impressions but a CTR under about 1% (title and description rewrite candidates);
  - linking sites (Links report).
- **Referral tracking [R]:** add UTM tags to every link Trent posts:
  - `utm_source` = forum, subreddit or group name;
  - `utm_medium` = `community` / `partner` / `video`;
  - `utm_campaign` = topic slug (for example `regear-373-410`).

  YouTube descriptions use `utm_medium=video`.
- **Connection to `docs/ANALYTICS-BLUEPRINT.md`.** That design is unchanged; only these marketing reports are added:
  1. **Organic landing performance:** sessions by landing page where the channel is Organic search, with calculator completion rate on that landing page. This joins Search Console page data, matched by URL, with the first-party `page_view` and `calc_complete` events.
  2. **Community ROI:** sessions, engaged sessions and completions by UTM source and campaign.
  3. **Journey depth:** the share of landing sessions that go on to a related tool or an encyclopedia concept (`nav_click` paths).
  4. **Premium path:** organic and community sessions that reach `premium_offer_view` and `trial_click`.
  5. **Search Console import [A]:** manual CSV upload at first. Automatic import via the Search Console API needs Google credentials and is an owner decision; it is not needed in the first 90 days.

---

## 9. 90-day action plan

### Days 1–30: Foundation
- **Work** (code changes in a reviewed PR; none made by this plan):
  1. **A static landing-page generator** for free calculators at stable URLs (for example `/calculators/<slug>/`), from the catalogue and encyclopedia data. Each page gets:
     - a unique title and description;
     - a self-canonical to `https://www.gearhead-labs.com/...`;
     - H1, explanation, formula and example sections;
     - real `<a href>` related links;
     - BreadcrumbList and WebPage JSON-LD;
     - the interactive calculator, loaded on demand.

     The app's `?calc=` URLs canonicalise to these pages. **[A]** Recover `build-static.js` if it exists locally.
  2. A `robots.txt` and an XML sitemap (static pages and concepts only) at the domain root.
  3. Retire the old copies `F1_12_1`–`3` and `E1_3_4` from the published site, or `noindex` them. Stop using the versioned filename as a canonical.
  4. Real static trust pages at `/about/`, `/methodology/`, `/privacy/`, `/terms/` and `/contact/`, matching the existing footer links.
  5. Give the shell `index.html` a real description, a canonical, Open Graph tags and Organization/WebSite JSON-LD. Remove reliance on FAQPage markup.
  6. Static pages for the 38 encyclopedia concepts.
  7. Hand-finish the landing pages for opportunities #1, #2, #4, #6, #7, #8, #10, #11, #14 and #16.
- **Deliverables:** a crawlable site, a sitemap, 10 polished pages and around 500 generated pages (only complete ones indexable).
- **Dependencies:** owner approval of the PR; GitHub Pages serving from `main`; Trent verifying the Search Console domain property (DNS).
- **Success measures:**
  - the sitemap is accepted;
  - URL Inspection shows "URL is on Google" for the home page and the first 10;
  - the Search Console Pages report shows the indexed count rising;
  - no 404s from internal links.

### Days 31–60: Audience development
- **Work:**
  - publish the hub articles #3, #5, #7, #13 and #15, then #9, #12, #17 and #21;
  - finish the remaining top-25 landing pages;
  - start forum, Facebook and Reddit participation (section 6);
  - the first joint MoparCenter piece;
  - 6–8 Shorts from the Final 10, each linked to its landing page with UTMs.
- **Deliverables:** 9 articles, 25 polished pages, 6–8 Shorts, 10–20 genuine community answers, 1 partner piece.
- **Dependencies:** days 1–30 crawlability done; Trent's time for community posts and filming.
- **Success measures:**
  - impressions appear for target queries (Search Console);
  - first organic clicks;
  - first referral visits by UTM;
  - Shorts retention and comments per topic;
  - at least 1–3 earned links (Links report).

### Days 61–90: Measurement and optimisation
- **Work:**
  - rewrite titles and descriptions on pages with impressions but low CTR;
  - expand clusters that show impressions (more related pages and examples);
  - drop or merge pages with zero impressions after 60 days;
  - move the video schedule toward the topics with the best retention;
  - add new concept pages for the queries Search Console reveals.
- **Deliverables:** an optimisation pass on the top 25; a cluster-expansion plan for the next quarter; a short results memo.
- **Dependencies:** about 4–8 weeks of Search Console data (impressions lag indexing).
- **Success measures** (leading indicators, not traffic promises):
  - indexed pages and the share of pages indexed;
  - the trend in impressions and the number of distinct queries;
  - average position moving from beyond page 5 towards pages 1–3 on long-tail queries;
  - CTR on the top 25;
  - community referral sessions;
  - landing-page calculator completion rate, once first-party analytics exists.
- **What we can realistically learn in 90 days:**
  - which clusters Google starts testing us for;
  - which titles earn clicks;
  - which communities send engaged visitors;
  - which video topics hold attention.

  A new domain usually needs several months for competitive head terms. Expect early wins from question and long-tail pages (#3, #5, #13, #15, #17, #21), not "tire size calculator".

---

## 10. Priority recommendations and dependencies

1. **Crawlable static calculator pages + sitemap + robots.txt.** This blocks everything else. *Depends on:* a code PR (owner approval) and recovering `build-static.js` if it exists.
2. **Search Console domain verification.** *Depends on:* Trent's DNS access at the domain registrar. **[A]** Confirm the domain resolves over HTTPS and that GitHub Pages "Enforce HTTPS" is on.
3. **Retire the duplicate encyclopedia versions** and fix the canonicals. *Depends on:* item 1.
4. **The top 10 hand-finished pages** (tires, gearing, towing, ET, compression, displacement). *Depends on:* item 1; Trent's review of each worked example.
5. **Community participation and the MoparCenter piece.** *Depends on:* Trent's time; it's most useful once the pages exist.
6. **Shorts from the Final 10.** *Depends on:* filming time; the landing pages to link to.
7. **First-party analytics** (`docs/ANALYTICS-BLUEPRINT.md`). Not required for days 1–60, because Search Console covers search. Build it before Premium launch so the journey to Premium is measurable.

**Owner decisions:**
- approve the static-page approach and its URL pattern (`/calculators/<slug>/`, `/encyclopedia/<slug>/`);
- whether the old encyclopedia files can be removed from the published site;
- how much weekly time goes to community work versus video;
- whether to start an email list later.

**Sources consulted for this plan:**
- Repository `highandmighty354-dev/gearhead-labs` at `main` `d25afa2`: `index.html`, `app-shell.js`, `F1_12_4_…html`, `encyclopedia.html`, `encyclopedia.js`, `catalog/gearhead-catalog.json`, `catalog/gearhead-encyclopedia.json`, `CNAME`;
- repository `Gearhead-freemium`;
- the earlier keyword-workbook and YouTube-research conversations (Sept 2026);
- a public web search for `site:gearhead-labs.com` and for automotive-calculator queries (2026-11-09).
