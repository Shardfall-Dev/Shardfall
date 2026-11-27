# Bestiary v1.1.0 draft 01

Six candidate atlases were produced outside GitHub and normalized to 800×1280 RGBA, 40 nonempty isolated cells per atlas, with 160×160 cells and pivot (80,137). Species: boar, hound, snapper, spider, deer, hare. The ZIP is named Shardfall_Bestiary_v1.1.0_draft01.zip; it contains assets/bestiary/v1.1.0/{manifest.json,boar.png,hound.png,snapper.png,spider.png,deer.png,hare.png}, validation.json and README.txt. It is not in this branch yet. Do not fetch a nonexistent asset path from GitHub.

The 240 frames passed geometry and alpha checks; preview visually checked, not tested in-engine. The pack does not include death frames. Median idle heights match existing MON.h targets within one pixel. Remaining eight dedicated atlases: bear, wreckcrab, wisp, sentinel, captain, bellkeeper, smuggler, bandit. Reject unrelated overview charts. See BESTIARY_V1_1_AUDIT.md for full integration contract and tests.

Claude handoff: accept the ZIP from the user; extract into the repo root on this art branch, review and integrate only the six named sheets using the audited contract. Retain all original bestiary and legacy sheets and fallback logic. Do not replace missing creatures with crude procedural stand-ins or modify gameplay. Complete visual QA and regression tests before promoting this draft.
