# VALUE FOUNDATION V1 — FINAL SPECIFICATION DRAFT

**For formal owner review. Not approved; implementation not authorized.**
- **Repository:** HEAD `4a404bed5148ef0abea86152ebb962c184f140aa`, 12 tags, clean; unchanged.
- **Companion files** (all generated mechanically from the frozen-derived review tables):
  - `VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv`: the authoritative admission set, with full definitions
  - `VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv`: the 52 non-admitted candidates

**48 + 52 = the 100 Phase-1 candidates.**

---

## A. Purpose

Value Foundation V1 provides persistent, owner-scoped **machine specification values** for a fixed set of canonical engineering quantities. It supplies them, unconverted, as engine-native inputs to the frozen calculation service.

**V1 defines the storage, normalization, selection and supply contracts. It computes nothing.** Authoritative normalization requires the future DATA-FOUNDATION amendment described in §P. **The current frozen implementation doesn't yet provide that trusted normalization / write path**; it must be established before the V1 write workflow is implemented.

## B. Scope

**In scope:**
- **48 admitted source-field rows → 47 canonical quantity keys** (§D)
- the SPECIFICATION value role
- the D-002 unit contract
- the trusted normalization **contract** (its implementation depends on the future amendment in §P)
- the value → engine contract

**Out of scope:**
- **Values not stored in V1:**
  - measured test results
  - calculated-value write-back
  - goals, conditions and rule parameters
  - currency and the financial domain
