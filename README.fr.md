# Dithering

Un panneau Photoshop qui applique un effet de dithering directement sur un calque, sans aplatir l'image, passer en niveaux de gris ni redimensionner le document.

[English version](README.md)

## Statut

Version 1.0.0. *Ajouter un calque Dithering* crée un calque qui trame tout ce qui est en dessous (ou seulement le calque auquel il est écrêté). Les réglages le mettent à jour en direct, et il peut se mettre à jour seul quand les calques en dessous changent. Un calque Dithering peut être dupliqué, copié dans un autre document ou converti en calque normal, et garde ses réglages dans le document. Il a été peu testé : signale tout problème dans une issue.

Limites connues : les documents 32 bits ne sont pas pris en charge, et un calque Dithering garde ses réglages dans le document, donc reste modifiable après la fermeture du fichier.

## Objectifs

- Appliquer l'effet à n'importe quel calque, y compris les objets dynamiques, sans détruire l'original.
- Algorithmes classiques : Floyd-Steinberg, Atkinson, Stucki, Sierra Lite, Bayer (2×2 à 16×16), bruit bleu et demi-teinte (carré, hexagone, radial, ligne, cercle), avec taille, contraste et luminosité.
- De 2 à 16 niveaux, en noir et blanc ou en conservant les couleurs canal par canal.
- Léger : aucune dépendance, aucun calcul en arrière-plan quand le panneau est inactif.
- Un panneau ancrable qui suit le thème de Photoshop, en français et en anglais.
- Facile à étendre : un nouvel algorithme tient dans un fichier, un nouveau réglage dans une ligne de schéma, et tous les champs du panneau sont stylés depuis une seule feuille de styles.

## Compatibilité

Photoshop 26.0 et suivants (l'interface utilise les Spectrum Web Components, qui demandent un UXP récent). Développé et testé sur Photoshop 28.

## Installer

Télécharge `Dithering-<version>.ccx` dans la [dernière release](https://github.com/Nessteruk/photoshop-dithering/releases/latest) et double-clique dessus : Creative Cloud l'installe dans Photoshop 26 ou suivant. Ouvre ensuite **Modules externes > Dithering**. Le plugin est distribué hors de l'Adobe Marketplace : Photoshop peut afficher un avertissement de plugin non vérifié.

### Windows sur ARM (non officiel)

Sur Windows sur ARM (Surface Pro avec une puce Snapdragon), Creative Cloud ne sait pas installer un `.ccx` : le double-clic ne fait rien. Le plugin est du JavaScript pur, sans rien de propre au processeur. En contournement, ferme Photoshop, télécharge `Dithering-<version>.ccx` et [`tools/install-manual.ps1`](tools/install-manual.ps1) dans le même dossier, puis lance dans PowerShell :

```
powershell -ExecutionPolicy Bypass -File .\install-manual.ps1 -Package .\Dithering-<version>.ccx
```

Le script copie le plugin dans `%APPDATA%\Adobe\UXP\Plugins\External` et l'enregistre dans `PluginsInfo\v1\PS.json`, ce que fait Creative Cloud sur les machines x86. Relance Photoshop, puis **active le mode développeur** dans **Édition > Préférences > Modules externes** (« Activer le mode développeur ») et relance Photoshop une seconde fois : sans cela, le menu **Modules externes** ne s'affiche pas sur ARM, donc la fenêtre Dithering ne peut pas s'ouvrir. Ouvre ensuite **Modules externes > Dithering**. `-Uninstall` le retire. Adobe ne prend pas en charge ce contournement.

## Installer pour le développement

1. Installe **UXP Developer Tool** depuis l'application Creative Cloud, et Node.js 22 ou plus.
2. Dans ce dossier, lance `npm install` puis `npm run build`. La compilation écrit `dist/main.js`, que le panneau charge.
3. Lance Photoshop, puis UXP Developer Tool.
4. Clique sur **Add Plugin** et choisis `manifest.json` dans ce dossier, puis **Load**.
5. Dans Photoshop, ouvre **Modules externes > Dithering**. Le panneau peut être ancré comme Calques ou Propriétés.

Après une modification dans `src`, lance `npm run build` (ou `npm run watch`) puis clique sur **Reload** dans UXP Developer Tool. Une modification de `styles.css` ou de `index.html` ne demande que **Reload**.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (en anglais). Ajouter un réglage ou un algorithme demande quelques lignes. Les décisions de conception sont dans [docs/DECISIONS.md](docs/DECISIONS.md).

```
npm test
```

## Licence

[MIT](LICENSE). Les Spectrum Web Components embarqués et leurs dépendances gardent leurs propres licences, listées dans [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
