# Momo anime rig

`anime-rig.webp` is original AI-generated artwork created for MM Tracker. It is a
soft 3D-style illustration, not a WebGL/VRM model or a Mochi character.

The transparent atlas contains a head, torso, two arms and two legs. `momo-art.js`
isolates these parts with SVG viewports, adds independently moving glossy pupils,
and supplies accessories and the folding chair. `momo-anime.css` animates the rig;
`momo-life.js` controls its states and interruptions. No companion animation or
soundscape audio is stored in Supabase.

Artwork direction: original anime boy, chestnut hair with mint streak, mint
hoodie over cream shirt, navy trousers, cream sneakers; polished 3D figurine
shading. Generated from an original full-body design, then edited into a six-part
transparent atlas with blank eye interiors for live cursor-tracking pupils.

The delivery atlas uses WebP at its original 1024 × 1536 dimensions, with full
alpha quality, to reduce its download size while preserving the design.
