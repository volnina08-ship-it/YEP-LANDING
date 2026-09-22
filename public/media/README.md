# Média mappák

| Mappa | Mi kerül ide | Git |
| --- | --- | --- |
| `placeholders/` | Generált, sötét „placeholder” képek és loopok – amíg nincs valódi anyag | igen |
| `source/` | A Dropbox-ból letöltött eredeti fájlok (`npm run media:fetch`) | **nem** (gitignore) |
| `video/` | Webre optimalizált mp4 + poszter jpg (`npm run media`) | igen |
| `photo/` | Webre optimalizált jpg (`npm run media`) | igen |

A slot-kiosztást a `media.map.json` írja felül (minta: `media.map.example.json`).
