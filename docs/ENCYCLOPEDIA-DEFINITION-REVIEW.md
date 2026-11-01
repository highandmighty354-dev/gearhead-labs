# Engineering Encyclopedia — definition review (38 concepts)

Status as of 2026-11-01, for PR #24 / Issue #23. **17 concepts are owner-approved (Wave 1, 31 Oct 2026); the other 21 are not.** Claude checked each definition against published sources on 2026-10-26; the Wave 1 entries were then revised and re-sourced in the owner-review package before approval.

## Wave 1 owner approval (31 Oct 2026)

- **Decision:** Trent Steeves (owner) approved all 17 Wave 1 entries as presented in *Gearhead-Labs-Wave1-Owner-Review-Package-Rev4-2026-10-31*. The decision is recorded in *Gearhead-Labs-Wave1-Owner-Decision-Record-2026-10-31*: 17 approved, 0 approved with edits, 0 rejected, 0 pending.
- **In the data:** these 17 concepts carry `review_status: "reviewed"`, `reviewer: "Trent Steeves (owner)"` and `verified: "2026-10-31"`. Their definition, watch-out, aliases, abbreviations, sources and calculator links are the Revision 4 text.
- **Review metadata kept with each entry:**
    - technical confidence and source confidence, as two separate ratings;
    - each source's tier and limitation;
    - editorial caveats;
    - the role of each linked calculator (calculates it / takes it as an input / uses it / illustrates a related concept).
- **The 21 other concepts:** kept, with their earlier statuses. None is owner-approved. That includes Transmission Gear Ratio (ready for owner review, outside Wave 1), and Crankcase Compression Ratio and Clutch Torque Capacity (both need further source work).
- **Interface limitation:** the result list does not show review status. The status appears on each entry's page, where unapproved entries say "not yet approved by a reviewer" or "Draft definition, not yet reviewed".

## What the statuses mean

| Status in the data | Shown on the page | Meaning |
|---|---|---|
| `citation-verified` | Checked against the sources below; not yet approved by a reviewer | Claude fetched every listed source and read it for the specific claim in its *Supports* line. Every claim in the definition and its "watch out" text is supported. |
| `citation-partial` | Partly checked …; with *Open question* | Some claims are supported. The rest are listed under *Open questions* below and on the entry. |
| `draft-unreviewed` | Draft definition, not yet reviewed. No source cited yet. | No suitable source was found. |
| `reviewed` | Reviewed by *name* on *date*, with technical and source confidence | Owner or named-reviewer approval. **Used by the 17 Wave 1 concepts.** The validator refuses it without a reviewer and date. A reviewed concept also needs sources, both confidence ratings, a tier on every source and a stated role for every linked calculator. |

The validator (`catalog/check-encyclopedia.js`) enforces the following rules:
- A checked or partly checked concept must have at least one source, the date it was checked and who checked it.
- A partly checked concept must say what is still unsupported.
- Every source must name the claim it supports and use an https link.
- An unchecked draft may not carry sources.

## Summary

- **Owner-approved (Wave 1):** 17
- **Checked, not approved:** 11
- **Partly checked, not approved:** 8
- **Not checked (no source found):** 2
- *At the 2026-10-26 source check, before Wave 1: 25 checked, 11 partly checked, 2 not checked.*
- **Definitions revised during the check:** 6

Revised definitions were changed because a source contradicted or narrowed the draft. Each revision is described in the entry's review note.

Source quality varies, and the reviewer should weigh it:
- **Manufacturer and trade sources:** JE Pistons, Torsen, Sonnax, Penske, Mark Williams, Huco, CP-Carrillo, ALLDATA, Engine Builder, MOTOR, Haynes, High Performance Academy.
- **Wikipedia.**
- **General reference sites:** cars-data.com, YOUCANIC, Suspension Secrets, EduMech, SPRINGRATES, GlobalSpec.

No textbook (for example Heywood or Milliken) or SAE standard (for example SAE J670) could be fetched in this environment. A reviewer with access should prefer those where they disagree with the web sources.

## Checklist

