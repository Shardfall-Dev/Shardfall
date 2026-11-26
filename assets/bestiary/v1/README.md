# Shardfall bestiary v1.0.0

Open preview.html in a browser from a local checkout. Select a facing and action to inspect the whole roster. Each PNG uses transparent RGBA and contains one creature. Rows are screen-space S, SW, W, NW, N, NE, E, SE. The eastern three rows mirror the western artwork, including held weapons. The fixed 160 px square cells use a ground anchor of (80,137) in top-left coordinates. The Lich Lord has a turquoise rim and animated gold glints baked into its poses.

## Claude integration

Load manifest.json. For row r and column c, crop (160*c,160*r,160,160). Place the frame at entity ground position minus the scaled pivot. Use nearest-neighbour sampling. Follow the animation arrays and millisecond durations. Lock facing during attack, display column 3 during wind-up and column 4 on the existing simulation's attack resolution. Combat owns damage and timing. Use the existing asset embedding/build pattern to keep the single-file game playable offline. Apply color variants to cached copies of the base sprites. Preserve the alpha channel. These assets provide neutral, walk and attack poses. Spawn placement, balance, AI, and death art are separate integration work.
