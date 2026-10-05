# Gearhead Labs — Premium Engineering Expansion Catalog v1.0

Status: RESEARCH-QUALIFIED / ENGINEERING SPECIFICATION
Date: 2026-10-04

## Rule
Add a calculator only when it answers a distinct engineering question, decision, or workflow. Do not inflate counts with unit variants, cosmetic variants, or duplicate formulas.

## Tier A — Qualified engineering systems

### E-01 Turbo Compressor Map Builder
Purpose: generate/plot an engine operating line against a supplied compressor map.
Inputs: displacement, cylinders, VE or airflow curve, RPM range, inlet temperature/pressure, boost/target manifold pressure, pre/post compressor losses, compressor map data.
Outputs: corrected mass flow, pressure ratio, corrected speed, operating-line coordinates, efficiency interpolation where map data permits, map plot.
Notes: manufacturer map reference conditions must be retained; do not invent surge/choke limits.

### E-02 Turbo Surge/Choke Margin Analyzer
Purpose: quantify operating-point distance from supplied surge/choke boundaries.
Inputs: compressor map boundary data + operating points.
Outputs: normalized margin to surge, normalized margin to choke, warnings, worst operating point.
Rule: margin is map-specific; no universal safe percentage.

### E-03 Turbo Turbine Matching Analyzer
Purpose: assess turbine-side compatibility with engine/compressor demand.
Inputs: exhaust mass flow, turbine inlet pressure/temperature, turbine map or supplied efficiency data, target boost, turbine/compressor speed relationship where available.
Outputs: turbine operating points, estimated expansion ratio, turbine power/demand balance, mismatch warnings.
Rule: distinguish measured/map-based results from estimates.

### E-04 Turbo Pressure-Ratio Stack Analyzer
Purpose: calculate actual compressor pressure ratio after system losses.
Inputs: ambient absolute pressure, target manifold pressure, filter/inlet loss, intercooler loss, piping/throttle loss.
Outputs: compressor inlet/outlet absolute pressure, required compressor pressure ratio, loss budget.
Rule: all pressure ratios use absolute pressure.

### E-05 2-Stroke Port Time-Area Analyzer
Purpose: evaluate whether port area and timing support the target speed/flow.
Inputs: bore, stroke, rod ratio, port geometry, opening/closing angles, RPM.
Outputs: port area-vs-crank-angle, time-area, specific time-area, comparisons between exhaust/transfer/intake.
Validation: use crank-angle/time relationship and swept volume normalization.

### E-06 2-Stroke Blowdown Analyzer
Purpose: evaluate exhaust blowdown duration and area between exhaust opening and transfer opening.
Inputs: exhaust timing, transfer timing, port geometry, RPM, cylinder dimensions.
Outputs: blowdown angle, time, effective area/time-area, comparative bottleneck indicators.
Rule: present as engineering indicator, not an unsupported power prediction.

### E-07 2-Stroke Expansion-Chamber Reverse Analyzer
Purpose: work backward from an existing pipe to its principal tuned characteristics.
Inputs: cone lengths/angles, header diameter/length, stinger diameter/length, chamber diameter, engine timing/RPM.
Outputs: geometric section data, wave/reflection timing estimates, tuned-RPM indicators, sensitivity to dimensions.
Rule: clearly label acoustic-model assumptions.

### E-08 Valvetrain Dynamic Control Analyzer
Purpose: determine whether spring/valvetrain parameters provide adequate control at target RPM.
Inputs: valve mass, retainer/lock mass, rocker ratio, cam lift/profile or acceleration data, spring rates/preload, installed height, RPM.
Outputs: valve acceleration, inertial force estimates, spring force across lift, control-risk indicators.
Rule: measured cam profile data produces higher-confidence results than generic lift-only assumptions.

### E-09 Valve Spring Natural-Frequency / Surge Analyzer
Purpose: identify potential spring resonance/surge regions.
Inputs: spring dimensions, wire diameter, active coils, material properties, installed height, operating lift/RPM.
Outputs: estimated natural frequency, harmonics, operating-frequency ratio, resonance-risk zones.
Rule: flag simplified spring models and require empirical validation for final race-engine decisions.

### E-10 Suspension Kinematics Lab
Purpose: solve suspension geometry through wheel travel/steer rather than exposing many disconnected calculators.
Inputs: hard-point coordinates, wheel/tire geometry, chassis reference, suspension topology, steering inputs.
Outputs: instant centers, roll center, camber gain, toe/bump steer, track change, scrub, motion ratios, anti-dive/lift/squat where topology permits.
Rule: geometry solver first; derived metrics second.

### E-11 Driveline Dynamics Lab
Purpose: analyze real driveline geometry and shaft operating limits as one system.
Inputs: transmission/output position, pinion position, ride-height travel, shaft dimensions, RPM, joint geometry.
Outputs: operating angles, compound angle, angle change through travel, shaft critical-speed estimate, safety margin.
Rule: critical speed is a screening calculation, not a substitute for manufacturer shaft data.

### E-12 Radiator Heat-Rejection Analyzer
Purpose: estimate cooling-system heat rejection and identify limiting side of the exchanger.
Inputs: engine heat load, coolant flow, coolant properties, inlet/outlet temperatures, air flow, air temperature, core dimensions and/or UA assumptions.
Outputs: coolant heat rejection, air-side heat rise, required/available capacity, sensitivity to airflow and coolant flow.
Rule: expose assumptions and pressure-drop limitations separately.

### E-13 Intercooler Thermal / Pressure-Drop Analyzer
Purpose: quantify the tradeoff between charge cooling and restriction.
Inputs: compressor outlet conditions, ambient temperature, intercooler effectiveness or UA, charge-air flow, pressure-drop model/data.
Outputs: outlet temperature, density change, pressure loss, corrected engine airflow impact, heat rejection.
Rule: do not infer effectiveness from core size alone.

### E-14 Heat-Exchanger Matching Workbench
Purpose: common calculation engine for oil, coolant, transmission, intercooler and battery thermal exchangers.
Inputs: hot/cold-side flow, inlet temperatures, properties, UA/LMTD or effectiveness-NTU data.
Outputs: heat transfer, outlet temperatures, approach temperature, capacity ratio, limiting-side indicators.
Rule: one reusable engine with application-specific interfaces.

## Research basis
Turbocharger maps conventionally use pressure ratio versus corrected mass flow and are bounded by surge/choke behavior. Compressor-map interpolation and operating-line construction are established engineering workflows.
2-stroke time-area is the time integral of port area normalized by swept volume; crank-angle time conversion is 1/(6*RPM) seconds per degree when RPM is rev/min.
Suspension anti-effects derive from instant-center geometry, wheelbase and CG height; exact implementation depends on topology and brake/drive assumptions.

## Build policy
1. Map each candidate against the current premium registry before assigning a calculator ID.
2. Reject any candidate already represented by an equivalent workflow.
3. Build shared engines where multiple outputs arise from the same physical model.
4. Validate formulas against authoritative engineering references and known test cases.
5. Only after QA should a candidate enter the public calculator count.
6. Preserve the distinction between measured/map-based, modeled, and empirical results.

## Current decision
These 14 systems are qualified for engineering design/QA. They are NOT yet counted as public calculators.
