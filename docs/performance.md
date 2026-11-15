# Performance d'Infinitex dans un jeu

Question : si un jeu habillait **tout** son personnage et son décor avec Infinitex, combien coûteraient la mémoire, le temps GPU et le temps CPU ? Et sur quelles machines peut-on viser quel nombre d'images par seconde ?

Légende : **[M]** mesuré sur la machine de test, **[E]** estimé (hypothèse écrite à côté).

## En bref (pour un non-spécialiste)

Une texture classique est une photo collée sur l'objet. Elle prend de la mémoire. Mais l'afficher coûte peu : la carte graphique lit la photo.

Infinitex ne stocke pas de photo. La carte graphique recalcule la matière à chaque image, pour chaque pixel. Donc presque pas de mémoire d'images, mais beaucoup de calcul.

Ce qu'on a mesuré sur un MacBook Pro M1 Max, avec une petite scène de jeu (un personnage en 5 matières, un décor en 8 matières) :

- **Temps par image en 1080p** : environ 10 ms avec Infinitex partout, contre 3 ms avec des textures classiques. Cette machine tient donc environ 100 images par seconde. Les matières font les trois quarts du travail. **[M]**
- **Gros plan** (un pull qui remplit l'écran) : environ 14 ms, soit 70 images par seconde. **[M]**
- **Mémoire** : des textures classiques 2K pour ces 13 matières prennent 870 Mo (220 Mo compressées). En 4K : 3,5 Go (870 Mo compressées). Infinitex : 0 Mo d'images, mais environ 185 Mo de shaders compilés et 60 Mo de JavaScript. **[M]** pour Infinitex et la 2K, **[E]** pour le reste.
- **Autres machines** : environ 40 images/s sur un MacBook Air récent, 25 sur un Mac M1 de base, 100 à 140 sur un PC avec une RTX 3060, 20 sur un portable à puce graphique intégrée. Sur téléphone, ce n'est pas jouable en l'état. **[E]**

Pour un vrai jeu, la bonne recette est mixte. Infinitex sert pour ce qui est proche : le héros, le sol à ses pieds, l'objet qu'on inspecte. Le lointain reçoit une version figée de la même matière, cuite en texture.

## 1. Conditions de mesure

| | |
|---|---|
| Machine | Apple M1 Max, GPU 32 cœurs (10,4 TFLOPS FP32), 32 Go de mémoire unifiée, macOS 26 |
| Navigateur | Chrome for Testing (Playwright, build 1234), headless, WebGPU sur Metal |
| Moteur | three.js r187, `WebGPURenderer`, matériaux TSL |
| Catalogue | 204 matières, 21 familles (`demo/cubelist.js`) |
| Date | 14 novembre 2026 |

**Contention.** D'autres agents utilisaient le GPU en même temps (ports 5211, 5234 à 5236). L'occupation du GPU, relevée toutes les 5 s, avait une médiane de 89 % pendant le banc des matières et de 100 % pendant celui de la scène (`docs/perf/gpu_util_*.log`). Elle était à 75 % avant le lancement de nos bancs. Chaque banc a donc tourné 3 fois. Les tableaux donnent le **minimum sur les runs**, la meilleure estimation du coût réel : la contention ne fait qu'ajouter du temps. La médiane suit entre parenthèses quand elle compte. L'écart entre runs est grand : ±50 % sur une même matière (écart relatif médian). Lisez donc chaque chiffre comme un ordre de grandeur.

**Deux chronos.**
- Matières seules : requêtes de timestamp GPU sur une passe unique, comme `tests/bench.mjs`.
- Scène de jeu : temps mural entre l'envoi de l'image et la fin du travail GPU (`queue.onSubmittedWorkDone`), images en série. C'est une borne haute du temps GPU. La latence fixe vaut 0,4 à 0,7 ms (image vide). Les timestamps ne sont pas fiables sur une image à plusieurs passes sur ce Mac en headless : la plupart reviennent cassés, et leur somme dépasse le temps mural.

**Reproduire.** Serveur de dev lancé, puis :

```bash
IX_URL=http://localhost:5211/cubes.html node tests/perf_matters.mjs docs/perf/perf_matters.json 3 20
IX_URL=http://localhost:5211/game.html node tests/perf_game.mjs docs/perf/perf_game.json 3
IX_URL=http://localhost:5211/game.html node tests/perf_game_parts.mjs docs/perf/perf_game_parts.json 3
IX_URL=http://localhost:5211/game.html node tests/perf_game_sizes.mjs docs/perf/perf_game_sizes.json 4
```

Les données brutes sont dans `docs/perf/`. La scène de jeu est `game.html` (`demo/game.js`).

## 2. Coût GPU par matière **[M]**

Chaque matière remplit une image 1920x1080, vue de face à 30 cm (la face entière), 2 cm et 1,5 mm. Coût en ms au-dessus d'un cube gris dans la même vue. Fuzz et poils 3D compris quand la matière en a. Pas de post-traitement.

| Distance | médiane | 75 % | 90 % | pire |
|---|---|---|---|---|
| 30 cm | 1,9 | 4,0 | 7,8 | 22,7 |
| 2 cm | 3,4 | 6,2 | 12,5 | 31,7 |
| 1,5 mm | 3,3 | 5,9 | 11,8 | 31,6 |

À la pire des trois distances, 28 % des matières coûtent moins de 2 ms, 57 % moins de 4 ms, 81 % moins de 8 ms, 92 % moins de 16 ms.

Les 10 plus chères (2 cm) : Cactus 31,7. Rouille 31,4. Torsades 28,7. Feutre de laine 27,6. Laine bouillie 23,2. Daim 22,9. Papier mâché 22,9. Papier 22,8. Feutre synthétique 22,7. Carton ondulé 22,6.

Les moins chères : Écran, Hologramme, Verni (corde), Nylon, sous 1 ms.

### Par famille (médiane des matières de la famille, ms, plein écran 1080p)

| Famille | n | 30 cm | 2 cm | 1,5 mm | pire matière |
|---|---|---|---|---|---|
| fibermat | 8 | 15,8 | 22,8 | 22,9 | Feutre de laine, 27,9 |
| knit (avec fuzz) | 11 | 8,8 | 15,2 | 15,2 | Torsades, 29,4 |
| metal | 10 | 5,7 | 9,2 | 8,8 | Rouille, 31,4 |
| skin (avec poils 3D) | 20 | 3,7 | 6,2 | 6,0 | Sueur, 9,0 |
| interlace | 3 | 2,3 | 4,3 | 3,8 | Cannage, 4,9 |
| stone | 7 | 2,3 | 4,1 | 4,0 | Granit, 9,1 |
| leather | 8 | 1,9 | 3,8 | 3,6 | Boue, 15,6 |
| ground | 9 | 3,0 | 3,7 | 3,3 | Poussière, 12,0 |
| woven | 18 | 1,8 | 3,3 | 3,1 | Brûlé, 11,8 |
| rope | 2 | 2,0 | 3,3 | 3,1 | Corde de chanvre, 6,3 |
| plant | 6 | 1,8 | 3,0 | 3,2 | Mousse, lichen, 4,7 |
| ceramic | 6 | 1,6 | 3,1 | 3,1 | Verre soufflé, 4,4 |
| organic | 36 | 1,2 | 2,4 | 2,7 | Cactus, 31,7 |
| plastic | 10 | 1,0 | 2,4 | 2,4 | Plastique mat, 8,5 |
| pile | 7 | 2,3 | 1,8 | 1,0 | Moquette coupée, 5,4 |
| strands | 3 | 1,2 | 2,5 | 0,9 | Toison brute, 3,0 |
| scales | 18 | 0,8 | 1,6 | 1,3 | Plumes, 12,5 |
| decor | 4 | 0,0 | 1,3 | 1,4 | Peinture à l'huile, 5,9 |
| wood | 10 | 0,7 | 1,3 | 1,3 | Poussière, 19,3 |
| scifi | 7 | 0,0 | 1,2 | 1,3 | Feuille irisée, 3,4 |

Ce qu'il faut retenir :
- **Les états de surface sont le coût caché.** Le bois nu coûte 1,3 ms, le bois poussiéreux 19 ms. Le métal médian coûte 9 ms, le métal rouillé 31 ms. Même chose pour le cuir boueux (16 ms) et le tissu brûlé (12 ms).
- **La vue lointaine n'est pas gratuite.** À 30 cm, une matière coûte encore 55 % de son coût à 2 cm. Les niveaux de détail effacés sont calculés, puis pondérés par zéro (`core/lod.js` fait un fondu, pas un saut).
- **Fibermat et knit sont les familles lourdes.** Elles empilent plusieurs échelles de fibres. Le knit paie en plus ses 8 coques de fuzz transparentes.

## 3. Scène de jeu **[M]**

`game.html` : un personnage d'environ 1,8 m et un décor. Ombre du soleil (2048²), GTAO à demi-résolution, passe des poils 3D (`demo/post.js`). 25 à 29 appels de dessin, 28 000 triangles (2,1 millions quand les poils 3D s'affichent).

