# SAMBADA Studio — interface graphique pour SAMBADA

Une application conviviale pour utiliser **SAMBADA** (génomique du paysage) **sans ligne de commande** :
sélection des fichiers, formulaire de paramètres avec aide intégrée, exécution en un clic,
documentation incluse. Conçue pour qu'un·e étudiant·e démarre en quelques minutes.

> **SAMBADA Studio ne modifie pas** le fonctionnement de SAMBADA. C'est une surcouche qui prépare le
> fichier de paramètres et appelle les programmes officiels (`sambada`, `supervision`,
> `recode-plink`, `recode-plink-lfmm`). Les résultats sont identiques à ceux de la ligne de commande.

---

## Pour l'étudiant·e : télécharger et lancer (aucune installation)

Téléchargez l'exécutable correspondant à votre système (page **Releases** du dépôt), puis :

### 🍎 macOS — `SAMBADA-Studio-macOS.zip`
1. Double-cliquez le `.zip` pour le décompresser → vous obtenez **`SAMBADA Studio.app`**.
2. **Clic droit sur l'app → Ouvrir** (la 1re fois seulement), puis confirmez.
   *(macOS bloque par défaut les apps non signées téléchargées ; le clic droit → Ouvrir contourne cela.)*
3. L'application s'ouvre dans **sa propre fenêtre** (pas dans le navigateur). Pour quitter : fermez la fenêtre.

### 🪟 Windows — `SAMBADA-Studio-Windows.zip`
1. Décompressez le `.zip`, puis lancez **`SambadaStudio.exe`**.
2. Si « Windows a protégé votre PC » apparaît : **Informations complémentaires → Exécuter quand même**
   *(normal pour un exécutable non signé).*
3. L'application s'ouvre dans **sa propre fenêtre** (via WebView2, inclus dans Windows 10/11).

### 🐧 Linux — `SAMBADA-Studio-Linux.tar.gz`
```bash
tar xzf SAMBADA-Studio-Linux.tar.gz
chmod +x SambadaStudio
./SambadaStudio
```
*(Sur Linux, l'interface s'affiche dans une fenêtre native si `webkit2gtk` est présent, sinon elle s'ouvre dans le navigateur par défaut — l'usage est identique.)*

**Aucune installation de Python ou de SAMBADA n'est nécessaire** : tout est inclus dans l'exécutable.

---

## Pour l'enseignant·e : produire les exécutables

Un exécutable est **spécifique à chaque système** et doit être **fabriqué sur ce système**.
Deux méthodes :

### A. Automatique via GitHub Actions (recommandé)
Le workflow [`.github/workflows/sambada-studio.yml`](../.github/workflows/sambada-studio.yml) compile et
empaquette les **trois** exécutables (macOS, Windows, Linux) sur les serveurs de GitHub :

- **Manuel** : onglet *Actions* → *SAMBADA Studio — exécutables téléchargeables* → *Run workflow*.
  Les 3 archives apparaissent comme *artifacts* du run.
- **Release** : poussez un tag `studio-vX.Y` (ex. `git tag studio-v1.0 && git push --tags`) → une
  **Release** est créée avec les 3 archives en téléchargement direct pour les étudiants.

### B. Localement (un OS à la fois)
Nécessite **GCC**, **CMake** et **Python 3.11/3.12** sur la machine cible.
> ⚠️ Utilisez **GCC** (pas Clang) : la librairie Scythe embarquée utilise des éléments du C++ retirés
> des versions récentes de Clang/libc++.

| Système | Commande | Produit |
|---|---|---|
| macOS | `bash sambada-gui/packaging/package-macos.sh` | `dist/SAMBADA-Studio-macOS.zip` |
| Linux | `bash sambada-gui/packaging/package-linux.sh` | `dist/SAMBADA-Studio-Linux.tar.gz` |
| Windows | `sambada-gui\packaging\package-windows.bat` | `dist\SAMBADA-Studio-Windows.zip` |

(Outils : macOS → `brew install gcc cmake` ; Linux → `sudo apt install build-essential cmake` ;
Windows → MSYS2 + `pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake`.)

---

## Alternative légère : lancer sans empaqueter

Si Python 3 est installé, on peut lancer l'app directement, sans construire d'exécutable, via les
lanceurs double-clic : `Lancer-SAMBADA-macOS.command`, `Lancer-SAMBADA-Windows.bat`,
`Lancer-SAMBADA-Linux.sh`. (Les binaires SAMBADA doivent alors être présents dans `bin/<système>/` ;
voir les scripts `build/`.)

---

## Contenu du dossier

```
sambada-gui/
├── sambada_gui.py                  ← le serveur local (Python, bibliothèque standard)
├── web/                            ← l'interface (HTML/CSS/JS)
├── docs/                           ← documentation (onglet « Documentation »)
├── examples/                       ← jeu de données d'exemple
├── bin/<macos|windows|linux>/      ← binaires SAMBADA compilés
├── build/                          ← scripts de COMPILATION du C++ (build-*.{sh,bat})
├── packaging/                      ← spec + scripts d'EMPAQUETAGE en exécutable
│   ├── SambadaStudio.spec          ← recette PyInstaller (multiplateforme)
│   └── package-*.{sh,bat}
├── Lancer-SAMBADA-*.{command,bat,sh}  ← lanceurs « léger » (nécessitent Python)
└── dist/                           ← exécutables produits (généré, non versionné)
```

## Note technique de portabilité

Une **unique correction de portabilité** a été appliquée à la librairie tierce Scythe : l'appel obsolète
`finite(x)` a été remplacé par l'équivalent standard `std::isfinite(x)` (5 occurrences dans
`ext/scythestat-1.0.3/`). Ces fonctions sont **strictement équivalentes** ; le comportement numérique de
SAMBADA est inchangé.

## Licence

SAMBADA est distribué sous **GPL v3** (voir `COPYING` et `AUTHORS` à la racine du dépôt).
