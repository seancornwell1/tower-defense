# Stackwagon

Mobile web tower-on-a-cart zombie survival game (TypeScript + Phaser 3), built for iPhone Safari / Add to Home Screen, played in landscape. Cartoon art is drawn in code (`src/art.ts`); no external assets.

- Play: https://seancornwell1.github.io/tower-defense/
- All tuning numbers: `src/config.ts`. In game, triple-tap the top-left corner to open the tuning panel (changes are saved on the device; "Export / import" copies them as JSON).

## Develop

```
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build into dist/
npm run deploy   # build and push dist/ to the gh-pages branch
```

Pushing to `main` also deploys via `.github/workflows/deploy.yml`.

## Build order
1. ✅ One stage with a pre-battle build screen (per-block HP upgrade, 3 random weapons per block, weapon levels with 6 pips, SELL, energy-regen upgrade, + block, START), moving cart, 6-block tower, drag to reorder / trash to sell, hero shotgun with hold-to-aim, energy, weapon abilities + grenade, climbing zombies, spawner nests, crates, checkpoints, win/lose.
2. Evolutions every 6th level, chests, boss at stage end.
3. Worlds and difficulty scaling, end-of-stage reset, dust and backpack.
4. Main menu: hero equipment, rarity, fusion, summon, permanent upgrades, daily tasks.
5. Boss mode with keys and persistent boss HP.
