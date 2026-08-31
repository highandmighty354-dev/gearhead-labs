/* Gearhead Labs Task 4 — verified mathematical corrections.
   Loaded into the encyclopedia frame before final navigation rebuild. */
(function(){
  try {
    if (typeof GH_E1_FORMULAS === 'object') {
      /* Four-stroke BMEP: 4πT(lb-ft) converted to lb-in => 48πT/V(in³). */
      if (GH_E1_FORMULAS.bmep_from_torque) GH_E1_FORMULAS.bmep_from_torque.expr='(T*48*Math.PI)/(V)';
      /* US customary spring rate in lb/in and weight/mass in lb: g=386.0886 in/s². */
      if (GH_E1_FORMULAS.ride_frequency) GH_E1_FORMULAS.ride_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
      if (GH_E1_FORMULAS.natural_frequency) GH_E1_FORMULAS.natural_frequency.expr='Math.sqrt(k*386.0886/m)/(2*Math.PI)';
    }
    window.__GH_QA_CORRECTIONS__={
      bmep_from_torque:'four-stroke BMEP = 48πT/V for lb-ft and ci',
      ride_frequency:'f = sqrt(k*386.0886/m)/(2π) for lb/in and lb mass',
      natural_frequency:'f = sqrt(k*386.0886/m)/(2π) for lb/in and lb mass'
    };
  } catch(e) { console.error('Gearhead Labs QA correction load failed',e); }
})();
