# Melstar Manufacturing Systems — Website

Static, build-free website for Melstar Manufacturing Systems Private Limited (CIN U29309KA2011PTC060656) — plant at KIADB Industrial Area, Obadenahalli, Doddaballapura; registered office in Rajajinagar, Bengaluru.

- `index.html` — page structure, company data, JSON-LD organisation schema
- `styles.css` — light aurora / glass theme, responsive layout, animations
- `main.js` — scroll reveals, nav, magnetic buttons, 3D tilt, live IST clock & plant status, simulated telemetry
- `hero3d.js` — Three.js meshing-gear hero scene (lighter material tier + adaptive resolution on phones)

Company facts (incorporation date, capital, RoC, directors, sectors, registered office) come from the public MCA-derived listing on SensiBook. Company age is computed live from the 04 Oct 2011 incorporation date.

When you change CSS/JS, bump the `?v=` number on the three asset URLs in `index.html` so returning visitors get the new files.

Run locally: `python -m http.server 5510` and open http://localhost:5510. Deployable as-is to GitHub Pages.
