# Gearhead Labs — Strategic Build List

**Master execution order:** Complete these tasks in order. Do not skip ahead unless a dependency requires it.

## 1. Calculator Accordion / Drop-Down Behavior — COMPLETE
- Fix open/close behavior for all calculator category sections.
- One click must always produce exactly one state change.
- Sections initially open must close on the first click.
- Sections initially closed must open on the first click.
- Completed in commit `f3d209e45e54571983dc5ba8e193baabaae968b7`.

## 2. Audit the Entire Calculator Library — NEXT
- Audit the complete calculator/category library.
- Ensure ALL intended calculators are actually present in the repository/application.
- Ensure every calculator is reachable through the navigation/drop-down structure.
- Reconcile displayed category/calculator counts with the actual library.
- Identify missing, duplicated, orphaned, or inaccessible calculators.
- Add/fix anything required so the full library is represented.

## 3. Finish Calculator Navigation / UX
- Make the entire calculator library intuitive and fast to navigate.
- Ensure category and subcategory behavior is consistent.
- Ensure every calculator has a clear, reliable path from the UI.

## 4. Test Individual Calculators
- Test calculator inputs and validation.
- Verify formulas and outputs.
- Verify Imperial / Metric switching.
- Test results, edge cases, and sensible boundary conditions.
- Fix any calculation or presentation defects found.

## 5. Homepage + Lab Navigation Polish
- Refine the homepage experience.
- Ensure homepage calls-to-action and Lab navigation work correctly.
- Ensure the homepage accurately represents the complete calculator library.

## 6. Mobile / iPhone Testing and Fixes
- Test the full experience on mobile/iPhone.
- Fix responsive layout, navigation, controls, calculators, and usability issues.
- Repeat critical interaction testing on mobile after fixes.

## 7. Full QA Pass
- Final end-to-end QA of the entire site.
- Verify links, navigation, calculator counts, calculator functionality, responsive behavior, visual consistency, and regressions.
- Only consider the build complete when the entire experience is working at the quality standard we are targeting.

## Strategic Standard
Gearhead Labs is not being built merely to "work." The objective is to make it the best automotive math, calculator, engineering-tool, and reference resource we can build.
