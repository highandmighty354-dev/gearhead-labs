# Batch 14 — EV / Hybrid: Model Specification Review

**Revision 1.1, 2026-10-14 (documentation correction after Stage 1).** Revision 1.0 was the specification delivered to the owner on 2026-10-14. This revision corrects the Battery Pack Heat Balance transient (§2.1) and records how Stage 1 was implemented. Nothing else in the models changed.

**Erratum, §2.1 Battery Pack Heat Balance transient.** Revision 1.0 used τ = C ÷ UA = 900 s and gave a time to 35 °C of 1,018.26 s. **That result is superseded.**
- **Why it was wrong:** the model held the mean coolant temperature at its *steady* value from t = 0. At t = 0 that has 25 °C coolant heating a 25 °C pack at UA × (25 − 29.76) = −2,381 W, which violates the coolant's own energy balance.
- **The correction:** heat to the coolant is q = (T − T_in) ÷ R_sum, with R_sum = 1/UA + 1/(2 ṁ c_p). That gives τ = C × R_sum = 1,328.57 s, and the worked example reaches 35 °C in **1,503.15 s (25.05 min)**.
- **Independent checks:** Euler integration of the pack with the coolant balance gives 1,503.15 s. A two-node model with a small coolant mass gives 1,505.6 s at 2 kg and 1,503.4 s at 0.2 kg.
- **Unchanged:** the steady pack temperature (39.7619 °C) and the continuous capacity (3,387.10 W, 205.764 A). Both already used R_sum.
- The implemented calculator (`battery_pack_heat_balance`, commit `45a2177`) uses the corrected model.

**Stage 1 implementation notes.** These are differences from revision 1.0, all recorded in `docs/PREMIUM-CATALOG.md` ("Batch 14, stage 1").
- **Zero values accepted:** zero speed change (regen) and zero current (battery) give physically meaningful zeros, so they are accepted rather than rejected.
- **Entropic term:** evaluated at the pack temperature, which keeps the steady state and transient exact and linear.
- **Energy display:** regen energies have a page selector for kWh, Wh or kJ. The owner's Stage 1 authorization settled D-14-7 this way.
- **Unit conventions:** the owner's Stage 1 authorization set heat rows to W (`RETAIN-ACCESSORY`) and EV power to native kW.
- **No separate thermal helper:** a shared first-order helper was not introduced. The battery model is self-contained, and the regen model has no thermal part.

Specification only: no code, tests or repository documents were changed. Prepared 2026-10-14. Nothing in Batch 14 is authorized for implementation.

**Repository state at revision 1.0 (verified before and after that review).**

| Item | State |
|---|---|
| Branch | `premium/full-calculator-expansion` |
| HEAD | `87eb6c9` |
| Remote branch | in sync with HEAD |
| Working tree | clean |
| `main` | `a4203cd` |
| Engine | `F1_12_4_…batch9_1.html` (737 calculator-kind tools, 152 Premium calculators) |
| Open defects | GH-DEF-034 and GH-DEF-035 are OPEN and untouched |

**Evidence tags used below.**
- **[P]** published fact, with a source.
- **[E]** engineering recommendation made here.
- **[V]** verified here by an independent numerical method: a forward-Euler ODE integration, a brute-force time integration, or an energy balance. This is different from the closed form the calculator would use.

All worked values were produced by a standalone script, not by the engine.

---

## 1. Existing system: reuse and overlap

