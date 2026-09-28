<p align="center"><img src="docs/readme/banner.svg" alt="ODD TIDE: turn the tide instrument, watch a route drown, plan a day that works." width="100%"></p>

<p align="center">
  <a href="https://01-odd-tide.williamking.workers.dev"><img alt="Visit the live site" src="https://img.shields.io/badge/Visit_live_site-%E2%86%97-e8c07a?style=for-the-badge&labelColor=08202c"></a>
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-e8c07a?style=for-the-badge&logo=threedotjs&logoColor=08202c&labelColor=08202c">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-e8c07a?style=for-the-badge&logo=typescript&logoColor=08202c&labelColor=08202c">
  <img alt="React" src="https://img.shields.io/badge/React-e8c07a?style=for-the-badge&logo=react&logoColor=08202c&labelColor=08202c">
  <img alt="GSAP" src="https://img.shields.io/badge/GSAP-e8c07a?style=for-the-badge&logo=greensock&logoColor=08202c&labelColor=08202c">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-e8c07a?style=for-the-badge&logo=tailwindcss&logoColor=08202c&labelColor=08202c">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-e8c07a?style=for-the-badge&logo=vite&logoColor=08202c&labelColor=08202c">
</p>

**An island that changes its mind twice a day.** Turn the island's time instrument, watch a real route disappear beneath the water, choose a small place to stay and arrange a day that actually works. An experiential 3D website for a fictional coastal stay.

<p align="center"><img src="docs/readme/preview.gif" alt="Scrolling from the island arrival into the stays and the day planner" width="800"></p>

## What you can do

- **Turn the tide instrument** and watch the causeway and coves flood and drain across the island in real time.
- **Choose a place to stay**, each with its own portrait of the island.
- **Plan a day** around the tide: the planner explains clashes, blocked dates and capacity, then helps you repair them.
- **Share it:** your plan lives in the URL.

## What's inside

- **A hand-built 3D island:** coastal milkwood trees, turf and planting, buildings and mechanisms, a living sea surface and a lighthouse, lit by one physical lighting setup.
- **Honest rules:** calendar, price, availability, tide, scheduling and URL rules live in a pure domain module with unit tests.
- **Choreographed camera moves** with GSAP between the island's viewpoints, and a considered arrival loader.
- **Nine prerendered pages** that read before JavaScript loads, with a real 404.
- **Verified in the browser:** 23 of 23 scripted journeys and a 91-shot breakpoint sweep with no overflow; GPU frame time about 14 ms at 1920×1080 on a desktop RTX 2060.
- **Optional original sound** that only starts on a deliberate press; every task works with sound off.

## Screenshots

| Desktop | Phone |
| --- | --- |
| <img src="docs/readme/desktop.png" alt="The island arrival on desktop" width="560"> | <img src="docs/readme/phone.png" alt="The island on a phone" width="220"> |

## Built with

Direct Three.js for the island; React for the visitor's choices; GSAP for camera, roof and day choreography; Tailwind CSS with Lightning CSS; TypeScript throughout; Vite and Bun for the build.

- **One lighting model:** a physical sky, sun and haze drive the environment, with GTAO, bloom and SMAA in the post chain.
- **Separation of concerns:** the domain module owns tide and itinerary rules, React owns discrete choices, three.js owns the scene.

## Run it locally

```sh
bun install --frozen-lockfile
bun run dev      # http://127.0.0.1:4511/
bun run check    # strict types, lint, domain tests and the production build
bun run preview  # http://127.0.0.1:4611/
```

Design intent is in [DESIGN.md](DESIGN.md); the working and verification history is in [docs/PROJECT-NOTES.md](docs/PROJECT-NOTES.md).

## Credits

Every sourced texture, model and sound is listed with its source, author and licence in [CREDITS.md](CREDITS.md) and [assets.manifest.json](assets.manifest.json). The stay, prices and bookings are fictional; there is no real booking or payment.

---

<p align="center"><sub>Part of William King's portfolio collection.</sub></p>