| Partie | Matière | Extra |
|---|---|---|
| tête | Visage (skin) | poils 3D |
| avant-bras, cou | Peau mate (skin) | poils 3D |
| pull | Jersey (knit) | fuzz, 8 coques |
| pantalon, bottes | Cuir pleine fleur | |
| ceinture, épaulière, bracelet | Acier brossé | |
| sol 30 x 30 m | Terre (ground) | |
| mur | Brique et mortier | |
| allée | Béton | |
| caisses | Bois brut | |
| tonneau | Fer rouillé | |
| poubelle | Plastique usé, jauni | |
| pot | Terre cuite | |
| rocher | Granit | |

Trois modes pour le même cadre : **Infinitex**, **uni** (une couleur par matériau, aucune texture : c'est « le reste de l'image »), **PBR 2K** (albedo, normal et ORM en 2048², RGBA8, mipmaps, anisotropie 8 : un jeu classique).

### 1080p (1920x1080), post-traitement compris

Temps par image en ms. Minimum des 3 runs, médiane entre parenthèses.

| Vue | Infinitex | uni | PBR 2K | coût des matières | part des matières |
|---|---|---|---|---|---|
| 10 m, plan large | 8,3 (12,3) | 1,7 (2,9) | 1,9 (3,3) | 6,6 | 84 % |
| 5 m | 9,1 (13,5) | 2,6 (3,8) | 2,9 (4,4) | 6,5 | 75 % |
| 2,8 m, troisième personne | 9,7 (14,1) | 2,9 (4,6) | 3,2 (5,2) | 6,8 | 73 % |
| visage à 37 cm | 7,7 (10,5) | 3,6 (4,3) | 4,6 (4,6) | 4,1 | 56 % |
| pull à 6 cm, plein écran | 13,7 (20,3) | 4,2 (7,7) | 4,4 (7,8) | 9,5 | 71 % |
| avant-bras à 4 cm, poils 3D | 10,5 (15,5) | 4,3 (7,6) | 4,9 (7,5) | 6,2 | 61 % |