| # | Concept | Status | Sources (claim each supports is on the entry) | Revised | Open questions |
|---|---|---|---|---|---|
| 1 | Static Compression Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 2 | Dynamic Compression Ratio | Partly checked | [YOUCANIC](https://www.youcanic.com/compression-ratio-calculator) |  | Source ties dynamic CR to intake valve closing but gives no formula. Not yet verified: the exact calculation (piston position at IVC) and the role of rod length. Only forum material was found for those; a manufacturer or textbook source is still needed. |
| 3 | Crankcase Compression Ratio | Not checked | — |  | No authoritative source found in this check (searches returned forums only). Needs a two-stroke reference (for example a two-stroke design text) before it can be cited. |
| 4 | Intake Valve Closing | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 5 | Engine Displacement | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 6 | Bore-to-Stroke Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 7 | Rod/Stroke Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 8 | Mean Piston Speed | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 9 | Brake Mean Effective Pressure | Checked | [Wikipedia](https://en.wikipedia.org/wiki/Mean_effective_pressure) |  | — |
| 10 | Indicated Mean Effective Pressure | Partly checked | [Wikipedia](https://en.wikipedia.org/wiki/Mean_effective_pressure) | Yes | Revised 2026-10-26: the draft said IMEP is taken "before friction and pumping losses", which the source contradicts for IMEP over the complete cycle (net IMEP). The gross/net distinction in the "watch out" text is standard usage but was not confirmed in the fetched source. |
| 11 | Friction Mean Effective Pressure | Partly checked | [Wikipedia](https://en.wikipedia.org/wiki/Mean_effective_pressure) |  | Supported: FMEP = IMEP - BMEP. Not confirmed in the source: whether pumping is counted in FMEP depends on whether net or gross IMEP is used; the definition keeps that hedge. |
| 12 | Cranking Compression Pressure | Partly checked | [ALLDATA](https://alldata.com/ca/en/support/tech-assist/article/how-perform-cranking-compression-test) |  | Supported except "valve timing" as a factor, which the source does not mention. |
| 13 | Piston Ring End Gap | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 14 | Final Drive Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 15 | Ring and Pinion | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 16 | Transmission Gear Ratio | Not checked | — |  | No source fetched that defines a transmission gear ratio as input speed / output speed. cars-data.com only uses "gearbox ratio" in the overall-ratio formula. |
| 17 | Planetary Gearset | Checked | [EduMech](https://www.edumech.co.uk/learn/transmission-and-driveline/epicyclic-gear-sets) |  | — |
| 18 | Torque Converter Stall Speed | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 19 | Limited-Slip Differential | Partly checked | [Torsen](https://torsen.com/category/tech-info/) |  | Not confirmed in the source: the "watch out" statement about lockers. |
| 20 | Torque Bias Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 21 | U-Joint Operating Angle | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 22 | Driveshaft Critical Speed | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 23 | Clutch Torque Capacity | Partly checked | [GlobalSpec Insights](https://insights.globalspec.com/article/18989/fundamentals-of-clutches) |  | The source shows the formula only as an image, which could not be read; the variables are confirmed, the exact form (mean radius) is not. |
| 24 | Spring Rate (Suspension) | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 25 | Spring Rate (Valve Spring) | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 26 | Motion Ratio | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 27 | Wheel Rate | Checked | [Penske Racing Shocks](https://www.penskeshocks.com/blog/spring-rate-in-racing-suspension-wheel-rate-motion-ratio-and-how-to-calculate-what-your-tire-actually-feels) |  | — |
| 28 | Ride Frequency | Partly checked | [SPRINGRATES](https://www.springrates.com/blogs/blog/glossary-of-suspension-terms) |  | Not confirmed in the source: the units (Hz or cycles per minute). |
| 29 | Roll Center | Checked | [Wikipedia](https://en.wikipedia.org/wiki/Roll_center)<br>[SPRINGRATES](https://www.springrates.com/blogs/blog/glossary-of-suspension-terms) | Yes | — |
| 30 | Roll Stiffness | Partly checked | [SPRINGRATES](https://www.springrates.com/blogs/blog/glossary-of-suspension-terms) |  | Not confirmed in the source: the "watch out" statement on roll couple distribution. |
| 31 | Anti-Squat | Checked | [Suspension Secrets](https://suspensionsecrets.co.uk/anti-squat-dive-and-lift-geometry/) | Yes | — |
| 32 | Anti-Dive | Checked | [Suspension Secrets](https://suspensionsecrets.co.uk/anti-squat-dive-and-lift-geometry/) | Yes | — |
| 33 | Weight Transfer | Checked | [Wikipedia](https://en.wikipedia.org/wiki/Weight_transfer) |  | — |
| 34 | Toe | Checked | [MOTOR magazine](https://dev-www.motor.com/magazine-summary/mastering-the-basics-wheel-alignment/)<br>[Haynes](https://us.haynes.com/blogs/tips-tutorials/what-wheel-alignment-and-what-does-it-do) |  | — |
| 35 | Bump Steer | Checked | [Wikipedia](https://en.wikipedia.org/wiki/Bump_steer) | Yes | — |
| 36 | Caster | Checked | [MOTOR magazine](https://dev-www.motor.com/magazine-summary/mastering-the-basics-wheel-alignment/)<br>[Haynes](https://us.haynes.com/blogs/tips-tutorials/what-wheel-alignment-and-what-does-it-do) |  | — |
| 37 | Camber | **Owner-approved (Wave 1, 2026-10-31)** | Revision 4 sources, listed on the entry with tier and limitations | Wave 1 | Caveats, if any, are on the entry |
| 38 | Ackermann Steering Geometry | Checked | [Wikipedia](https://en.wikipedia.org/wiki/Ackermann_steering_geometry) |  | — |

## Revisions made during the check

- **Indicated Mean Effective Pressure:** Revised 2026-10-26: the draft said IMEP is taken "before friction and pumping losses", which the source contradicts for IMEP over the complete cycle (net IMEP). The gross/net distinction in the "watch out" text is standard usage but was not confirmed in the fetched source.
- **U-Joint Operating Angle:** Revised 2026-10-26: the draft said "equal and opposite angles" cancel the fluctuation and did not mention yoke phasing. The source requires equal angles and the inboard yokes in line.
- **Roll Center:** Revised 2026-10-26: the draft described it as the point the body rolls about; the source treats it as a notional point where cornering forces are reacted, and notes that it moves.
- **Anti-Squat:** Revised 2026-10-26: wording aligned with the source (what 100% means).
- **Anti-Dive:** Revised 2026-10-26: wording aligned with the source (what 100% means).
- **Bump Steer:** Revised 2026-10-26: cause wording made specific (different arcs, effective tie-rod length).

## Decisions for the owner

1. **Approve or correct** the checked definitions. Then set `review_status: reviewed` with `reviewer` and `verified` (date) in `catalog/encyclopedia-enrichment.json`, and run `node catalog/build-encyclopedia.js`.
2. **Sources for the two unchecked concepts.** Crankcase Compression Ratio and Transmission Gear Ratio need a two-stroke design text and a transmission reference respectively.
3. **Whether web reference sources are acceptable.** Wikipedia and general glossary sites are among the sources. The owner should decide whether they are enough, or whether only manufacturer, textbook and standard sources count.
4. **The 11 abbreviation entries.** They have no definition of their own; each shows its concept's definition. They remain `draft-unreviewed`.
