# Transmission and Differential sections: proposed mapping and plan

Status: **plan only, not implemented** in PR #24. The owner must approve the mapping before anything changes. Written 2026-10-26 for Issue #23.

## Decision

Transmission and Differential are **not added in PR #24**. A section in this app is the calculator's `cat` value in the engine page. Adding a section means editing the engine. This brief forbids changing engine behaviour in PR #24, and the change would reach well beyond the encyclopedia. No empty or encyclopedia-only sections were created.

## Where section identity lives today (verified)

| Place | What it holds | Effect of a new section |
|---|---|---|
| Engine page `F1_12_4_…batch9_1.html`, the `CALCS` list | `cat:` for every calculator; 32 uses of `'DRIVETRAIN & GEARING'` | **Source of truth.** The moved calculators' `cat` must change here. |
| Same engine page, `GH_LABS` | Each lab's `cats` list; the Gasoline lab lists `'DRIVETRAIN & GEARING'` | The new sections must be added to the lab lists or they won't appear in the lab. |
| Same engine page, category icon map | One SVG per category | The new sections need icons, or the fallback icon shows. |
| `catalog/build-catalog.js` → `catalog/gearhead-catalog.json` | Copies `cat` from the engine as `category` | No code change. Regenerate it, then check it with `check-catalog.js`. |
| `catalog/build-encyclopedia.js` → `catalog/gearhead-encyclopedia.json` | Derives concept sections from their calculators | No code change. Regenerate it; the Section filter picks up the new sections automatically. |
| `docs/PREMIUM-CATALOG.md` | Lists Premium tools with their category | Regenerate or edit it. |
| `supabase/migrations/0301_value_foundation_v1_seed.sql` | 4 parameter-registry rows use `'DRIVETRAIN & GEARING'` as a parameter domain | Production data. This domain describes parameters, not tool sections, so the proposal leaves it unchanged. Any change would be a separate migration, which this brief excludes. |
| Old engine copies (`F1_12_1`–`F1_12_3`, `E1_3_4`) | Historical builds | Not served; leave unchanged. |

Calculator ids do not change, so `index.html?calc=<id>` links, saved calculations, recents and encyclopedia links are unaffected.

## Proposed mapping: Gasoline lab, from *Drivetrain & Gearing* (30 tools today)

**Transmission (9):**
- `gearbox_efficiency`, `gearbox_efficiency_by_gear` (Premium)
- `optimal_gear_ratio_set` (Premium), `optimal_shift` (Premium), `rpm_drop_shift`
- `planetary_gearset_ratio` (Premium), `torque_converter` (Premium), `converter_slip`
- `speedo_driven_gear` (owner check: the driven gear sits in the transmission tailshaft)

**Differential (4):**
- `ring_pinion`, `final_drive_ratio`
- `final_drive_selector` (Premium), `lsd_bias_lock_effect` (Premium)

**Stays in *Drivetrain & Gearing* (driveline and general gearing, 17):**
- **Driveline:** `driveshaft_critical`, `driveshaft_speed`, `driveshaft_diameter_sizing`, `driveshaft_torque_capacity`, `ujoint_angles`, `pinion_angle_change`, `shaft_angular_deflection`
- **Axle and bearings:** `axle_shaft_torque_capacity`, `bearing_preload`
- **General gearing:** `gear_ratio_speed`, `engine_rpm_speed`, `crawl_ratio`, `crawl_ratio_tire`, `roll_out`, `portal_gear_reduction`, `gear_tooth_bending_stress`, `gear_tooth_contact_stress`

**Not moved** (they belong to their current sections, and the encyclopedia already links them through concepts):
- `trans_cooler_sizing` (Universal · Thermal & HVAC)
- `gear_shift_rpm_drag` (Universal · Drag Racing)
- `effective_gear_ratio` (Universal · Suspension, Tires & Geometry)
- The *Clutch & Hydraulics* section
- `e11_driveline_dynamics` (Engineering Lab)

## Questions for the owner

1. **The mapping.** Approve, or adjust the three judgement calls:
   - `speedo_driven_gear`: Transmission?
   - `axle_shaft_torque_capacity` and `bearing_preload`: Differential, or stay?
2. **Labs.** Gasoline only (where the tools are), or also Diesel and Universal? Those labs have no transmission or differential tools today, so new sections there would be empty, and this brief rules out empty sections.
3. **Names.** "TRANSMISSION" and "DIFFERENTIAL & AXLE", in the engine's upper-case style?

## Implementation plan (separate PR, after approval)

1. **Engine:** change `cat` for the approved tools; add the sections to `GH_LABS` gasoline `cats`; add two icons; bump the engine cache tag in `index.html`. No formula or behaviour change.
2. **Regenerate** the catalogue (`node catalog/build-catalog.js`, then `check-catalog.js`) and the encyclopedia (`node catalog/build-encyclopedia.js`, then `check-encyclopedia.js`). Update `docs/PREMIUM-CATALOG.md`.
3. **Tests:**
   - the full browser regression;
   - a new check that each moved tool opens by `?calc=` and appears under its new section in the Gasoline lab;
   - Free and Premium gating unchanged;
   - the encyclopedia Section filter lists the two new sections with the expected tools.
4. **Release:** the owner's normal review and deploy, separately from PR #24.