- **Deferred architecture:**
  - configuration versions and Test Setup linkage
  - Component Attribution (#29)
  - correlation / active value
  - `input_value_ids`
- **Fields not yet admitted:**
  - no-unit fields (#20)
  - all fields in §R
- **Separate work:** F1 defect remediation

## C. Frozen architectural dependencies

**Unchanged by V1:**
- F1.12.3
- engine 1.1.0
- CALCULATION-FOUNDATION-1.0.0
- DATA-FOUNDATION-1.0.0
- MAPPING-FOUNDATION-1.0.0
- GARAGE-FOUNDATION-1.0.0

**Governing decisions:**
- P1, P6, O2, A1, P2-V1, P4
- OWN-1 … OWN-9B
- OWN-A / B
- Owner Decisions 1 and 2 (final)
- G-1, G-2, G-3, G-5, G-6
- **D-002** (`DECISIONS.md` line 76)

**Required future dependency:** a DATA-FOUNDATION amendment / version for server-authoritative value writes (§P).

## D. 48-field / 47-quantity admission list

**Exact:** reproduced from `VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv`.

**Terminology (used consistently throughout):**
- **Field admission:** a frozen source field (a calculator input) is admitted to the Value Foundation.
- **Canonical quantity:** the physical engineering quantity that the admitted field represents.
- **Canonical key:** the permanent key identifying that quantity.
- **Multiple source fields may map to one canonical quantity** when their engineering identity is proven identical.

**For V1: 48 admitted source-field rows → 47 canonical quantity keys.** The one shared identity is `vehicle_cg_height` ← `center_of_gravity_height__in` (anti_squat) and `vehicle_cg_height__in` (anti_dive). **48 rows don't mean 48 canonical fields.**
- **Approved renames applied:**
  - `supercharger_drive_ratio` → `supercharger_to_crank_speed_ratio`
  - `clutch_required_release_force` → `clutch_release_force`

| # | Canonical key | Draft field | Engine key | Storage = engine-native unit | Valid input / display units | Quantity kind |
|---|---|---|---|---|---|---|
| 1 | `ac_compressor_pulley_diameter` | `compressor_pulley_diameter__in` | `ac_compressor.cpd` | in | in, mm | length (diameter) |
| 2 | `ac_drive_crank_pulley_diameter` | `crank_pulley_diameter__in` | `ac_compressor.ppd` | in | in, mm | length (diameter) |
| 3 | `block_deck_height` | `block_deck_height__in` | `deck_height.b` | in | in, mm | length |
| 4 | `clutch_clamp_load` | `clamp_load__lbf` | `clutch_torque_capacity.clamp` | lbf | lbf, N | force |
| 5 | `clutch_disc_mean_effective_radius` | `mean_effective_radius__in` | `clutch_torque_capacity.mean` | in | in, mm | length (radius) |
| 6 | `clutch_fork_pivot_to_pushrod` | `pivot_to_pushrod__in` | `clutch_fork_ratio.push` | in | in, mm | length |
| 7 | `clutch_fork_pivot_to_release_bearing` | `pivot_to_release_bearing__in` | `clutch_fork_ratio.pivot` | in | in, mm | length |
| 8 | `clutch_pedal_arm_length` | `pedal_arm_length__in` | `clutch_pedal_ratio.input` | in | in, mm | length |
| 9 | `clutch_pedal_pivot_to_pushrod` | `pushrod_distance_from_pivot__in` | `clutch_pedal_ratio.output` | in | in, mm | length |
| 10 | `clutch_release_force` | `required_release_force__lbf` | `clutch_pedal_effort.release` | lbf | lbf, N | force |
| 11 | `clutch_slave_cylinder_bore` | `slave_cylinder_bore__in` | `clutch_hydraulic_ratio.slave` | in | in, mm | length (bore diameter) |
| 12 | `crankshaft_main_journal_diameter` | `main_journal_diameter__in` | `crank_journal_overlap.mj` | in | in, mm | length (diameter) |
| 13 | `crankshaft_rod_journal_diameter` | `rod_journal_diameter__in` | `crank_journal_overlap.rj` | in | in, mm | length (diameter) |
| 14 | `def_tank_capacity` | `def_tank__gal` | `diesel_def_range.tank` | gal | gal (US), L | volume (capacity) |
| 15 | `front_overhang_lowest_point_height` | `front_lowest_point_height__in` | `approach_departure_angle.fh` | in | in, mm | length (height) |
| 16 | `front_overhang_lowest_point_horizontal_offset` | `front_horizontal_offset__in` | `approach_departure_angle.fo` | in | in, mm | length |
| 17 | `front_suspension_side_view_ic_height` | `front_suspension_instant_center_height__in` | `anti_dive.icH` | in | in, mm | length (height) |
| 18 | `ground_clearance_at_mid_wheelbase` | `ground_clearance_at_center__in` | `breakover_angle.ground` | in | in, mm | length (height) |
| 19 | `harmonic_balancer_diameter` | `balancer_diameter__in` | `timing_mark.bore5` | in | in, mm | length (diameter) |
| 20 | `head_gasket_compressed_thickness` | `compressed_gasket_thickness__in` | `head_gasket_vol.comp_thick` | in | in, mm | length (thickness) |
| 21 | `intake_port_effective_flow_area` | `effective_flow_area__sq_in` | `mach_index.mi_a` | sq in | sq in, mm², cm² | area |
| 22 | `jpipe_resonator_diameter` | `pipe_diameter__in` | `jpipe_resonator.dia_jp` | in | in, mm | length (diameter) |
| 23 | `lf_front_view_ic_height` | `lf_instant_center_height__in` | `ct_moment_center.lf_mc` | in | in, mm | length (height) |
| 24 | `lf_front_view_ic_lateral_distance` | `lf_ic_distance_from_center__in` | `ct_moment_center.lf_track` | in | in, mm | length |
| 25 | `lr_jacking_screw_thread_pitch` | `bolt_thread_pitch__tpi` | `ct_jacking_bolt.thread_pitch` | TPI | TPI (display only; thread-pitch-in-mm is a reciprocal, not a factor — not in V1) | count per length (threads/in) |
| 26 | `max_steer_angle_inside_wheel` | `max_steer_angle_inside_wheel__deg` | `turning_radius.steer_angle` | ° | ° (no alternate in V1) | angle |
| 27 | `panhard_bar_height_at_axle` | `panhard_bar_height_at_axle__in` | `ct_panhard_roll.ph_ht` | in | in, mm | length (height) |
| 28 | `panhard_bar_length` | `panhard_bar_length__in` | `rc_watt_link.ph_len` | in | in, mm | length |
| 29 | `piston_compression_height` | `piston_compression_height__in` | `deck_height.p` | in | in, mm | length |
| 30 | `piston_crown_volume` | `piston_volume_dome_per_dish__cc` | `static_compression.piston` | cc | cc, cu in | volume |
| 31 | `portal_hub_drop_height` | `portal_drop_height__in` | `portal_gear_reduction.pgr_drop` | in | in, mm | length |
| 32 | `portal_hub_reduction_ratio` | `portal_reduction_ratio__to_1` | `portal_gear_reduction.pgr_portal` | :1 | (dimensionless — no conversion) | speed reduction ratio |
| 33 | `pressure_plate_release_lever_ratio` | `release_lever_ratio__to_1` | `clutch_release_force.lever` | :1 | (dimensionless — no conversion) | lever (force) ratio (clamp/release; formula spring/lever) |
| 34 | `rear_overhang_lowest_point_height` | `rear_lowest_point_height__in` | `approach_departure_angle.rh` | in | in, mm | length (height) |
| 35 | `rear_overhang_lowest_point_horizontal_offset` | `rear_horizontal_offset__in` | `approach_departure_angle.ro` | in | in, mm | length |
| 36 | `rear_suspension_side_view_ic_height_at_reference_wheelbase` | `instant_center_height_at_reference_wheelbase__in` | `anti_squat.ic` | in | in, mm | length (height) |
| 37 | `rf_front_view_ic_height` | `rf_instant_center_height__in` | `ct_moment_center.rf_mc` | in | in, mm | length (height) |
| 38 | `rf_front_view_ic_lateral_distance` | `rf_ic_distance_from_center__in` | `ct_moment_center.rf_track` | in | in, mm | length |
| 39 | `supercharger_to_crank_speed_ratio` | `pulley_ratio_sc_to_crank__to_1` | `supercharger_speed.cr3` | :1 | (dimensionless — no conversion) | speed ratio (SC speed / crank speed; formula rpm8*cr3) |
| 40 | `torque_converter_stall_torque_ratio` | `torque_multiplication__to_1` | `torque_converter.mult` | :1 | (dimensionless — no conversion) | torque ratio (output/input torque) |
| 41 | `traction_battery_gross_energy` | `battery_energy__kwh` | `ev_range.batt` | kWh | kWh | energy |
| 42 | `transfer_case_low_range_ratio` | `low_range_ratio__to_1` | `crawl_ratio.la` | :1 | (dimensionless — no conversion) | speed reduction ratio (input/output speed) |
| 43 | `vehicle_cg_height` | `center_of_gravity_height__in` | `anti_squat.cg` | in | in, mm | length (height) |
| 44 | `vehicle_cg_height` | `vehicle_cg_height__in` | `anti_dive.cgH` | in | in, mm | length (height) |
| 45 | `vehicle_cg_lateral_from_left_side` | `cg_y_from_left_side__in` | `cg_3d.y` | in | in, mm | length |
| 46 | `vehicle_cg_longitudinal_from_front_axle` | `cg_x_from_front_axle__in` | `cg_3d.x` | in | in, mm | length |
| 47 | `vehicle_side_projected_area` | `side_area__sq_ft` | `crosswind_force.area2` | sq ft | sq ft, m² | area |
| 48 | `vehicle_wheelbase` | `wheelbase_for_rear_steer_angle__in` | `rc_watt_link.ph_wb` | in | in, mm | length (wheelbase) |

**Storage (= engine-native) units, per field:** `in` 34 · `:1` 5 · `lbf` 2 · `cc` 1 · `gal` 1 · `sq in` 1 · `sq ft` 1 · `kWh` 1 · `TPI` 1 · `°` 1 = **48**.

## E. Complete canonical key table (47)

`ac_compressor_pulley_diameter`, `ac_drive_crank_pulley_diameter`, `block_deck_height`, `clutch_clamp_load`, `clutch_disc_mean_effective_radius`, `clutch_fork_pivot_to_pushrod`, `clutch_fork_pivot_to_release_bearing`, `clutch_pedal_arm_length`, `clutch_pedal_pivot_to_pushrod`, `clutch_release_force`, `clutch_slave_cylinder_bore`, `crankshaft_main_journal_diameter`, `crankshaft_rod_journal_diameter`, `def_tank_capacity`, `front_overhang_lowest_point_height`, `front_overhang_lowest_point_horizontal_offset`, `front_suspension_side_view_ic_height`, `ground_clearance_at_mid_wheelbase`, `harmonic_balancer_diameter`, `head_gasket_compressed_thickness`, `intake_port_effective_flow_area`, `jpipe_resonator_diameter`, `lf_front_view_ic_height`, `lf_front_view_ic_lateral_distance`, `lr_jacking_screw_thread_pitch`, `max_steer_angle_inside_wheel`, `panhard_bar_height_at_axle`, `panhard_bar_length`, `piston_compression_height`, `piston_crown_volume`, `portal_hub_drop_height`, `portal_hub_reduction_ratio`, `pressure_plate_release_lever_ratio`, `rear_overhang_lowest_point_height`, `rear_overhang_lowest_point_horizontal_offset`, `rear_suspension_side_view_ic_height_at_reference_wheelbase`, `rf_front_view_ic_height`, `rf_front_view_ic_lateral_distance`, `supercharger_to_crank_speed_ratio`, `torque_converter_stall_torque_ratio`, `traction_battery_gross_energy`, `transfer_case_low_range_ratio`, `vehicle_cg_height`, `vehicle_cg_lateral_from_left_side`, `vehicle_cg_longitudinal_from_front_axle`, `vehicle_side_projected_area`, `vehicle_wheelbase`

**Naming rules (final):**
- A key names the **quantity** (subject + quantity), in lower snake case, satisfying the frozen `^[a-z][a-z0-9_]*$`.
- **Never** a unit slug, a calculator id, a value role, a condition or a configuration version.
- **Keys are permanent** once referenced (frozen `ON DELETE RESTRICT`).
- MAPPING-FOUNDATION draft keys are labels only.

## F. Quantity identity definitions

**Identity (P1)** = quantity kind + subject + basis + characteristic.
- **Never identity by themselves:** calculator, input / output role, value role, source / method, unit spelling, display unit, configuration, operating condition.
- **A qualifier becomes identity** only when changing it changes the thing represented (O2).
- **Multi-instance criterion (Owner Decision 1):** a subject is multi-instance when one machine can legitimately carry *different* values for different instances. **Identical repeated design parts** (pistons, crank journals, intake ports of one head design, portal hubs) are one design value.

**Per-key definitions:**
- **`ac_compressor_pulley_diameter`**: A/C compressor pulley — length (diameter); basis: —; characteristic: nominal
- **`ac_drive_crank_pulley_diameter`**: crank pulley (A/C drive) — length (diameter); basis: —; characteristic: nominal
- **`block_deck_height`**: engine block — length; basis: crank centerline to deck (deck_height formula b-(s/2)-r-p); characteristic: nominal
- **`clutch_clamp_load`**: clutch pressure plate — force; basis: —; characteristic: nominal
- **`clutch_disc_mean_effective_radius`**: clutch disc friction surface — length (radius); basis: mean effective; characteristic: nominal
- **`clutch_fork_pivot_to_pushrod`**: clutch fork — length; basis: from pivot; characteristic: nominal
- **`clutch_fork_pivot_to_release_bearing`**: clutch fork — length; basis: from pivot; characteristic: nominal
- **`clutch_pedal_arm_length`**: clutch pedal — length; basis: pivot to pad (calculator clutch_pedal_ratio); characteristic: nominal
- **`clutch_pedal_pivot_to_pushrod`**: clutch pedal — length; basis: from pivot; characteristic: nominal
- **`clutch_release_force`**: Force at the clutch release mechanism required to disengage the clutch (input of clutch_pedal_effort; same quantity as the Estimated Release Force output of clutch_release_force = pressure-plate load / release-lever ratio); distinct from clamp load and pressure-plate load
- **`clutch_slave_cylinder_bore`**: clutch slave cylinder — length (bore diameter); basis: —; characteristic: nominal
- **`crankshaft_main_journal_diameter`**: crankshaft main journal — length (diameter); basis: —; characteristic: nominal
- **`crankshaft_rod_journal_diameter`**: crankshaft rod journal — length (diameter); basis: —; characteristic: nominal
- **`def_tank_capacity`**: DEF tank — volume (capacity); basis: —; characteristic: capacity quantity
- **`front_overhang_lowest_point_height`**: vehicle front overhang — length (height); basis: lowest point; characteristic: static
- **`front_overhang_lowest_point_horizontal_offset`**: vehicle front overhang — length; basis: horizontal, tire contact to lowest point (formula); characteristic: static
- **`front_suspension_side_view_ic_height`**: front suspension — length (height); basis: SIDE-VIEW instant center (anti-dive, icH/cgH); characteristic: nominal
- **`ground_clearance_at_mid_wheelbase`**: vehicle — length (height); basis: at mid-wheelbase (breakover geometry); characteristic: static
- **`harmonic_balancer_diameter`**: harmonic balancer — length (diameter); basis: outside diameter (timing tape); characteristic: nominal
- **`head_gasket_compressed_thickness`**: head gasket — length (thickness); basis: compressed (vs free) — label; characteristic: nominal
- **`intake_port_effective_flow_area`**: cylinder-head intake port — area; basis: "effective" flow area (vs geometric) per label; which port NOT STATED; characteristic: nominal
- **`jpipe_resonator_diameter`**: J-pipe resonator diameter, defined as the **inside diameter**. **ENGINEERING INTERPRETATION FROM FROZEN FORMULA:** the frozen formula uses the diameter to calculate the enclosed chamber volume (`Chamber Volume = (π/4)·d²·L/61.024`), so the engineering interpretation is the inside diameter. **This isn't explicit frozen help-text evidence** (the frozen label is only "Pipe Diameter"), and it **requires engineering sign-off at formal approval** (§V).
- **`lf_front_view_ic_height`**: LF suspension — length (height); basis: FRONT-VIEW instant center (moment-center construction); characteristic: nominal
- **`lf_front_view_ic_lateral_distance`**: LF suspension — length; basis: lateral, from centerline (front view); characteristic: nominal
- **`lr_jacking_screw_thread_pitch`**: LR spring-perch jacking screw — count per length (threads/in); basis: —; characteristic: nominal
- **`max_steer_angle_inside_wheel`**: steering (inside wheel) — angle; basis: —; characteristic: extremum (maximum steer)
- **`panhard_bar_height_at_axle`**: panhard bar — length (height); basis: at axle end; characteristic: nominal
- **`panhard_bar_length`**: panhard bar — length; basis: —; characteristic: nominal
- **`piston_compression_height`**: piston — length; basis: pin centerline to crown; characteristic: nominal
- **`piston_crown_volume`**: Piston crown volume; SIGN: dome = positive, dish = negative (frozen label "+dome / -dish"; clearance = chamber + gasket - piston)
- **`portal_hub_drop_height`**: portal hub — length; basis: —; characteristic: nominal
- **`portal_hub_reduction_ratio`**: portal hub gearing — speed reduction ratio; basis: —; characteristic: nominal
- **`pressure_plate_release_lever_ratio`**: pressure-plate release levers — lever (force) ratio (clamp/release; formula spring/lever); basis: —; characteristic: nominal
- **`rear_overhang_lowest_point_height`**: vehicle rear overhang — length (height); basis: lowest point; characteristic: static
- **`rear_overhang_lowest_point_horizontal_offset`**: vehicle rear overhang — length; basis: horizontal, tire contact to lowest point; characteristic: static
- **`rear_suspension_side_view_ic_height_at_reference_wheelbase`**: rear suspension — length (height); basis: side-view IC projected at reference wheelbase; characteristic: nominal
- **`rf_front_view_ic_height`**: RF suspension — length (height); basis: FRONT-VIEW instant center; characteristic: nominal
- **`rf_front_view_ic_lateral_distance`**: RF suspension — length; basis: lateral, from centerline (front view); characteristic: nominal
- **`supercharger_to_crank_speed_ratio`**: Supercharger speed / crank (engine) speed (frozen: Supercharger RPM = Engine RPM x ratio)
- **`torque_converter_stall_torque_ratio`**: torque converter — torque ratio (output/input torque); basis: at stall; characteristic: characteristic state (stall)
- **`traction_battery_gross_energy`**: traction battery — energy; basis: gross (usable % applied separately in ev_range); characteristic: capacity quantity
- **`transfer_case_low_range_ratio`**: transfer case low range — speed reduction ratio (input/output speed); basis: —; characteristic: nominal
- **`vehicle_cg_height`**: Vehicle centre-of-gravity height above ground (shared by anti_squat and anti_dive)
- **`vehicle_cg_lateral_from_left_side`**: vehicle CG — length; basis: lateral from left side; characteristic: static
- **`vehicle_cg_longitudinal_from_front_axle`**: vehicle CG — length; basis: longitudinal from front axle; characteristic: static
- **`vehicle_side_projected_area`**: vehicle — area; basis: side projected area; characteristic: nominal
- **`vehicle_wheelbase`**: Vehicle wheelbase (Watts-link use "for rear-steer angle" is use, not identity; Phase-2 wheelbase__in will map here after its own review)

## G. Unit / storage / display model

**Seven distinct concepts, never conflated:**
- **A. Engineering quantity:** unit-independent.
- **B. Canonical key:** names the quantity.
- **C. Stored value:** a `value_records` row.
- **D. Stored unit:** the storage / engine-native unit, held in the frozen DATA-FOUNDATION column `canonical_unit`. (The column name is historical; it holds the storage unit, not the engineering identity.)
- **E. Engine-native unit:** of the mapped engine key; D = E by **D-002** and `DF_UNIT`.
- **F. Valid input / display units:** any unit of the quantity's kind that the conversion table supports.
- **G. Normalization:** F → D, performed **only** on the trusted write path. That path is a future capability requiring the §P amendment.

**D-002 (frozen):**
- Canonical storage units = engine-native units.
- Stored value → engine → unit-conversion layer → user display preference.
- Storage units ≠ display units.
- Existing calculator conventions are preserved.
- `GH_ENGINE` never converts.

**The adapter never converts.**

**Wheel offset (the required pattern, currently deferred; §Q):**
- **Engineering quantity:** wheel offset.
- **Physical meaning:** distance from the hub mounting face to the rim centerline; **positive offset pushes the wheel inward** (frozen sign).
- **Valid representations:** inches, millimetres.
- **Frozen storage / engine-native unit:** millimetres, a D-002 storage convention. **The storage / engine-native unit does not define the engineering identity of the quantity;** wheel offset is unit-independent.
- **Excluded from Phase 1** because front / rear values may differ (multi-instance), **not because of units.**

## H. Conversion contract

**Every pair required by the admitted set.** These are exact definitions, **not taken from the F1 page**:

| Quantity kind | Input / display unit ↔ storage unit | Exact definition | Direction rule | Zero / negative | Test vectors |
|---|---|---|---|---|---|
| length | mm ↔ in (storage `in`) | 1 in = 25.4 mm | to storage: mm ÷ 25.4; to display: in × 25.4 | 0 → 0; sign preserved | 25.4 mm → 1 in; 1 in → 25.4 mm; −12.7 mm ↔ −0.5 in; round trip 1 in → 25.4 mm → 1 in |
| force | N ↔ lbf (storage `lbf`) | 1 lbf = 4.4482216152605 N (0.45359237 kg × 9.80665 m/s²) | N ÷ 4.4482216152605 | the same | 4.4482216152605 N ↔ 1 lbf |
| volume | L ↔ gal US (storage `gal`) | 1 gal = 3.785411784 L (231 in³ × 16.387064 cm³ / in³) | L ÷ 3.785411784 | the same | 3.785411784 L ↔ 1 gal |
| volume | cu in ↔ cc (storage `cc`) | 1 in³ = 16.387064 cc | in³ × 16.387064 | the same (the piston-crown sign is preserved) | 1 in³ ↔ 16.387064 cc; −5 cc stays −5 cc |
| area | mm² / cm² ↔ sq in (storage `sq in`) | 1 in² = 645.16 mm² = 6.4516 cm² | mm² ÷ 645.16; cm² ÷ 6.4516 | the same | 645.16 mm² ↔ 1 in² |
| area | m² ↔ sq ft (storage `sq ft`) | 1 ft² = 0.09290304 m² | m² ÷ 0.09290304 | the same | 0.09290304 m² ↔ 1 ft² |
| ratio, angle, energy, thread count | `:1`, `°`, `kWh`, `TPI` | **no conversion in V1** (TPI ↔ thread-pitch-in-mm is a reciprocal relation, not a factor) | — | — | identity |

**Rules:**
- **Convert only by multiplying or dividing by the exact factor.** Never by a rounded reciprocal.
- **Stored values are never rounded** (IEEE-754 binary64).
- **These are rejected, and nothing is stored:**
  - an unknown or unsupported unit for the field's kind
  - a non-finite input
  - a non-finite or out-of-range result
- **Required regression vector** (against F1 defect D-1): a value entered as millimetres must store its exact equivalent, never a ×25.4 or ÷25.4 mis-scaling.

## I. Display precision / rounding

- **Display precision:** **6 significant digits** for all 47 quantities.
  - Frozen evidence: `fieldDisplayValue` uses `toPrecision(6)` and explicitly protects small defaults from being rewritten.
  - No field declares a finer step.
  - A future explicit engineering policy may override an individual field.
- **Rounding:** **half away from zero** on the exact stored binary value (ECMAScript `toPrecision` semantics). Examples:
  - 2.5 → 3
  - −2.5 → −3
  - 0.125 → 0.13
  - known binary caveat: **1.005 may display as 1.00**
- **Locale separators are presentation only.**
- **Display never alters stored values.**

## J. Value roles

- **The only V1 canonical stored role: SPECIFICATION** (context `specification`).
- **Calculated results remain `calculation_records`.** There's no automatic promotion.
- **Measured static configuration** (a dimension, geometry or setup value, or a static weight in a stated state) may be stored as a specification, with provenance `measured` (OWN-3).
- **Not in V1:**
  - measured performance / test results
  - correlation, active, validation or target values
  - calculated write-back

## K. UNKNOWN / ZERO / DEFAULT

- **UNKNOWN ≠ ZERO ≠ DEFAULT.**
- **Unknown** = no value, with provenance `unknown`.
- **Zero** = a known 0. For example, `driveshaft_tube_inside_diameter = 0` would mean solid, but that field is deferred.
- **A default is never stored or supplied.**
- **Blank client input never becomes a machine value.** The Value Foundation follows the frozen engine semantics, not the F1 blank → default behaviour (D-5).

## L. Current-value rule

- **The frozen rule applies:** the newest non-superseded value per (machine, component = NULL, field, context) is current (`DATA-FOUNDATION.md` line 62; OWN-9A).
- **No provenance priority** in V1.
- **`input_value_ids` stays deferred** (OWN-9B).

## M. Provenance

- **Allowed in V1:** `user_entered`, `manufacturer_specified`, `estimated`, `measured` (static configuration only), `unknown`.
- **Not used in V1:** `calculated` / `derived`.
- **`source`** keeps its frozen meaning (the channel).
- **The original entered value / unit isn't stored in V1** (G-5). An input-audit record is future scope.
- **`canonical_fields.dimension` stays NULL** (G-3). The quantity kind lives in this specification.

## N. Categorical values

- **No categorical field is in the 48-field Phase 1.**
- **Approved for future admission:** `bearing_type` is a component property, stored as `ball` / `roller`. The adapter maps it to the engine tokens `3` / `3.33`.
- **The model exponent is never stored as the machine value.**
- **Its admission requires the #16b categorical-unit representation.**
- **No new categorical coercion.**

## O. Value → engine contract

1. **Mapping:** only frozen mapped engine keys of **admitted** fields are fed, one engine key per admitted field (§D).
2. **No competing calculation logic** in the Value Foundation.
3. **No unit conversion in the calculation adapter:** stored values are engine-native.
4. **Unknown or absent** means nothing is supplied, giving `INCOMPLETE`.
5. **Explicit request inputs** take precedence and never modify stored values.
6. **Goals, conditions and rule / policy parameters** are always explicit request inputs.
7. **Ambiguous, unadmitted or deferred fields** are never auto-fed.
8. **Selection** follows the current-value rule (§L).
9. **Categoricals** follow the approved categorical contract (future).
10. **Ownership and soft-delete rejections** follow the frozen architecture (composite foreign keys, RLS, Decision B).
11. **Only proven calculators** (the frozen authority gate).
12. **`input_value_ids` isn't populated.**

## P. Server-authoritative normalization amendment

(OWNER DECISION: an implementation dependency, not implemented here.)

**Frozen current behaviour:**
- Authenticated clients may insert their own `value_records` directly: `GRANT SELECT, INSERT … TO authenticated` and policy **`df_values_insert`** (DATA-FOUNDATION `0004_rls.sql` lines 78–83; proven by `df.test.js` line 198, *"owner inserts own value"*).
- `DF_UNIT` compares unit **strings** only. It can't prove a number was correctly converted.

**Required future amendment:** a separate, versioned DATA-FOUNDATION revision with its own test suite and evidence. **DATA-FOUNDATION-1.0.0 stays frozen, tagged and unedited, and its historical 219 / 219 evidence is unchanged.** The amendment:
- Withdraw the authenticated `INSERT` on `value_records` and remove `df_values_insert`.
- **Keep** `SELECT` own (`df_values_select`) and every frozen trigger, constraint and foreign key.

**The trusted write path** (service role, as for `calculation_records`, CALCULATION-FOUNDATION D1 / D6) must:
- derive the owner from verified authentication
- validate the canonical field (admitted only) and the supplied unit
- validate the numeric value
- convert exactly (§H)
- validate the result
- enforce the engine-native storage unit
- reject invalid input
- persist only the normalized value

**The client may convert for immediate display only; it isn't authoritative. The F1 page conversion code isn't reused.**

**Flow:**
```
CLIENT → value + user-selected unit → TRUSTED NORMALIZATION/VALIDATION (service role)
      → engine-native storage unit → value_records (DF_UNIT, FKs, append-only)
      → value→engine adapter (no conversion) → frozen CALCULATION SERVICE → GH_ENGINE
```

## Q. Multi-instance exclusions (19)

Deferred to Component Attribution (#29):
- **No qualified or representative-instance fields.**
- **No implicit averages.**
- **Nothing pre-implemented.**

| Draft field | Engine key | Set |
|---|---|---|
| `arm_length__in` | `ct_sway_bar.sb_arm` | previously identified (Decision 1) |
| `bar_length_between_arms__in` | `ct_sway_bar.sb_len` | previously identified (Decision 1) |
| `bar_wire_diameter__in` | `ct_sway_bar.sb_wire` | previously identified (Decision 1) |
| `caliper_piston_bore__in` | `brake_hydraulic_ratio.cal` | previously identified (Decision 1) |
| `caster_angle__deg` | `mech_trail.ca2` | previously identified (Decision 1) |
| `rocker_ratio__to_1` | `valve_lash.rocker_r` | previously identified (Decision 1) |
| `shock_collapsed_length__in` | `shock_length.col_sh` | previously identified (Decision 1) |
| `suspension_wheel_travel__in` | `shock_length.travel_sh` | previously identified (Decision 1) |
| `throat_diameter__in` | `valve_throat_area.vta_d` | previously identified (Decision 1) |
| `valve_lash__in` | `lash_net_lift.lnl_l` | previously identified (Decision 1) |
| `backspace__in` | `wheel_offset.backspace` | newly identified (removed from 58) |
| `inside_diameter_0_if_solid__in` | `driveshaft_critical.id_dc` | newly identified (removed from 58) |
| `inside_diameter__in` | `fuel_line_loss.line_id` | newly identified (removed from 58) |
| `loaded_tire_radius__in` | `mech_trail.tr_mt` | newly identified (removed from 58) |
| `or_enter_offset_to_get_backspace__mm` | `wheel_offset.offset_in` | newly identified (removed from 58) |
| `outside_diameter__in` | `driveshaft_critical.od_dc` | newly identified (removed from 58) |
| `section_width__mm` | `tire_size.tw` | newly identified (removed from 58) |
| `wheel_diameter__in` | `tire_size.wr` | newly identified (removed from 58) |
| `wing_per_splitter_area__sq_ft` | `rc_downforce.area` | newly identified (removed from 58) |

## R. Deferred fields

**All other non-admitted candidates** (the full reasons are in `VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv`):

| Draft field | Category |
|---|---|
| `engine_torque_at_stall__lb_ft` | ENGINEERING REVIEW REQUIRED |
| `exhaust_opens_bbdc__deg` | ENGINEERING REVIEW REQUIRED |
| `exhaust_valve_opening_deg_bbdc__deg` | ENGINEERING REVIEW REQUIRED |
| `front_ride_height__in` | ENGINEERING REVIEW REQUIRED |
| `installed_advance_per_retard__deg` | ENGINEERING REVIEW REQUIRED |
| `intake_closes_abdc__deg` | ENGINEERING REVIEW REQUIRED |
| `intake_closing_angle_abdc__deg` | ENGINEERING REVIEW REQUIRED |
| `intake_valve_closing_after_bdc__deg_abdc` | ENGINEERING REVIEW REQUIRED |
| `left_tire_circumference__in` | ENGINEERING REVIEW REQUIRED |
| `pressure_plate_load__lbf` | ENGINEERING REVIEW REQUIRED |
| `rear_ride_height__in` | ENGINEERING REVIEW REQUIRED |
| `right_tire_circumference__in` | ENGINEERING REVIEW REQUIRED |
| `shaft_length__in` | ENGINEERING REVIEW REQUIRED |
| `center_to_center_distance__in` | IDENTITY UNRESOLVED |
| `countersink_included_angle__deg` | IDENTITY UNRESOLVED |
| `height__in` | IDENTITY UNRESOLVED |
| `large_pulley_diameter__in` | IDENTITY UNRESOLVED |
| `length__in` | IDENTITY UNRESOLVED |
| `one_way_wire_length__ft` | IDENTITY UNRESOLVED |
| `original_bolt_per_thread_size__in` | IDENTITY UNRESOLVED |
| `original_threads_per_inch__tpi` | IDENTITY UNRESOLVED |
| `r1__ohm` | IDENTITY UNRESOLVED |
| `r2__ohm` | IDENTITY UNRESOLVED |
| `r3__ohm` | IDENTITY UNRESOLVED |
| `screw_head_diameter__in` | IDENTITY UNRESOLVED |
| `small_pulley_diameter__in` | IDENTITY UNRESOLVED |
| `wheel_center_offset__in` | IDENTITY UNRESOLVED |
| `width__in` | IDENTITY UNRESOLVED |
| `amount_milled__in` | NOT A VALID CANONICAL FIELD |
| `average_tire_circumference__in` | NOT A VALID CANONICAL FIELD |
| `hydraulic_ratio__to_1` | NOT A VALID CANONICAL FIELD |
| `next_gear_ratio__to_1` | NOT A VALID CANONICAL FIELD |
| `king_pin_arm_kpa__in` | REMOVED FROM 58 — UNRESOLVED DATUM |

**`king_pin_arm`:**
- **Why deferred:** frozen evidence defines it only through `Scrub Radius = wc − kpa`, and no datum is established.
- **Admission requires:** an explicitly defined engineering reference. No conventional datum was imported.

**Beyond the 100:**
- the Phase-2 pool (116)
- 4 ambiguous
- 234 non-specification inputs
- 420 outputs
- currency
- the 48 no-unit items

## S. Future admission process

**Individually, never in bulk.** Each field requires:
1. established identity
2. subject
3. basis
4. characteristic
5. the unit / storage contract (storage = engine-native)
6. engine mapping (one key, identity transform, proven calculator)
7. ownership and multiplicity (the §F criterion)
8. an explicit recorded admission decision
9. regression evidence

**MAPPING-FOUNDATION drafts are never silently promoted.**

## T. F1 defect separation

These are F1 corrective-release items; **none is fixed through the Value Foundation, and no F1 code is reused:**
- **D-1:** metric mm mis-scaling
- **D-2:** metric kW mis-scaling
- **D-3:** pounds shown as kilograms
- **D-4:** trap-speed −3.0 fall-through
- **D-5:** blank → default
- **D-6:** profile overwrite (#33)

## U. Acceptance criteria

Specified here; not implemented.
1. **Admission:** exactly 48 fields / 47 keys, matching `VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv` byte for byte; no deferred field seeded.
2. **Identity uniqueness:** one key per quantity; `vehicle_cg_height` covers exactly its 2 fields.
3. **Key naming:** the regex; no unit slug, calculator id or role word; the renames present and the old names absent.
4. **Storage unit = engine-native** for every key; `DF_UNIT` passes.
5. **Display-unit independence:** the same stored value renders in every valid unit, and storage is unchanged by display.
6. **Exact conversion:** every §H vector passes bit-reproducibly; the direction rule holds; there are no rounded reciprocals.
7. **Zero and negative** behaviour per §H.
8. **Invalid conversion rejection:** unsupported unit, non-finite input, non-finite result.
9. **Display** at 6 significant digits, half away from zero, including the documented binary cases.
10. **UNKNOWN ≠ ZERO ≠ DEFAULT:** unknown supplies nothing, giving `INCOMPLETE`; zero is supplied as 0; blank is never stored.
11. **Current-value selection** (supersession and newest).
12. **Categorical:** none admitted; the bearing-type contract is documented for the future.
13. **Exclusions:** the 19 multi-instance fields and `king_pin_arm` are rejected by admission validation.
14. **Value → engine:** each key feeds exactly its engine key; the adapter performs no conversion; explicit inputs win.
15. **Server authority:** a direct authenticated `INSERT` on `value_records` is rejected after the amendment, and the trusted path is the only writer.
16. **F1 isolation:** the D-1 regression vector; no F1 code paths used.
17. **Frozen regressions:**
    - **Frozen baseline evidence, immutable:** F1 28 / 28; DATA-FOUNDATION-1.0.0 **219 / 219**; MAPPING 83 plus generation check; GARAGE 81 / 28; CALCULATION 106 / 21. All remain reproducible against their frozen tags.
    - **Future amendment evidence:** the authorized DATA-FOUNDATION amendment / version and the Value Foundation milestone introduce **their own** versioned test suites, evidence, regression checks and acceptance criteria. DATA-FOUNDATION-1.0.0's historical suite and evidence aren't edited.
18. **Isolation gate:** frozen directories and all 12 tags byte-identical; determinism over 3 runs; negative controls; fresh-clone verification.

## V. Implementation gate

Implementation remains **unauthorized** until **all** of these hold:
1. Owner review of this final specification.
2. Formal owner approval recorded.
3. Engineering sign-off recorded, including:
   - **ENGINEERING SIGN-OFF REQUIRED:** `jpipe_resonator_diameter` = inside diameter.
   - **Reason:** derived from the frozen chamber-volume formula rather than explicit help-text wording. This is a documented engineering interpretation awaiting sign-off, not a request for another audit.
4. The DATA-FOUNDATION amendment / version explicitly authorized, with its delivery vehicle chosen.
5. The implementation milestone named (e.g. `VALUE-FOUNDATION-1.0.0`) with its directory.
6. The migration strategy reviewed: additive, idempotent seed; permanent keys.
7. The conversion table finalized (§H).
8. The 48-field seed finalized (§D).
9. Acceptance tests specified (§U).
10. **A separate implementation authorization issued.**

**This draft is not authorization.**

---

VALUE FOUNDATION V1: DRAFT — READY FOR FORMAL OWNER REVIEW

PHASE 1: 48 FIELDS / 47 DISTINCT QUANTITIES

DATA FOUNDATION: 1.0.0 REMAINS FROZEN · FUTURE SERVER-AUTHORITATIVE WRITE AMENDMENT REQUIRED

IMPLEMENTATION: NOT AUTHORIZED

REPOSITORY: UNCHANGED

HEAD: 4a404bed5148ef0abea86152ebb962c184f140aa

TAGS: 12

WORKING TREE: CLEAN