Sans post-traitement, en troisième personne : Infinitex 10,0 ms, uni 1,2 ms. Le post-traitement (GTAO et passe des poils) coûte donc environ 1,7 ms.

**Qui coûte quoi.** On n'allume qu'une partie à la fois en Infinitex, le reste en uni (`tests/perf_game_parts.mjs`). Le sol en Terre domine : +5,1 ms à 2,8 m et +8,5 ms à 10 m, à lui seul. Il couvre la moitié de l'écran, vu en rasant. Il coûte alors plus que vu de face, plein écran (3,3 à 3,7 ms). À 10 m, le mur, l'allée et le rocher ajoutent chacun 1,7 à 2,7 ms. Les cinq matières du personnage ajoutent chacune moins de 1 ms, sous le bruit de mesure. Elles couvrent peu de pixels à ces distances.

### 1440p (2560x1440)

Le passage complet à 1440p a tourné sous 100 % d'occupation GPU par d'autres agents : même le mode uni y était 2,5 à 3,8 fois plus lent qu'en 1080p. Un second banc alterne 1080p et 1440p dans la même page, pour que la contention touche les deux tailles pareil (`tests/perf_game_sizes.mjs`). Le rapport 1440p sur 1080p y vaut 1,6 à 2,0 pour Infinitex. C'est le rapport des pixels (1,78). Le coût suit donc le nombre de pixels. Estimation 1440p = 1080p x 1,78 **[E]** :

| Vue | Infinitex | uni | PBR 2K |
|---|---|---|---|
| 2,8 m | 17 | 5 | 6 |
| pull plein écran | 24 | 7,5 | 8 |

## 4. Mémoire

### Ce que la scène alloue **[M]**

Compteurs de three.js (`renderer.info.memory`), empreinte du processus GPU de Chrome (`footprint` de macOS), tas JavaScript (CDP `Performance.getMetrics`). Page à 1080p, chaque vue dessinée une fois.

