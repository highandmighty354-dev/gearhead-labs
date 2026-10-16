# GH-DEF-034 — fastener reference table

**Status of this document:** written before the correction code (2026-10-15). It is the reference that `premium/tests/fasteners-def034.test.js` checks against. See the GH-DEF-034 entry in [DEFERRED-WORK-REGISTER.md](DEFERRED-WORK-REGISTER.md).

**Standards-verification limitation.** ASME B1.1, ASME B1.13M, SAE J429 and ISO 898-1 were **not** inspected directly. Every value below comes from the four reviewed secondary sources (S1–S4), each of which names the standard it summarises. If the standards themselves are obtained later, this table is the place to re-check.

## Sources and what each one supports

| | Source | Supports (as printed) | Not supported / limits |
|---|---|---|---|
| S1 | [MechaniCalc — Fastener Size Tables](https://mechanicalc.com/reference/fastener-size-tables) ("adapted from ASME B1.1"; metric "standard sizes from ASME B1.13M"; stress area "ASME B1.1, Appendix B" / "ASME B1.13M, Appendix B") | UNC and UNF threads per inch and tensile stress areas, 1/4–1 in (all 20 rows below). Metric coarse and one fine pitch per size, M5–M20, with stress areas | The stress-area formulas are images on the page, not readable text. No sizes above 1 in were read. |
| S2 | [Engineers Edge — ANSI inch thread stress area](https://engineersedge.com/hardware/ansi_inch_size_thread_stress_15800.htm) ("ASME / ANSI B1.1") | 16 of the 20 inch rows, the same values as S1 | No 5/16-24, 7/16-20, 9/16-18 or 1-12 row was read. Series typos ("UCN", "UFC"). **7/16-14 is printed as 0.0163 (a typo; S1 gives 0.1063), so it is not used.** No formula. |
| S3 | [Portland Bolt — SAE J429](https://www.portlandbolt.com/technical/specifications/sae-j429/) | Proof load (psi) by grade and nominal size range | The note "Grade 2 requirements for 1/4 thru 3/4 apply only to bolts 6 in and shorter; longer bolts use Grade 1" (Grade 1 is not offered by the calculator). |
| S4 | [Fastenal — Mechanical Properties of Metric Fasteners](https://crafter.fastenal.com/static-assets/pdfs/Mechanical_Properties_of_Metric_Fasteners.pdf) ("per ISO 898-1") | Proof stress (MPa) by property class and size range. Metric stress areas, coarse and fine, M3–M39. The formula "Tensile Stress Area = 0.7854[(d3+d2)/2]²", with d2 the basic pitch diameter and d3 the minor diameter | The PDF's table layout was scrambled when read, so the class-to-row assignment was matched by values. Areas are printed to 3 significant figures. |

## Stress-area formulas

| Thread | Formula used by the calculator | Support |
|---|---|---|
| UN inch (UNC, UNF and any other UN pitch) | A_t = π/4 (d − 0.9743 / n)², with d the major diameter in inches and n threads per inch | Reproduces all 20 S1 values and the 15 usable S2 values to the printed digits, apart from the one noted below. The formula text was not readable in S1–S4. It is the formula Batch 11b already uses (`GH11B_threadRead`). |
| ISO metric (coarse or fine) | A_s = π/4 (d − 0.9382 P)², with d and P in mm | Reproduces all 14 S1 metric rows (coarse and fine) and the matching S4 rows to the printed digits. It is S4's 0.7854 ((d2 + d3)/2)² written with the basic-profile diameters. The profile relation itself is not stated in S1–S4. |

**Discrepancy, resolved: 1/2-20 UNF.** The formula gives 0.159953 in², which rounds to 0.1600, but S1 and S2 both print **0.1599**.
- **Size:** 0.00005 in² (0.03 %), half a unit in the last printed place. It is attributed to the source tabulation.
- **Decision:** the calculator uses the formula. The tests accept a printed value within one unit of its last digit, and this row is recorded here as the only one that needs that.

## Inch threads, 1/4–1 in (S1; S2 where printed)

| Size | UNC n | UNC A_t, in² (printed) | formula | UNF n | UNF A_t, in² (printed) | formula |
|---|---|---|---|---|---|---|
| 1/4 | 20 | 0.0318 | 0.031821 | 28 | 0.0364 | 0.036374 |
| 5/16 | 18 | 0.0524 | 0.052430 | 24 | 0.0580 (S1 only) | 0.058066 |
| 3/8 | 16 | 0.0775 | 0.077490 | 24 | 0.0878 | 0.087828 |
| 7/16 | 14 | 0.1063 (S1; S2 typo) | 0.106308 | 20 | 0.1187 (S1 only) | 0.118716 |
| 1/2 | 13 | 0.1419 | 0.141898 | 20 | **0.1599** | 0.159953 |
| 9/16 | 12 | 0.182 | 0.181944 | 18 | 0.203 (S1 only) | 0.202980 |
| 5/8 | 11 | 0.226 | 0.226002 | 18 | 0.256 | 0.255957 |
| 3/4 | 10 | 0.334 | 0.334460 | 16 | 0.373 | 0.372960 |
| 7/8 | 9 | 0.462 | 0.461733 | 14 | 0.509 | 0.509473 |
| 1 | 8 | 0.606 | 0.605744 | 12 | 0.663 (S1 only) | 0.663040 |

## Metric threads, M5–M20 (S1 to 4 significant figures; S4 to 3)

| Thread | A_s, mm² (S1) | S4 | formula |
|---|---|---|---|
| M5 × 0.8 | 14.18 | 14.2 | 14.1825 |
| M6 × 1 | 20.12 | 20.1 | 20.1233 |
| M8 × 1.25 | 36.61 | 36.6 | 36.6085 |
| M8 × 1 (fine) | 39.17 | 39.2 | 39.1670 |
| M10 × 1.5 | 57.99 | 58 | 57.9895 |
| M10 × 1.25 (fine) | 61.20 | 61.2 | 61.1985 |
| M12 × 1.75 | 84.27 | 84.3 | 84.2664 |
| M12 × 1.25 (fine) | 92.07 | 92.1 | 92.0717 |
| M14 × 2 | 115.4 | 115 | 115.4391 |
| M14 × 1.5 (fine) | 124.5 | 125 | 124.5454 |
| M16 × 2 | 156.7 | 157 | 156.6681 |
| M16 × 1.5 (fine) | 167.2 | 167 | 167.2481 |
| M20 × 2.5 | 244.8 | 245 | 244.7940 |
| M20 × 1.5 (fine) | 271.5 | 272 | 271.5031 |

S1 lists one fine pitch per size, so M10 × 1 and M12 × 1.5 are not in the reference table. The calculator accepts any pitch in 0.2–6 mm and is tested on the rows above.

## Proof strength by grade and size

| Grade / class | Size range (as printed) | Proof strength | Used by the calculator (psi) | Source |
|---|---|---|---|---|
| SAE Grade 2 | 1/4 thru 3/4 in | 55,000 psi | 55,000 for 0.25 ≤ d ≤ 0.75 in | S3 |
| SAE Grade 2 | over 3/4 thru 1-1/2 in | 33,000 psi | 33,000 for 0.75 < d ≤ 1.5 in | S3 |
| SAE Grade 5 | 1/4 thru 1 in | 85,000 psi | 85,000 for 0.25 ≤ d ≤ 1 in | S3 |
| SAE Grade 5 | over 1 thru 1-1/2 in | 74,000 psi | 74,000 for 1 < d ≤ 1.5 in | S3 |
| SAE Grade 8 | 1/4 thru 1-1/2 in | 120,000 psi | 120,000 for 0.25 ≤ d ≤ 1.5 in | S3 |
| ISO 8.8 | M5 – M16 | 580 MPa | 84,121.888 for 5 ≤ d ≤ 16 mm | S4 |
| ISO 8.8 | M18 – M39 | 600 MPa | 87,022.643 for 18 ≤ d ≤ 39 mm (no value for 16 < d < 18 mm) | S4 |
| ISO 10.9 | M5 – M39 | 830 MPa | 120,381.322 for 5 ≤ d ≤ 39 mm | S4 |

**Conversion.** MPa → psi uses 1 psi = 6,894.757293168 Pa (exact, from 1 lbf = 4.4482216152605 N and 1 in = 0.0254 m).

**How the calculator handles sizes and combinations the sources do not cover.** It gives no value rather than an assumed one.
1. **The 8.8 gap.** S4 prints only M5–M16 (580 MPa) and M18–M39 (600 MPa). A non-standard diameter between 16 and 18 mm is not covered, so the page shows a validation message instead of a value.
   - This replaces a first draft of this table, which put any diameter above 16 mm in the upper row. That would have been an invented value. The change was made before any commit.
   - ISO 898-1 itself may state the split as "d ≤ 16 mm / d > 16 mm". If the standard is inspected and confirms that, the gap can be closed by giving 16–18 mm the 600 MPa value.
2. **Outside the printed ranges, the calculator gives no proof strength.** It shows a validation message instead:
   - SAE grades below 1/4 in or above 1-1/2 in;
   - ISO classes below M5 or above M39.

   The old page gave a value for every diameter.
3. **Grade and thread standard must match.** SAE J429 grades (S3) are inch-series fasteners and ISO 898-1 classes (S4) are metric. So an SAE grade is accepted only with a UN thread, and an ISO class only with an ISO thread. Any other combination is reported as unsupported.
4. **Size boundaries** use the printed "thru" (inclusive) and "over" (exclusive) wording. A tolerance of 10⁻⁹ in (or mm) absorbs mm ↔ in round-off; for example, 19.05 mm typed in Metric is 3/4 in.
5. **Grade 2's 6-inch length condition** cannot be checked (the calculator has no length input), so it is stated on the page.

## Unchanged by the correction
- **Nut factor:** K = 0.20 dry, 0.15 lubricated.
- **Torque:** T = K × D × F ÷ 12 (ft-lb, with D in inches and F in lbf).
- **Target clamp load:** 75 % of the proof load.
- **Rounding chain on the page:** area to 5 decimals in in², clamp load to the whole lbf, torque to 0.1 ft-lb. It is kept from the old page, so the default (3/8-16, Grade 8, dry) still shows 43.6 ft-lb and 6,974 lbf, and 59.1137 N·m and 31,021.8975 N in Metric. Bolt Stretch's default (2 in, 3/8-16, 0.04 %) still shows 899 lbf (3,998.9512 N) and 11,600 psi. These were captured on the page before the change.

## Before and after on the page

These values are recalculated independently (a script outside the engine, applying the page's rounding chain to the formulas above). Dry, K = 0.20.

| Bolt | Before: A, clamp, torque | After: A, clamp, torque | Torque change, before vs after |
|---|---|---|---|
| 1/4-20 UNC Grade 5 | 0.03182, 2,029 lbf, 8.5 ft-lb | 0.03182, 2,029, 8.5 | 0 |
| 5/16-18 UNC Grade 5 | 0.04972, 3,170, 16.5 | 0.05243, 3,342, 17.4 | −5.2 % |
| 3/8-16 UNC Grade 8 (default) | 0.07749, 6,974, 43.6 | 0.07749, 6,974, 43.6 | 0 |
| 7/16-14 UNC Grade 5 | 0.11140, 7,102, 51.8 | 0.10631, 6,777, 49.4 | +4.9 % |
| **1/2-13 UNC Grade 5** | **0.15144, 9,654, 80.5** | **0.14190, 9,046, 75.4** | **+6.8 %** |
| 1/2-20 UNF Grade 5 | 0.15144, 9,654, 80.5 | 0.15995, 10,197, 85.0 | −5.3 % |
| 5/8-11 UNC Grade 5 | 0.24993, 15,933, 166.0 | 0.22600, 14,408, 150.1 | +10.6 % |
| 3/4-10 UNC Grade 5 | 0.37296, 23,776, 297.2 | 0.33446, 21,322, 266.5 | +11.5 % |
| 7/8-9 UNC Grade 2 | 0.52054, 21,472, 313.1 | 0.46173, 11,428, 166.7 | +87.8 % |
| 1-8 UNC Grade 5 | 0.69266, 44,157, 735.9 | 0.60574, 38,616, 643.6 | +14.3 % |
| M6 × 1, 8.8 | 8,015.7 N, 9.63 N·m | 8,754.1 N, 10.44 N·m | −7.8 % |
| M8 × 1.25, 8.8 | 14,714.7 N, 23.59 N·m | 15,924.6 N, 25.49 N·m | −7.4 % |
| M10 × 1.5, 8.8 | 25,248.1 N, 50.44 N·m | 25,225.9 N, 50.44 N·m | 0 |
| M12 × 1.75, 8.8 | 38,610.6 N, 92.60 N·m | 36,653.3 N, 87.99 N·m | +5.2 % |
| M12 × 1.75, 10.9 | 57,689.0 N, 138.43 N·m | 52,453.4 N, 125.96 N·m | +9.9 % |
| M16 × 2, 8.8 | 73,813.8 N, 236.18 N·m | 68,151.2 N, 218.15 N·m | +8.3 % |

## Corrections to the investigation figures (2026-10-15 register text)

The investigation compared the page's **area** with the printed table. The page's **torque** changes by slightly different amounts, because of the rounding chain and the formula-versus-printed difference: for example, 1/2-13 +6.7 % in area and +6.8 % in torque, and 3/4-10 +11.7 % against printed 0.334 but +11.5 % in torque. Both are kept, each labelled with what it compares. Two references in the investigation were not tabulated values from S1–S4:
- the 1-1/4-7 area of 0.969 in², which is formula-derived (0.96911), because S1's rows stop at 1 in;
- the 7/8 Grade 2 reference torque of 166.8 ft-lb, which used S1's printed 0.462; the page will show 166.7 from the formula.
