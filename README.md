# Stackwagon

Mobile web tower-on-a-cart zombie survival game (TypeScript + Phaser 3), built for iPhone Safari / Add to Home Screen. Grey-box art for now.

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
1. ✅ One stage: moving cart, 6-block tower, buy/reorder/sell blocks, 3 random weapon types, hero shotgun with hold-to-aim, climbing zombies, spawner nests, checkpoints, win/lose.
2. Weapon levels, evolutions, energy, grenade and abilities, chests, boss.
3. Worlds and difficulty scaling, end-of-stage reset, dust and backpack.
4. Main menu: hero equipment, rarity, fusion, summon, permanent upgrades, daily tasks.
5. Boss mode with keys and persistent boss HP.