| | sans Infinitex (`?noix`) | 13 matières Infinitex | avec PBR 2K en plus |
|---|---|---|---|
| Textures (three.js) | 130 Mo | 130 Mo | 1 002 Mo |
| Tampons de géométrie | 0,2 Mo | 5,0 Mo | 5,0 Mo |
| Programmes WGSL (texte) | 21, 0,08 Mo | 71, 3,4 Mo | 79, 3,4 Mo |
| Processus GPU (empreinte) | 538 Mo | 723 Mo | 2 182 Mo |
| Tas JavaScript | 25 Mo | 83 Mo | |

Détail :
- **Textures.** Les 130 Mo sont les cibles de rendu : la passe de scène (couleur et normales en demi-flottant, profondeur), la passe des poils, le GTAO à demi-résolution, la carte d'ombre, l'environnement. Infinitex n'en ajoute aucune. Seules des entrées optionnelles en ajoutent (une image de jacquard ou de tatouage). En 1440p, les cibles montent à 201 Mo.
- **Tampons.** Les 5 Mo viennent surtout des poils 3D : chaque hôte poilu crée deux `InstancedMesh` de 128 x 128 instances (brins et ombres). Leurs matrices d'instance (2 x 1 Mo par hôte) ne servent à rien : la position de chaque brin est calculée depuis `instanceIndex`. Le fuzz du pull ajoute 8 copies de sa géométrie.
- **Shaders compilés.** +185 Mo dans le processus GPU pour 13 matières, soit environ 14 Mo par matière avec son fuzz et ses poils. C'est le vrai coût mémoire d'Infinitex.
- **JavaScript.** +58 Mo pour 13 matières : les graphes de nœuds TSL et l'état du compilateur de nœuds. Le mur des 204 matières tient en 158 Mo, car beaucoup de préréglages d'une même famille partagent le même programme.

### Comparaison avec des textures classiques

Jeu de 3 textures par matière (albedo, normal, ORM), mipmaps comprises, pour 13 matières. Mo = 10⁶ octets.

| Format | par texture 2K | 13 matières en 2K | par texture 4K | 13 matières en 4K |
|---|---|---|---|---|
| RGBA8, non compressé | 22 Mo | 872 Mo **[M]** | 89 Mo | 3,5 Go **[E]** |
| BC7 (PC) ou ASTC 4x4 (Apple, mobile) | 5,6 Mo | 218 Mo **[E]** | 22 Mo | 872 Mo **[E]** |
| ASTC 6x6 (mobile) | 2,5 Mo | 97 Mo **[E]** | 9,9 Mo | 388 Mo **[E]** |
| Infinitex | 0 | 0 Mo de textures, +185 Mo de shaders, +58 Mo de JS **[M]** | 0 | idem |

Le PBR 2K mesuré coûte +1,46 Go d'empreinte dans le processus GPU pour 872 Mo de texels : Chrome garde des copies de transfert. Infinitex gagne nettement contre les textures non compressées et contre la 4K. Contre une 2K compressée en BC7, les deux se valent (environ 220 Mo contre 245 Mo). L'avantage d'Infinitex n'est pas là : c'est un détail sans limite au zoom pour le même prix mémoire. Une texture 2K, vue à 6 cm, n'a plus que 0,5 mm par texel.

### Chargement et compilation **[M]**

| | |
|---|---|
| Compilation d'une matière (pipeline WebGPU) | médiane 0,53 s, 90 % sous 0,96 s, pire 2,6 s (Plastique usé, Rouille) |
| Taille du fragment shader WGSL | médiane 103 Ko (1 215 lignes), pire 365 Ko (3 768 lignes, Rouille) |
| Les 204 matières | 96 s de compilation, 298 programmes (vertex et fragment) |
| Scène de jeu, première image | 7,0 s à froid, 1,5 s quand Chrome a déjà les shaders en cache |

Les préréglages d'une même famille qui ne diffèrent que par des uniformes partagent un seul programme. Changer un paramètre (`ix.set()`) ne recompile rien. Le cache de shaders de Metal peut être chaud d'une session à l'autre. Un tout premier lancement sur une machine neuve peut donc être plus lent.

## 5. CPU par image **[M]**

| Mesure | ms par image |
|---|---|
| Scène de jeu, envoi de l'image, Infinitex | 0,65 à 1,1 |
| Même scène, matériaux unis | 0,45 à 0,8 |
| Mur des 204 cubes visibles, Infinitex, 20 hôtes poilus, fuzz | 3,4 |
| Même mur, cubes gris (343 appels de dessin) | 1,5 |
| Fenêtre des poils 3D, hôte statique (960 triangles) | 0,10 par hôte visé |
| Idem dans le mur (parcourt aussi 600 objets pour trouver le soleil) | 0,25 par hôte visé |
| **Fenêtre des poils 3D, hôte skinné, riveraine (11 135 triangles)** | **6,1 par hôte visé** |
| **Idem, torse du mannequin skinné (57 600 triangles)** | **22 par hôte visé** |

