# Claude handoff — Painted Human Candidates v0.1

Source: asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip
Status: experimental art, NOT approved for production. The ZIP contains 192 extracted transparent candidate PNGs, eight sheets (male/female × Idle, Walk, Cast, Unarmed_Attack), 3 columns × 8 rows, 128×128 cells, feet anchor (64,106). Row order S, SW, W, NW, N, NE, E, SE. Hair is baked in, only three candidate poses per facing, casting is unsplit, and no equipment overlays exist.

Fetch this branch and extract the ZIP into a staging directory. Inspect each frame for facing accuracy, alpha artefacts, anchor consistency, proportions, and actual pose progression. Compare against the current layered compositor atlas contract and existing painted fallback. Do not silently duplicate frames or enable unverified candidates by default. Import only validated candidates behind a dev feature flag, preserve existing game art and saves, and expose an atlas debug preview. Maintain a machine-readable list of genuinely missing frames and layers; do not mark clean bodies, hair, armour, weapons, or full animation cycles complete. Use the same compositor for players and human NPCs. Run character creation, paperdoll, equipment, and rendering regression tests. Report exact accepted/rejected frames and remaining art work. Commit changes on a separate integration branch; do not merge until reviewed.

Archive SHA-256: 17b1b497dd80dbb87f6c1ea0b5a679d13aa1f6dcd0984f9fccc54a1a0d95c7b1
