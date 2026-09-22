# Category reconciliation: 50 (architecture / live) vs 45 (spreadsheet)

**Result: no architectural category is empty. The discrepancy is a spreadsheet export defect.**

| Source | Categories | How counted |
|---|---|---|
| Live page (`CALCS` in F1.11.0) | **50** | distinct `cat` values in the navigation; every one has at least one live calculator |
| `Gearhead_Labs_Calculators_A-Z.xlsx` | 45 | 44 named categories + 1 blank |

The spreadsheet's Category cell is **blank for 26 calculators**, all of them diesel, which belong to these 6 live categories:

| Live category | Live calculators |
|---|---|
| DIESEL PERFORMANCE & EFFICIENCY | diesel_power_economy, diesel_bmep, diesel_torque_from_power, diesel_power_to_weight |
| DIESEL AIR & TURBO | diesel_airflow, diesel_boost_pr, diesel_intercooler, diesel_turbo_pr |
| DIESEL FUEL & INJECTION | diesel_bsfc, diesel_fuel_flow, diesel_power_from_fuel, diesel_injector_flow, diesel_afrlambda |
| DIESEL FUEL & ECONOMY | diesel_mpg, diesel_cost_per_mile, diesel_idle_cost, diesel_cost_per_hour, diesel_fuel_savings |
| DIESEL HEAVY EQUIPMENT | diesel_fuel_per_ton, diesel_fuel_per_cycle, diesel_fuel_per_acre, diesel_production_per_gallon, diesel_load_factor |
| DIESEL AFTERTREATMENT | diesel_def_cost, diesel_def_range, diesel_regen_cost |

50 − 6 + 1 (blank counted as a category) = **45**.

**Other checks:**
- The spreadsheet's 606 ids match the 606 live content entries exactly: no gaps, no duplicates.
- The navigation has 607 rows. The extra row is the Dashboard, which is not a calculator (Master Architecture §3).
- No calculators were added.

**Action:** regenerate the spreadsheet's Category column from the live page's `CALCS` data rather than editing it by hand.

Note: the Master Architecture PDF states 50 categories but does not enumerate them. The authoritative list is the live `CALCS` data (`[...new Set(CALCS.map(c=>c.cat))]` in the loaded page).