Le coût CPU des matières est faible : environ 9 µs par matière et par image. Cela comprend la mise à jour des nœuds et des uniformes. Sauf un point. Chaque hôte poilu lance chaque image un rayon depuis la caméra (`core/hair3d_window.js`). Sur un mesh skinné, three.js skinne chaque sommet testé sur le CPU, sans structure d'accélération. Un personnage de jeu animé avec des poils 3D coûte donc 6 à 22 ms de CPU par image, dès que la caméra bouge en le visant. C'est le principal risque CPU (piège 15 du README, en plus grand).

## 6. Pourquoi : le compromis

**Calcul contre bande passante.** Une texture coûte de la mémoire et de la bande passante : quelques lectures par pixel, servies par le cache. Infinitex coûte du calcul (ALU) : des centaines d'opérations par pixel (bruits, recherches de cellules 3x3, plusieurs échelles de fibres). Sur un GPU moderne, le calcul abonde et la bande passante est rare. Mais nos shaders sont si longs que le calcul domine : 3 à 4 fois le coût d'une image PBR classique.

**Le coût suit les pixels couverts.** Un objet qui couvre 1 % de l'écran coûte 1 % de son coût plein écran. 200 cubes lointains coûtent moins qu'une face qui remplit l'écran. Le personnage, petit à l'écran, coûte peu. Le sol, qui couvre la moitié de l'image, coûte le plus.

**Le coût suit le niveau le plus fin visible, mais pas assez.** `core/lod.js` fait apparaître chaque niveau en fondu selon la taille du pixel. Les niveaux effacés sont pourtant toujours calculés. Le lointain ne coûte donc que 45 % de moins que le proche.

**Surdessin.** Le fuzz ajoute 8 coques transparentes au-dessus du tricot. Les poils 3D ajoutent jusqu'à 2 millions de triangles fins dans une passe à part. Chaque pixel couvert plusieurs fois paie plusieurs fois.

**WebGPU contre natif.** Côté GPU, le WGSL est traduit en MSL, HLSL ou SPIR-V. Le shader final ressemble à un shader natif. On estime l'écart à 10 à 20 % **[E]** : pas de demi-précision (fp16) par défaut, pas d'opérations de sous-groupe, accès mémoire vérifiés. Côté CPU, un appel de dessin WebGPU coûte plusieurs fois plus qu'en natif. Ici cela ne compte pas : 25 à 30 appels par image. La compilation, elle, se fait au chargement dans le navigateur. Un moteur natif précompile ses shaders hors ligne.

## 7. Comment réduire le coût

Gains estimés **[E]**, à valider par mesure.

| Levier | Effet attendu |
|---|---|
| Vraies branches sur l'empreinte du pixel, au lieu de fondus pondérés par zéro | Le lointain retombe au coût du niveau grossier. Le sol à 10 m passerait de +8,5 ms à 1 ou 2 ms. Plus gros gain pour une scène de jeu. |
| Cuire le lointain : la même matière rendue une fois en texture (512² à 1K, BC7) au chargement, Infinitex seulement dans un rayon autour de la caméra | Coût d'une scène PBR (environ 3 ms) au-delà de 2 à 3 m. 1,4 Mo par texture 1K BC7. |
| Paliers du graphe (proche, moyen, loin) : 2 ou 3 variantes compilées par matière, choisies par taille à l'écran | Coût lointain divisé par 2 à 5. Compilation et mémoire des shaders multipliées par 2 ou 3. |
| États de surface (rouille, poussière, boue, brûlé) cuits, ou réservés au proche | Jusqu'à -20 ms sur les matières concernées. |
| Résolution dynamique ou rendu à 75 % et mise à l'échelle | -44 % sur tout ce qui suit les pixels. |
| Poils 3D réservés au héros et aux gros plans. Rayon sur un proxy basse résolution, ou BVH (`three-mesh-bvh`), ou fenêtre mise à jour toutes les 2 à 4 images | De 6 à 22 ms CPU à moins de 0,2 ms. |
| Supprimer les matrices d'instance inutiles des poils 3D | -2 Mo par hôte poilu. |
| Fuzz : moins de coques au loin, aucune sous quelques pixels | Moins de surdessin sur les tricots. |
| Précompiler au chargement (`renderer.compileAsync`) | Pas d'à-coups en jeu. 0,5 à 1 s par matière distincte sur M1 Max, sous un écran de chargement. |
| Demi-précision (`shader-f16`) sur les calculs qui la tolèrent | Jusqu'à 2x d'ALU sur Apple et mobile. Pas sur les coordonnées (piège 8 du README). |