| Batch 14 item | Existing calculators (read in the engine) | What exists | What the new calculator adds | Overlap verdict |
|---|---|---|---|---|
| Battery Pack Heat Balance | `ev_battery_heat`, `ev_coolant_flow` | `ev_battery_heat`: Q = I²R (W). `ev_coolant_flow`: ṁ = Q ÷ (c_p ΔT) (kg/s) | Combines generation, coolant temperature rise and pack-to-coolant conductance. Adds a steady pack temperature, the continuous heat and current capacity to a limit, and a transient time-to-limit | Distinct (reconciliation #124, "combines generation + cooling capacity"). Reuse the formula of each, not the renderers; cross-link both |
| Motor Thermal Limit | `ev_motor_efficiency`, `ev_motor_power`, `ev_motor_torque` | Efficiency and power↔torque only; nothing thermal | Loss from the operating point, a thermal network, continuous versus time-limited operation | No overlap. Reuse the power-from-torque relation P = T ω |
| Inverter Thermal Load | `ev_inverter_loss`, `ev_power_conversion` | Loss = P_in − P_out (kW); AC = DC × η | Thermal consequences (coolant rise, heatsink and junction temperature) and an optional data-sheet device-loss model | Partial: a loss-only mode would duplicate `ev_inverter_loss`. **Mode A must add the thermal outputs** to be distinct [E] |
| DC Fast-Charge Time with CC-CV Taper | `ev_charge_time` (Free, `vd()` style), `ev_charge_added`, `ev_c_rate` | Time = energy ÷ (power × η): linear, no taper | CC phase to a voltage limit, then CV taper; current at target; I²R energy | Distinct (reconciliation #137). Show the linear estimate as a comparison row |
| Hybrid Power-Split Device Kinematics | `hybrid_power_split`, `planetary_gearset_ratio` (Batch 7) | `hybrid_power_split`: engine power = system × fraction. `planetary_gearset_ratio`: static ratio with one member fixed (ring-fixed 1 + R/S; sun-fixed 1 + S/R) | Two-degree-of-freedom Willis kinematics (all three members turning), the torque split, MG1/MG2 power flow | Distinct (exceptions-resolved B.1). Consistency check: with the ring held, the Willis equation gives 1 + R/S, the same as `planetary_gearset_ratio` [V] |
| Regenerative Braking Energy Recovery | `hybrid_regen_energy`, `ev_regen_power` (Free) | `hybrid_regen_energy`: E = P × η × t with braking power given. `ev_regen_power`: instantaneous P = W·a·v·η at one speed | Event energy from ½mv², capped by motor and battery power limits, a low-speed cutout and the regen-axle share; the friction share; a loss chain without double counting | Distinct (exceptions-resolved #9). Cross-link both; state that `ev_regen_power` is one instant and this is the whole stop |

**Engine conventions to follow.** These are the same as Batches 11 and 13:
- `RENDERS.id` built from `certValue`, `field`, `nativeField`, `selectField`, `multiResult` and `certError`;
- warnings in `help-note`;
- a registry entry, a `models.js` promo, engine self-tests (`T(...)`), a `structural-14` test file and `unit-system` cases.

**Categories** (all existing, so no navigation change):

| Category | Calculators |
|---|---|
| `EV / THERMAL` | Battery Pack Heat Balance, Motor Thermal Limit, Inverter Thermal Load |
| `EV / CHARGING & RANGE` | DC Fast-Charge Time |
| `EV / HYBRID & ALTERNATIVE ENERGY` | Hybrid Power-Split Device Kinematics, Regenerative Braking Energy Recovery |

**Unit infrastructure (read from `UNIT_DEFS`).**
- **Converted by system:** `°F ↔ °C`, `Δ°F ↔ Δ°C`, `lbs ↔ kg`, `lbs/min ↔ kg/min`, `mph ↔ km/h`, `in ↔ mm`. Power (`HP` ↔ kW) and torque (`lb-ft` ↔ N·m) are converted only through the GH-IMP-019 performance tokens (`PERF_ROWS`).
- **Unregistered and neutral** (same number and text in both systems): kW (native boxes), kWh, W, A, V, Ah, Ω, K/W, W/K, J/K, J/kg·K, s, min, hr, RPM, %.
- **Precedents to follow:**
  - battery heat is `W`, `RETAIN-ACCESSORY` (`ev_battery_heat`);
  - inverter loss is `kW`, `EV_POWER` (`ev_inverter_loss`);
  - deceleration is `g`, which needs `raw:true`.

---

## 2. Calculator specifications

### 2.1 Battery Pack Heat Balance — `battery_pack_heat_balance` (EV / THERMAL)

**Purpose.** Answers one question: for a stated current and stated cooling, where does the **average** pack temperature settle, how long until it reaches a limit, and what current can be held continuously?

**Boundaries.**
- It does not predict cell temperatures, gradients, hot spots, ageing or thermal runaway.
- It does not derive resistance or entropic data from chemistry; both are user inputs.

**Thermal boundary** [E]. The control volume is the cells, modules and cooling plates. One lumped temperature is assumed, and heat leaves only to the coolant through a conductance UA. Heat exchange with ambient is neglected; this is stated on the page and is conservative for a hot pack.

**Candidate models.**

| Candidate | Status | Basis | Reason |
|---|---|---|---|
| Joule only, I²R | Kept | — | The main term at high current, and what `ev_battery_heat` does |
| Bernardi general energy balance: q = I(U_oc − V) − I T (dU_oc/dT), sign + for discharge | Optional term | [P] Bernardi, Pawlikowski & Newman, J. Electrochem. Soc. 132(1), 5–12 (1985); refined by Rao & Newman, 144(8), 2697 (1997) | With a constant pack resistance, I(U_oc − V) = I²R. The entropic term needs dU/dT, which depends on chemistry and state of charge. **Optional input, default 0, labelled "omitted unless entered"** [E] |
| Steady state | Kept | — | — |
| Transient lumped capacitance | Kept | [P] Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer*, lumped-capacitance method | Valid only as a mean temperature (the pack Biot number is not small for cell interiors); stated |
| 1-D or 3-D cell models | Rejected | — | Data the user will not have |

**Selected: two outputs from one model** [E]. The steady state and the transient come from the same equations, so there are no separate modes.

1. **Current.** I comes from the current, or from the battery power as I = P ÷ V_pack (an input selector).
2. **Heat generated.** Q_gen = I²R_pack + Q_rev, with Q_rev = −I·T_K·(dU/dT)_pack.
   - I > 0 is discharge and I < 0 is charge, so Q_rev changes sign with direction [P Bernardi].
   - (dU/dT)_pack = (dU/dT)_cell × cells in series. The user enters the pack value; the help text explains the scaling.
3. **Coolant temperature rise.** ΔT_c = Q_gen ÷ (ṁ c_p); outlet T_c,out = T_in + ΔT_c; mean T_c,m = T_in + ΔT_c ÷ 2.
4. **Steady pack temperature.** T_ss = T_c,m + Q_gen ÷ UA.
5. **Continuous capacity to the limit.** Q_max = (T_lim − T_in) ÷ (1/UA + 1/(2ṁc_p)), giving the continuous current I_max = √(Q_max ÷ R) when Q_rev = 0.
6. **Transient (corrected in revision 1.1).** The heat reaching the coolant during warm-up is q = UA (T − T_c,m), where T_c,m = T_in + q ÷ (2ṁc_p). So q = (T − T_in) ÷ R_sum, with R_sum = 1/UA + 1/(2ṁc_p).
   - With C = m_pack c_pack: C dT/dt = Q_gen(T) − (T − T_in) ÷ R_sum.
   - The time constant is τ = C ÷ (I dU/dT + 1/R_sum). This is C × R_sum when dU/dT = 0.
   - Then T(t) = T_ss − (T_ss − T₀)e^(−t/τ), and the time to the limit is t_lim = τ ln((T_ss − T₀) ÷ (T_ss − T_lim)).
   - If I dU/dT + 1/R_sum ≤ 0 there is no steady state; that input is rejected with the reason.
   - *Revision 1.0 used τ = C ÷ UA, holding the coolant mean at its steady value from t = 0. That is superseded; see the erratum.*
   - If T_ss ≤ T_lim, the result reads "does not reach the limit".
   - If T₀ ≥ T_lim, the result reads "already at or above the limit".

**Inputs.**

| Input | Units | Example default | Validation |
|---|---|---|---|
| Pack current | A | 250 | Non-zero, ≤ 3,000 |
| Pack DC resistance | Ω | 0.08 | > 0, ≤ 5 |
| Pack dU/dT | V/K | 0 | \|·\| ≤ 1 |
| Coolant inlet temperature | °F ↔ °C | 25 °C (77 °F) | — |
| Coolant mass flow | lbs/min ↔ kg/min [E: registered pair; `ev_coolant_flow` used native kg/s] | 0.15 kg/s | > 0 |
| Coolant c_p | J/kg·K | 3,500 (50/50 glycol) | > 0 |
| Pack-to-coolant UA | W/K | 500 | > 0 |
| Pack mass | lbs ↔ kg | 450 kg | > 0 |
| Pack specific heat | J/kg·K | 1,000 | 300–3,000 |
| Initial pack temperature | °F ↔ °C | 25 °C | — |
| Pack temperature limit | °F ↔ °C | 35 °C | Above the coolant inlet temperature |

The 35 °C limit is an example, labelled per the example-default policy; a battery maker's limit governs.

**Outputs.**
- Heat generated (W).
- Coolant temperature rise (Δ°F ↔ Δ°C) and outlet temperature.
- Steady pack temperature.
- Continuous heat capacity (W) and continuous current (A).
- Thermal time constant (min).
- Time to the limit (min).

The heat rows are `RETAIN-ACCESSORY`, following `ev_battery_heat`.

**Worked example (Metric)** [V by Euler integration of the pack and coolant energy balance: 1,503.15 s; a two-node model with a small coolant mass converges to the same figure].

| Input | Value | Result | Value |
|---|---|---|---|
| Current | 250 A | Heat generated | 5,000 W |
| Resistance | 0.08 Ω | Coolant rise | 9.5238 K |
| Coolant flow | 0.15 kg/s | Outlet / mean coolant | 34.5238 / 29.7619 °C |
| Coolant c_p | 3,500 J/kg·K | Steady pack temperature | 39.7619 °C |
| UA | 500 W/K | τ | 1,328.57 s (22.14 min) |
| Pack | 450 kg × 1,000 J/kg·K | Time from 25 °C to 35 °C | **1,503.15 s (25.05 min)** — revision 1.0's 1,018.26 s is superseded (erratum) |
| Coolant inlet / start / limit | 25 / 25 / 35 °C | Continuous capacity to 35 °C | 3,387.097 W, i.e. 205.764 A |

- **Imperial equivalents:** 77 °F, 992.08 lbs, 19.8416 lbs/min, limit 95 °F. The same physical answers are expected in °F and Δ°F.
- **Entropic illustration:** dU/dT = −0.0384 V/K for the pack (96 s × −0.4 mV/K) at T = 302.91 K on discharge adds +2,907.95 W. This shows why the term is not shown when it is unknown [V by direct evaluation].

**Not valid for.**
- Air-cooled packs with significant convection to ambient.
- Phase-change materials.
- Current that varies over the period (the inputs are a single constant).
- Very low coolant flow, where the outlet temperature exceeds the pack temperature (flagged).
- Resistance strongly dependent on temperature or state of charge (stated).

---

### 2.2 Motor Thermal Limit — `motor_thermal_limit` (EV / THERMAL)

**Purpose.** At one operating point (power, or torque and speed, with the efficiency at that point), find:
- the steady winding temperature;
- whether that point can be held continuously;
- if not, how long from a starting temperature before the winding limit is reached;
- the loss the cooling can reject continuously.

**Boundary.** It does not replace a motor's published continuous and peak curves, and does not model magnets, bearings or rotor temperature.

**Candidate models.**

| Candidate | Status | Reason |
|---|---|---|
| (a) Steady thermal resistance only | Kept as one output | Cannot represent a short peak |
| (b) Single-node first-order RC: C dT/dt = P_loss − (T − T_c) ÷ R_th | **Selected** [E] | Smallest model that separates continuous from time-limited operation, with two thermal parameters a user can obtain or fit from a published peak duration |
| (c) Two-node, winding + stator | Rejected for now | More faithful hot-spot behaviour, but needs four parameters that are rarely published |
| (d) Lumped-parameter thermal network | Rejected | Research tool |

**Equations.**
- Loss: P_loss = P_out(1/η − 1). P_out = T·ω when torque mode is chosen [P: P = Tω].
- Steady temperature: T_ss = T_c + P_loss R_th.
- Time constant: τ = R_th C.
- Time to limit from T₀: t_lim = τ ln((T_ss − T₀) ÷ (T_ss − T_lim)), valid when T₀ < T_lim < T_ss. If T_ss ≤ T_lim the result reads "continuous at this point". If T₀ ≥ T_lim it reads "already at the limit".
- Continuous loss capacity: P_loss,cont = (T_lim − T_c) ÷ R_th.
- "Continuous output if efficiency stayed η": P_loss,cont η ÷ (1 − η). This is labelled as an extrapolation: efficiency changes with load.

**Continuous versus peak** [E]. A point whose steady temperature exceeds the limit is reported as **"time-limited: X s from T₀"**, never as a continuous rating. The page states that a manufacturer's peak rating (typically 10–60 s) is a time-limited figure.

**Temperature limit.** The winding temperature limit is an input [E]. The thermal classes are published facts [P: IEC 60085 / IEC 60034-1]:
- 130 (B), 155 (F) and 180 (H) °C are insulation thermal-class temperatures, not permissible operating hot-spot temperatures;
- IEC 60034-1 permits lower temperature rises over a 40 °C reference.

Example default 150 °C, labelled as an example.

**Copper-loss temperature dependence.** Copper resistance rises about 0.39 %/K. It is neglected; stated as making the time to limit optimistic [E].

**Inputs.**

| Input | Units | Example default | Validation |
|---|---|---|---|
| Mode | — | Power or Torque + speed | — |
| Shaft output power | kW (native, `EV_POWER`) | 150 | > 0 |
| Torque | lb-ft ↔ N·m (`EV_TORQUE`, see decision D-14-2) | — | > 0 |
| Speed | RPM | — | > 0 |
| Efficiency at the point | % | 94 | 50–99.9 |
| Winding-to-coolant R_th | K/W | 0.012 | > 0 |
| Thermal capacitance C | J/K | 15,000 | > 0; alternatively τ in s (owner choice D-14-3) |
| Coolant temperature | °F ↔ °C | 65 °C | — |
| Initial winding temperature | °F ↔ °C | 90 °C | — |
| Winding limit | °F ↔ °C | 150 °C | > coolant temperature |

**Outputs.**
- Loss (W, `RETAIN-ACCESSORY`).
- Steady winding temperature.
- τ (s).
- Status: continuous, or time-limited with the time to limit (s).
- Continuous loss capacity (W).
- Continuous output at η, as an extrapolation (kW, `EV_POWER`).

**Worked example** [V by Euler integration: 198.177 s].

| Input | Value | Result | Value |
|---|---|---|---|
| Output | 150 kW | Loss | 9,574.468 W |
| Efficiency | 94 % | Steady winding temperature | 179.894 °C (exceeds the limit) |
| R_th | 0.012 K/W | τ | 180 s |
| C | 15,000 J/K | Time-limited, from 90 °C | 198.177 s to 150 °C |
| Coolant | 65 °C | Continuous loss | 7,083.333 W |
| Start / limit | 90 / 150 °C | Continuous output if η stayed 94 % | 110.972 kW |

Torque-mode cross-check: 300 N·m at 4,775 RPM gives 150.011 kW.

**Not valid for.**
- Duty cycles: one constant load step only.
- Temperatures where the efficiency entered is not the efficiency at that temperature.
- Field weakening at a different point.
- Oil-spray-cooled hot spots that a single node cannot see.

---

### 2.3 Inverter Thermal Load — `inverter_thermal_load` (EV / THERMAL)

**Purpose.** Answers "how much heat does the inverter put into the coolant, and how hot do its semiconductors run", in two modes that state which losses are estimated and which come from data.

**Mode A: efficiency estimate** [E]. Estimated losses, needing only system data.
- Loss: P_loss = P_out(1/η − 1), where P_out is the AC output.
- Coolant rise: ΔT_c = P_loss ÷ (ṁ c_p).
- Temperatures through a lumped R_th:
  - heatsink (baseplate) T_hs = T_c,m + P_loss R_th,hs-c;
  - optional device junction T_j = T_hs + (P_loss ÷ n_dev) R_th,j-hs, assuming the loss is shared equally among n_dev devices (stated as an assumption).
- This mode adds the thermal outputs that keep it distinct from `ev_inverter_loss`.

**Mode B: data-sheet device losses (IGBT + anti-parallel diode, three-phase sine-PWM)**. Uses data-sheet parameters entered by the user.
- **Source** [P]: D. Graovac & M. Pürschel, *IGBT Power Losses Calculation Using the Data-Sheet Parameters*, Infineon application note v1.1, Jan 2009, §3.4.
- **Conduction losses, per device**, with peak phase current Î, modulation index m and displacement factor cos φ:
  - IGBT: P_cT = V_CE0 Î (1/2π + m cosφ/8) + r_CE Î² (1/8 + m cosφ/3π)
  - Diode: P_cD = V_F0 Î (1/2π − m cosφ/8) + r_F Î² (1/8 − m cosφ/3π)
- **Switching** [E, the common linear scaling]:
  - IGBT: P_swT = (1/π) f_sw (E_on + E_off)(Î/I_ref)(V_dc/V_ref)
  - Diode: P_rrD = (1/π) f_sw E_rec (Î/I_ref)(V_dc/V_ref)
  - The 1/π factor is the half-period average of \|sin\|.
- **Junction temperatures:** T_jT = T_c + P_T R_th,jT-c and T_jD = T_c + P_D R_th,jD-c.
- **Total:** 6 × (P_T + P_D).

**What has and has not been verified.**
- **Conduction formulas:** the application-note text available to this review was garbled, so the formulas were reconstructed. They were then verified independently by integrating V_0·i + r·i² weighted by the PWM duty d = (1 + m sin(θ + φ))/2 over a period, with 200,000 steps. Results: IGBT 107.5352 W and diode 25.0427 W, identical to the closed forms [V].
- **Switching-loss scaling:** linear in current and voltage. It is an assumption, not verified. Some makers publish a voltage exponent K_v ≈ 1.2–1.4 and current-dependent E(I) curves.
- **Primary-source check:** the formulas must be checked against the original PDF before implementation.

**Not in scope** [E].
- SiC MOSFETs with synchronous rectification, where conduction in the "diode" interval goes through the channel.
- Three-level topologies.
- Discontinuous PWM.
- Overmodulation (m > 1).

These need their own formulas (decision D-14-4).

**Inputs.**
- **Mode A:** AC output kW (`EV_POWER`, native); efficiency %; coolant flow, c_p and inlet temperature; R_th,hs-c (K/W); optional n_dev and R_th,j-hs.
- **Mode B:**

| Input | Units | Example |
|---|---|---|
| V_CE0 / r_CE | V / Ω | 0.8 V / 2.5 mΩ |
| V_F0 / r_F | V / Ω | 0.9 V / 2.0 mΩ |
| E_on + E_off / E_rec | J | 12 + 10 mJ / 6 mJ |
| I_ref / V_ref | A / V | 400 A / 400 V |
| f_sw | Hz | 10 kHz |
| m | — | 0.9 (0 < m ≤ 1) |
| cos φ | — | 0.85 (0–1) |
| Î | A | 300 |
| V_dc | V | 350 |
| R_th IGBT / diode, junction-to-coolant | K/W | 0.12 / 0.18 |
| Coolant | °F ↔ °C | 65 °C |

The parameter examples are labelled "example data-sheet values".

**Worked examples** [V].

| Mode | Item | Value |
|---|---|---|
| A | 100 kW out at 97 % | Input 103.093 kW; loss 3,092.78 W |
| B | IGBT conduction / switching | 107.535 W / 45.956 W (153.491 W total) |
| B | Diode conduction / recovery | 25.043 W / 12.534 W (37.576 W total) |
| B | Six-switch inverter | 1,146.40 W |
| B | Junction temperature, IGBT / diode | 83.42 °C / 71.76 °C |

**Validation.**
- Mode B rejects m > 1, a cos φ outside 0–1, and Î above 3 × I_ref.
- A negative diode-conduction bracket (possible when m cos φ is large and the term goes negative) is flagged as outside the model, not clamped.

---

### 2.4 DC Fast-Charge Time with CC-CV Taper — `dc_fast_charge_time` (EV / CHARGING & RANGE)

**Purpose.** Estimate the time from one state of charge to another on a DC charger, with the slowdown when the pack reaches its voltage limit. The page says: **estimate, not a prediction.**

**Candidate models compared.**

| # | Model | Inputs | Verdict |
|---|---|---|---|
| a | Linear: ΔE ÷ P (existing `ev_charge_time`) | Energy, power | Rejected as the main answer, because it has no taper. Kept as a comparison row |
| b | CC to a user-chosen SOC breakpoint, then exponential taper with a user time constant | Breakpoint SOC, τ | Rejected: both parameters are curve-fits the user rarely has, and the breakpoint really depends on C-rate and temperature [P: Shi et al. 2020] |
| c | **Equivalent circuit (OCV + R) with linear OCV(SOC); CC until the terminal voltage reaches V_max, then CV** | Q (Ah), OCV at 0 % and 100 %, pack R, V_max, battery current limit, charger power limit | **Selected** [E]. The taper follows from physics (Abdollahi et al., ACC 2015 use the same OCV-R model). Every parameter is a pack datum or a measurement. It is closed-form and verifiable |
| d | Manufacturer charging-curve table (kW versus SOC) interpolated | A published curve | Most accurate for a specific car. Rejected for v1 because the data are needed and often absent, and a table editor is a larger UI. Possible later mode (decision D-14-5) |

**Equations for (c).**
- OCV(s) = V₀ + k s, with k = V₁₀₀ − V₀.
- CC current: I_cc = min(I_batt,max, P_chg,max ÷ V_max). Using V_max is conservative for a power-limited charger.
- Breakpoint: s_b = (V_max − I_cc R − V₀) ÷ k.
- Equilibrium: s_∞ = (V_max − V₀) ÷ k.
- CC time: t_cc = (min(s_b, s₁) − s₀) Q ÷ I_cc.
- CV phase:
  - dI/dt follows from dS/dt = I/Q, with I = (V_max − V₀ − k s) ÷ R;
  - this gives s(t) = s_∞ − (s_∞ − s_b)e^(−t/τ), with τ = R Q ÷ k (hours, with Q in Ah);
  - CV time to the target: t_cv = τ ln((s_∞ − s_b) ÷ (s_∞ − s₁)).
- Current at the target: I₁ = k(s_∞ − s₁) ÷ R.
- Energy stored on an OCV basis: Q ∫ OCV ds.
- Pack I²R loss: I_cc²R t_cc + I_b²R τ/2 (1 − e^(−2t_cv/τ)).
- Terminal energy = stored + loss. Grid energy = terminal ÷ charger efficiency (optional input).
- If s₁ ≥ s_∞, the target cannot be reached at that V_max: rejected with the reason.

**Inputs.**

| Input | Units | Example | Validation |
|---|---|---|---|
| Capacity Q | Ah | 200 | > 0 |
| OCV at 0 % / 100 % | V | 330 / 410 | V₀ < V₁₀₀ |
| Pack resistance | Ω | 0.10 | > 0 |
| Max charge voltage | V | 410 | > OCV(s₀) + I_cc R (otherwise the charge starts in CV) |
| Battery current limit | A | 400 | > 0 |
| Charger power limit | kW (native, `EV_POWER`) | 350 | > 0 |
| Start / target SOC | % | 10 / 80 | 0 ≤ s₀ < s₁ < 100 |
| Charger efficiency | % | 95 | Optional |

All units are neutral, so the calculator is the same in both systems, apart from the power token.

**Outputs.**
- CC current (A); CC and CV phase times (min); total time (min).
- SOC at the CC→CV switch (%); current at the target (A).
- Energy stored and terminal energy (kWh); pack I²R loss (kWh); grid energy (kWh).
- Linear-estimate comparison (min).

**Worked example** [V by numerical integration of the ODE with a 1 µh step: 25.7444 min].

| Result | Value |
|---|---|
| k | 80 V |
| s_b / s_∞ | 0.50 / 1.00 |
| τ | 0.25 h |
| CC time | 12.000 min |
| CV time | 13.7444 min |
| **Total** | **25.7444 min** |
| Current at 80 % | 160 A |
| Energy stored | 51.240 kWh |
| I²R loss, CC + CV | 3.200 + 1.680 kWh |
| Terminal energy | 56.120 kWh |
| Linear estimate | 21.00 min |

A 120 kW charger gives I_cc = 292.683 A, s_b = 0.63415 and a total of 30.9587 min [V].

**Stated limits** [P: Shi et al.]. Real fast-charge profiles are multi-step and depend on temperature: the BMS steps the current down with SOC, and the CC→CV switch depends on temperature and C-rate. Real Li-ion OCV is not linear. Resistance depends on temperature, so a cold pack charges slower. Charger power at low pack voltage, and preconditioning, are not modelled.

---

### 2.5 Hybrid Power-Split Device Kinematics — `power_split_device_kinematics` (EV / HYBRID & ALTERNATIVE ENERGY)

**Purpose.** For a single planetary power-split device (Toyota THS layout as the default mapping): from two member speeds and the engine torque, find the third speed, the steady torque split and the mechanical/electrical power paths.

**Published facts.**
- Prius PSD: sun 30, ring 78 (planets 23).
- Members: sun = MG1, carrier = engine, ring = MG2 and output.
- MG1 = 3.6 × ICE − 2.6 × MG2 [P: Graham Davies, "Understanding the Power Split Device"].
- 3.6 = 108/30 and 2.6 = 78/30, which agrees with the Willis equation [V].

**Conventions** [E].
- Tooth counts: Z_s (sun) and Z_r (ring, internal teeth); 0 < Z_s < Z_r, both whole numbers.
- Speeds: positive is the engine's direction of rotation.
- Torques: positive is the direction that accelerates the member in its positive direction.
- Steady state, lossless gearing, rigid members.

**Equations.**
- **Willis:** Z_s ω_s + Z_r ω_r = (Z_s + Z_r) ω_c [P, standard].
- **Torque equilibrium:** with engine torque T_e on the carrier, the reactions are T_s = −T_e Z_s/(Z_s + Z_r) and T_r = −T_e Z_r/(Z_s + Z_r), as torques the sun and ring must resist.
- **Reported as delivered magnitudes:**
  - engine torque reaching the ring: T_e Z_r/(Z_s + Z_r);
  - MG1 reaction torque: T_e Z_s/(Z_s + Z_r).
- **Power:**
  - P_ring,mech = T_e Z_r/(Z_s + Z_r) · ω_r;
  - P_MG1 = T_e Z_s/(Z_s + Z_r) · ω_s, generating when ω_s > 0;
  - **check: P_engine = P_ring,mech + P_MG1.**
- **Optional charge-sustaining electrical path** (battery net zero) with an electrical efficiency η_e (MG1 generating × inverters × MG2 motoring):
  - P_MG2 = η_e P_MG1;
  - T_MG2 = P_MG2 ÷ ω_r;
  - output torque = engine share + T_MG2.
- **Ring speed:** a direct input, or from vehicle speed: n_ring = v ÷ (2π r_tire) × 60 × G (G = ring-to-wheel reduction).

**Inputs.**

| Input | Units | Example | Validation |
|---|---|---|---|
| Z_s / Z_r | teeth | 30 / 78 | Integers, Z_s < Z_r |
| Engine speed (carrier) | RPM | 2,000 | ≥ 0 |
| Ring speed | RPM | 1,500 | ≥ 0 |
| *or* vehicle speed | mph ↔ km/h | — | — |
| *with* tire radius | in ↔ mm | — | — |
| *with* reduction G | — | — | — |
| Engine torque | `ENGINE_TORQUE` (lb-ft ↔ N·m) | 100 N·m (73.76 lb-ft) | ≥ 0 |
| η_e | % | 85 | Optional |
| MG1 speed limit | RPM | — | Optional, flags an overspeed |

**Outputs.**
- MG1 (sun) speed, RPM, with sign.
- Engine torque to the ring and MG1 reaction torque (torque rows: decision D-14-2/-6).
- Engine power, ring mechanical power, MG1 power, MG2 power, output torque (power rows: decision D-14-6).
- Fraction of engine power through the mechanical path (%).
- Mode notes:
  - "MG1 generating" or "MG1 motoring (power recirculation)" when ω_s < 0;
  - "engine stopped (EV mode)" when ω_c = 0.

**Worked example** [V by the power balance, and against the Prius relation].

| Input | Value | Result | Value |
|---|---|---|---|
| Z_s / Z_r | 30 / 78 | MG1 speed | **3,300 RPM** (3.6 × 2,000 − 2.6 × 1,500 = 3,300) |
| Engine | 2,000 RPM, 100 N·m | Engine torque to the ring | 72.2222 N·m |
| Ring | 1,500 RPM | MG1 reaction | 27.7778 N·m |
| — | — | Engine power | 20,943.95 W |
| — | — | Ring mechanical power | 11,344.64 W |
| — | — | MG1 generated | 9,599.31 W (sum 20,943.95 W ✓) |

- **With η_e = 85 %:** P_MG2 = 8,159.41 W; T_MG2 = 51.9444 N·m; output torque 124.1667 N·m; output ÷ engine power = 93.125 %.
- **Engine stopped, ring 1,500 RPM:** MG1 = −3,900 RPM.
- **Ring held** (ω_r = 0): ω_s/ω_c = 108/30 = 1 + 78/30, which equals `planetary_gearset_ratio` ring-fixed [V].
- **From vehicle speed:** 100 km/h, r = 0.3 m, G = 3.267 gives a ring speed of 2,888.662 RPM.

**Not valid for.**
- Compound or multi-mode devices (GM two-mode, Gen-4 Prius, Ford variants with an extra reduction) unless the user maps them.
- Gear and bearing losses.
- Transients (member inertias).

The page states each.

---

### 2.6 Regenerative Braking Energy Recovery — `regen_braking_energy` (EV / HYBRID & ALTERNATIVE ENERGY)

**Purpose.** For one stop or slowdown at constant deceleration, find:
- how much braking energy exists;
- how much the regenerative system can return to the battery terminals;
- how much the friction brakes must absorb.

**Boundary.** It is not a drive-cycle simulation and does not model the state of charge.

**Energy balance** [E, from the Phase 1 definition: ΔKE capped by power].
- Braking energy available: E_brake = ½ m (v₁² − v₂²), with an optional rotating-mass factor (default 1.00).
- Road loads (aero, rolling) during the stop are neglected, so E_brake is an **upper bound** on braking energy (stated). Including them needs C_dA and C_rr inputs and is a possible later option.
- Duration: t = (v₁ − v₂) ÷ a.

**Limits, each applied where it physically acts** [E; P for the structure: Bayar, Biasini, Onori & Rizzoni, IJVD 58 (2012) model motor torque limits, a low-speed regen cutout and SOC limits, with friction supplying the remainder].
1. **Regen-axle share** f (0–100 %). The share of braking demand the control strategy allows on the regen axle(s); stability and brake balance set it. Regen demand = f · m a v.
2. **Motor/generator power limit** P_mg (at the shaft), referred to the wheels: P_mg ÷ η_dt.
3. **Battery charge-acceptance limit** P_batt (at the DC terminals), referred to the wheels: P_batt ÷ (η_dt η_mi).
4. Wheel-referred cap: P_w = min(2, 3).
5. **Low-speed cutout** v_min: no regen below it.

**Regen power at the wheels** for v ≥ v_min: P(v) = min(f m a v, P_w). It is power-limited above v* = P_w ÷ (f m a).

**Closed form.**
- E_regen,wheel = P_w (v₁ − max(v*, v_lo)) ÷ a [for v₁ > v*] + f ½ m (min(v₁, v*)² − v_lo²), with v_lo = max(v₂, v_min).
- Friction energy = E_brake − E_regen,wheel.
- Energy at the battery terminals = E_regen,wheel η_dt η_mi.
- Optional "stored" = × η_batt,charge, shown separately.

**No double counting** [E].
- Each efficiency acts once on its own segment: wheel→shaft η_dt, shaft→DC η_mi, DC→chemical η_batt.
- The power caps are referred through the same efficiencies.
- The page says not to enter a round-trip efficiency here. Discharge losses belong to a later drive and are not part of recovery.

**Inputs.**

| Input | Units | Example | Validation |
|---|---|---|---|
| Vehicle mass | lbs ↔ kg | 2,000 kg (4,409.25 lbs) | > 0 |
| Start speed | mph ↔ km/h | 100 km/h (62.137 mph) | > end speed |
| End speed | mph ↔ km/h | 0 | ≥ 0 |
| Deceleration | g, raw | 0.20394 g (2 m/s²) | 0 < a ≤ 1.5 g |
| Regen-axle share | % | 100 | 0–100 |
| MG power limit | kW (native, `EV_POWER`) | 100 | > 0 |
| Battery charge limit | kW (native, `EV_POWER`) | 80 | > 0 |
| η_dt | % | 97 | 50–100 |
| η_mi | % | 92 | 50–100 |
| Low-speed cutout | mph ↔ km/h | 7.2 km/h | ≥ 0 |
| Rotating-mass factor | — | 1.00 | 1.00–1.30 |
| η_batt | % | — | Optional |

**Outputs.**
- Kinetic energy released (kWh; Wh optional, decision D-14-7).
- Regen energy at the wheels; energy to the battery terminals; friction-brake energy (kWh).
- Recovered fraction (%).
- Peak regen power at the wheels (kW).
- Speed below which regen is no longer power-limited (mph ↔ km/h).
- Stop duration (s).

**Worked example** [V by time-stepping the stop, dt = 10 µs: E_wheel 738,808 J against 738,807.7 J closed form].

| Result | Value |
|---|---|
| ΔKE | 771,604.94 J (0.214335 kWh) |
| P_w | min(103.093, 89.6459) = 89.6459 kW, battery-limited |
| v* | 22.4115 m/s (80.68 km/h) |
| Regen at the wheels | 738,807.73 J |
| Friction | 32,797.21 J |
| To the battery terminals | 659,312.02 J (0.183142 kWh), 85.447 % of ΔKE |
| Duration | 13.889 s |

**Not valid for.**
- Variable deceleration.
- Downhill braking: add m g h to the available energy; possible later option.
- ABS events.
- Speed-dependent motor torque limits beyond the power cap: a constant-torque region at low speed is approximated by the power cap only.
- A battery at a high state of charge: the user must enter the reduced acceptance; the page says so.

---

## 3. Performance-unit (GH-IMP-019 / GH-IMP-020) questions that affect Batch 14

**Status of GH-IMP-020.** Read from the register: DEFERRED, with no decision taken.

| Item | Effect on Batch 14 |
|---|---|
| U1 (BSFC), U2 (power-to-weight), U7 (HP-equiv) | Not affected |
| U8 | Closed via GH-DEF-031 |
| U5 (browser-local preference) and U9 (spec-sheet text follows the row) | Apply automatically |
| U6 (narrative text) | Help text must not hard-code "hp" or "kW" where the row follows the preference |
| **U3: EV motor torque, lb-ft by the current product decision** | Affects the torque input of Motor Thermal Limit and any MG1/MG2 torque rows of the Power-Split calculator |
| **U4: component and accessory power retained** | Affects the heat and loss rows (W) of the three thermal calculators |

**Decisions needing owner approval.** None is chosen here; existing behaviour is not changed.

**D-14-1. Heat and loss rows.** The precedents are inconsistent:
- `ev_battery_heat` "Battery Heat" (W) is `RETAIN-ACCESSORY`;
- `ev_inverter_loss` "Inverter Loss" (kW) is `EV_POWER`.

Proposal [E]: every **heat or loss** row in Batch 14 (battery heat, motor loss, inverter loss, continuous heat capacities) is `RETAIN-ACCESSORY` in W, following `ev_battery_heat` and U4. Every **shaft or electrical output power** row (motor output, AC output, charger limit, MG and battery regen limits) is `EV_POWER`, native kW. The owner may prefer the loss rows to follow `EV_POWER`, for consistency with `ev_inverter_loss`.

**D-14-2. EV and MG torque.**
- Under U3 (lb-ft by default), the Motor Thermal torque input and the MG2 torque are `EV_TORQUE`.
- MG1 reaction torque: `EV_TORQUE` or `DRIVELINE_TORQUE`?
- Ring/output torque: `DRIVELINE_TORQUE` (recommended) or `WHEEL_TORQUE`?

**D-14-3.** Motor thermal capacitance input: C (J/K) or a time constant τ (s), or both through a selector.

**D-14-4.** Inverter Mode B scope:
- approve IGBT + diode only, with SiC MOSFETs out of scope;
- confirm the linear switching-energy scaling (or add a voltage exponent K_v input);
- the conduction formulas must be checked against the original application note before coding.

**D-14-5.** DC fast charge:
- approve model (c);
- decide whether a manufacturer-curve table mode (d) is wanted later.

**D-14-6. Power-split power rows.** Under P1/P2, engine power shows hp and MG power kW under Auto. The calculator's defining check, P_engine = P_ring + P_MG1, would then read in two units on one page, as `hybrid_power_split` already does. Options:
- (i) per-row categories (engine `ENGINE_POWER` hp; MG1, MG2 and ring `EV_POWER` kW);
- (ii) all split powers `HYBRID_SYSTEM_POWER` (kW, one unit) — clearer arithmetic, but it departs from P1 for the engine row;
- (iii) as (i), plus a one-line "balance" note in a single unit.

Recommended: (iii) [E].

**D-14-7.** Energy units: kWh only (neutral), or also Wh / J for single-stop regen energies, which are small, e.g. 0.183 kWh.

**D-14-8. Example defaults** under the example-default policy:
- 35 °C pack limit;
- 150 °C winding limit;
- data-sheet example values for Mode B;
- pack OCV and resistance examples.

All are labelled as examples.

**Census implications.** Every new power or torque row needs a `PERF_ROWS` entry and a `performance-census` / `power-torque-rows.json` row; the census fails on an unclassified row. Mass rows (`lbs`: pack mass, vehicle mass) go into `force-unit-rows.json` as mass. The `g` deceleration row needs `raw:true`. Temperature inputs use the registered °F ↔ °C, and temperature differences Δ°F ↔ Δ°C. Neutral electrical units need no factor entries.

---

## 4. Test matrix (for the implementation, when authorized)

| Calculator | Closed-form cases, Imperial and Metric | Independent check | Invalid and boundary cases | Unit-system kinds (new kinds marked *) | Self-test assertions (proposed) |
|---|---|---|---|---|---|
| Battery heat balance | Example above; Q_rev sign flip charge/discharge; T_ss ≤ limit gives "does not reach"; T₀ ≥ limit | Euler ODE | Empty/text/negative per box; R = 0; ṁ = 0; UA = 0; limit ≤ inlet; outlet > pack flag | current/resistance neutral; tempabs; tempdiff; mass; massflow-min*; neutral J/kg·K, W/K | t_lim = 1,503.15 s (tol 0.1; revision 1.0's 1,018.26 s is superseded); I_max = 205.764 A |
| Motor thermal limit | Example; continuous case (P small); torque mode equals power mode; already-at-limit case | Euler ODE | η ≤ 50 or ≥ 100; R_th ≤ 0; C ≤ 0; limit ≤ coolant; speed 0 in torque mode | tempabs; EV_POWER native; EV_TORQUE perf token | t_lim = 198.177 s; P_cont = 110.972 kW |
| Inverter thermal load | Mode A example; Mode B example; m = 0 gives symmetric conduction | Numeric PWM integral (conduction); half-period average (switching) | m > 1; cos φ > 1; Î ≤ 0; f_sw ≤ 0; negative diode bracket flag | tempabs; massflow-min*; neutral V, Ω, J, Hz, K/W | Mode B IGBT 153.491 W; inverter 1,146.40 W |
| DC fast charge | Example; target before breakpoint (pure CC); power-limited charger; s₀ ≥ s_b (pure CV) | ODE integration | s₁ ≥ s_∞; V₀ ≥ V₁₀₀; s₀ ≥ s₁; V_max ≤ OCV(s₀) + I R; Q ≤ 0 | all neutral plus EV_POWER native | total 25.7444 min; I₁ = 160 A |
| Power-split | Example; EV mode (engine stopped); ring held equals `planetary_gearset_ratio`; vehicle-speed mode | Power balance; Prius 3.6/2.6 relation | Z_s ≥ Z_r; fractional teeth; negative speeds; tire radius 0 | rpm; ENGINE_TORQUE token; speed; length | n_s = 3,300 RPM; T_ring = 72.2222 N·m |
| Regen energy | Example; no cap reached (small mass); all below the cutout gives 0; f = 0 gives all friction | Time-stepped integration | v₂ ≥ v₁; a ≤ 0; η > 100; share > 100 | mass; speed; g raw; EV_POWER native | E_batt = 0.183142 kWh; friction 32,797 J |

**Common to all.**
- Tests written first and run to fail before each sub-group.
- Every case re-run typed in Metric.
- Unit labels checked.
- Re-entry and toggle cases in `unit-system`; integer fields such as tooth counts must not be the last field.
- The full browser regression after the batch.

---

## 5. Implementation readiness and order

| Calculator | Classification | What remains |
|---|---|---|
| Regenerative Braking Energy Recovery | **Ready to implement** | Model, limits and examples defined and verified. D-14-7 can follow the default (kWh, plus J in the help text) |
| Battery Pack Heat Balance | **Ready to implement** | Follows the `ev_battery_heat` precedent for the heat rows. D-14-1 confirms the heat-row category, and the existing precedent applies if the owner is silent |
| Motor Thermal Limit | **Ready after owner decision** | D-14-2 (torque category, only if torque mode is included), D-14-3, D-14-8 |
| Hybrid Power-Split Device Kinematics | **Ready after owner decision** | Kinematics verified. D-14-2 and D-14-6 decide how the power and torque rows display |
| DC Fast-Charge Time | **Ready after owner decision** | D-14-5 (approve model c; table mode later or never) |
| Inverter Thermal Load | **Mode A ready after D-14-1. Mode B not ready** | The application-note equations must be checked against the original PDF, the switching-scaling assumption confirmed, and the device scope decided (D-14-4). Mode A can ship alone if the owner prefers |

**Shared dependencies.**
1. **One first-order thermal helper.** Steady temperature, τ, time-to-limit, and the "never reaches" and "already above" branches, used by Battery, Motor and Inverter. It should be written once and unit-tested once.
2. **Performance-unit classification** of every power and torque row (D-14-1, D-14-2, D-14-6) before any power or torque row is coded.
3. **New `unit-system` kinds:** lbs/min ↔ kg/min mass flow; neutral electrical kinds.
4. **Cross-links** to `ev_battery_heat`, `ev_coolant_flow`, `ev_inverter_loss`, `ev_charge_time`, `hybrid_power_split`, `planetary_gearset_ratio`, `hybrid_regen_energy` and `ev_regen_power`.

**Recommended order** [E].

| Sub-group | Contents | Condition |
|---|---|---|
| **E1** | Regen Energy, Battery Pack Heat Balance (introduces the thermal helper) | Ready now |
| **E2** | Motor Thermal Limit, Inverter Thermal Load Mode A | Reuses the helper, after D-14-1/2/3/8 |
| **E3** | Power-Split Kinematics, DC Fast-Charge Time | After D-14-5/6 |
| Later | Inverter Mode B | Only after its verification and D-14-4 |

Each sub-group is committed separately, as in Batches 11 and 13.

---

## 6. Proposed documentation content (not applied)

The following would be added only when the owner permits documentation changes.

**Register, GH-FUT-003, History.**
> 2026-10-14 — model-specification review (no implementation): models selected and independently verified for all six. Regen and Battery Heat Balance are ready. Motor Thermal, Power-Split and DC Fast-Charge are ready after owner decisions D-14-1 to D-14-8. Inverter Mode B is not ready until its application-note equations are checked against the primary source and its device scope is decided. Performance-unit questions recorded against GH-IMP-020 U3/U4. Report: `docs/BATCH-14-SPECIFICATION.md`.

**PREMIUM-CATALOG, "Decisions and open items".**
> Open: Batch 14 owner decisions D-14-1 … D-14-8 (see the Batch 14 specification). No Batch 14 code until authorized.

---

## 7. Sources

**Primary and published.**
- Bernardi D., Pawlikowski E., Newman J., "A General Energy Balance for Battery Systems," *J. Electrochem. Soc.* 132(1), 5–12, 1985. [doi 10.1149/1.2113792](https://iopscience.iop.org/article/10.1149/1.2113792)
- Rao L., Newman J., "Heat-generation rate and general energy balance for insertion battery systems," *J. Electrochem. Soc.* 144(8), 2697–2704, 1997. [RTI listing](https://www.rti.org/publication/heat-generation-rate-general-energy-balance-insertion-battery-systems)
- Graovac D., Pürschel M., *IGBT Power Losses Calculation Using the Data-Sheet Parameters*, Infineon AN v1.1, 2009. [PDF](https://www.infineon.com/assets/row/public/documents/faq/igbt-power-losses-calculation-using-the-data-sheet-parameters.pdf)
- Liu H. et al., "An Analytical Model for the CC-CV Charge of Li-ion Batteries…," *J. Energy Storage* 29, 101342, 2020. [CALCE abstract](https://web.calce.umd.edu/articles/abstracts/2020/20_An_Analytical_Model.html)
- Abdollahi A. et al., "Battery charging optimization for OCV-resistance equivalent circuit model," ACC 2015, 3467–3472. [UWindsor](https://scholar.uwindsor.ca/computersciencepub/145)
- Shi J. et al., "Electric Vehicle Battery Remaining Charging Time Estimation Considering Charging Accuracy and Charging Profile Prediction." [arXiv 2012.05352](https://arxiv.org/pdf/2012.05352)
- Bayar K., Biasini R., Onori S., Rizzoni G., "Modelling and control of a brake system for an extended range electric vehicle equipped with axle motors," *Int. J. Vehicle Design* 58(2/3/4), 399–426, 2012. [PDF](https://pangea.stanford.edu/ERE/pdf/OnoriPDF/Journals/5.pdf)
- Davies G., "Understanding the Power Split Device" (Prius sun 30 / ring 78; MG1 = 3.6 ICE − 2.6 MG2). [Page](https://prius.ecrostech.com/original/Understanding/PowerSplitDevice.htm)

**Print references** (no link).
- Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer* (lumped capacitance).
- IEC 60085 and IEC 60034-1 (insulation thermal classes and temperature-rise limits).
- Ehsani et al., *Modern Electric, Hybrid Electric, and Fuel Cell Vehicles* (braking energy and regenerative braking).

**Verification script.** A standalone Python script in the session scratchpad computed every closed form and its independent check. It is not part of the repository.