## 8. Machines cibles **[E]**

**Hypothèse.** La scène est limitée par le calcul du GPU. Le temps GPU varie donc à l'inverse du débit FP32 effectif. Référence mesurée : M1 Max, 10,4 TFLOPS. Scène de jeu 1080p : 9,2 ms en troisième personne et 13,2 ms pour le pull plein écran, latence retirée. Les débits sont les valeurs publiques des fabricants, corrigées quand le chiffre affiché compte un double débit que nos shaders n'exploitent pas (Ampere, RDNA 3). Incertitude : ±50 %.

| Machine | débit relatif | 1080p, 3e personne | 1080p, gros plan | Réglage conseillé |
|---|---|---|---|---|
| Apple M1, GPU 8 cœurs | 0,25 | 37 ms, 27 im/s | 53 ms, 19 im/s | 720p, lointain cuit |
| Apple M2, GPU 10 cœurs | 0,35 | 26 ms, 38 im/s | 38 ms, 26 im/s | 900p, lointain cuit |
| Apple M3 ou M4, GPU 10 cœurs | 0,4 à 0,45 | 21 ms, 45 im/s | 30 ms, 33 im/s | lointain cuit pour 60 im/s |
| Apple M1 Pro ou M2 Pro | 0,5 à 0,65 | 14 à 18 ms, 55 à 70 im/s | 20 à 26 ms | 1080p |
| **Apple M1 Max (mesuré)** | **1** | **9,2 ms, environ 100 im/s** | **13,2 ms, 75 im/s** | 1080p ou 1440p |
| Apple M3 Max ou M4 Max, 40 cœurs | 1,5 à 1,7 | 5,5 à 6 ms | 8 à 9 ms | 1440p |
| PC, RTX 3060 (bureau) | 1,0 à 1,3 | 7 à 9 ms, 110 à 140 im/s | 10 à 13 ms | 1080p. 1440p à 60 im/s |
| PC, RTX 4070 | environ 2 | 4,6 ms | 6,6 ms | 1440p |
| Portable, Intel Iris Xe (96 EU) | 0,2 | 46 ms, 22 im/s | 66 ms | 720p, lointain cuit, pas de poils 3D |
| Portable, AMD Radeon 780M | 0,4 | 23 ms, 43 im/s | 33 ms | 900p, lointain cuit |
| iPhone 15 Pro ou 16 Pro (WebGPU dans Safari 26) | 0,12 en charge soutenue | 77 ms à 2 Mpx, 38 ms à 1 Mpx | | pas jouable en l'état |
| Android haut de gamme (Adreno 750) | 0,15 à 0,2 | 46 à 61 ms à 2 Mpx | | pas jouable en l'état |
| Téléphone milieu de gamme | moins de 0,05 | | | non |

Le CPU ne limite sur aucune de ces machines : moins de 1 ms par image. Une seule exception : les poils 3D sur un personnage skinné (section 5).

Sur téléphone, une version jouable demanderait le lointain cuit, une seule matière Infinitex à la fois (l'objet inspecté), un rendu vers 1 Mpx et la demi-précision.

## TLDR

Sur un M1 Max, une scène de jeu entièrement en Infinitex (13 matières) coûte environ 10 ms par image en 1080p, contre 3 ms avec des textures classiques. Soit environ 100 im/s sur cette machine, 40 sur un MacBook Air récent, 25 sur un M1 de base, et rien de jouable sur téléphone en l'état. En mémoire, Infinitex n'a pas de textures, mais ses shaders compilés et son JavaScript pèsent environ 245 Mo. C'est autant qu'un jeu de textures 2K compressées, 3,5 fois moins qu'en 4K compressée et 14 fois moins qu'en 4K brute. Pour un jeu, il faut garder Infinitex pour le proche, cuire le lointain en textures, faire sauter les niveaux effacés au lieu de les pondérer par zéro, et corriger le rayon CPU des poils 3D sur les personnages skinnés (6 à 22 ms).
