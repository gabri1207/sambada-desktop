# SAMBADA Studio — Historique du projet

Récapitulatif des étapes effectuées, pour compaction du contexte.

## Contexte & contraintes

- **Dépôt** : `Sylvie/sambada` cloné en local dans `/Users/gabriel/Desktop/GIT/Sambada`.
- **SAMBADA** : logiciel scientifique C/C++ (génomique du paysage, EPFL/LaSIG), quasi-abandonné (dernier commit juin 2022).
- **Consigne clé** : **NE PAS modifier le comportement de SAMBADA** — surcouches uniquement.
- **Branche de travail** : `feature/sambada-studio-gui` (commit local fait, **push en attente** — auth GitHub non configurée sur la machine).

## 1. Audit de la codebase

- Audit complet en 4 axes (sécurité/mémoire, correction numérique, architecture, build/CI/deps).
- Livré dans **`AUDIT.md`** (racine du dépôt) : ~44 constats (6 critiques dont bug GWR `as.cpp:2469`, détection singularité `J_info`).
- **`AUDIT.md` NON commité** (divulgation de vulnérabilités sur dépôt potentiellement public).

## 2. Compilation des binaires

- **Contrainte** : SAMBADA ne compile qu'avec **GCC** (pas Clang/libc++ moderne).
- Installé GCC 16 via Homebrew ; compilé avec CMake + `-static-libstdc++ -static-libgcc`.
- **Patch de portabilité** (comportement identique) : `finite()` → `std::isfinite()` dans `ext/scythestat-1.0.3/scythestat/{distributions.h,rng.h}` (5 occurrences).
- 4 binaires produits, autonomes (dépendent uniquement de libSystem) : `sambada`, `supervision`, `recode-plink`, `recode-plink-lfmm` → copiés dans `sambada-gui/bin/macos/`.

## 3. Interface graphique (SAMBADA Studio)

Wrapper pur (aucune logique scientifique réimplémentée) dans `sambada-gui/` :

- **Backend** `sambada_gui.py` : serveur HTTP (stdlib Python seulement). Endpoints : `/api/info|browse|file|open|run|doc|results|quit`. `/api/run` écrit le fichier de paramètres, lance le binaire, **streame** le log.
- **Frontend** `web/` (HTML/CSS/JS vanilla) : formulaire piloté par schéma, aperçu live du fichier de paramètres, sélecteur de fichiers, console de streaming.
- **Fenêtre native** via **pywebview** (WKWebView macOS / WebView2 Windows), repli navigateur, **ouverture maximisée**.

## 4. Empaquetage multiplateforme (exécutable téléchargeable)

- **PyInstaller** (venv Python 3.12) : `.app` macOS / `.exe` Windows / binaire Linux, ressources embarquées.
- Recette `packaging/SambadaStudio.spec` + scripts `packaging/package-*.{sh,bat}`.
- Workflow **`.github/workflows/sambada-studio.yml`** : build C++ (GCC/MinGW) + PyInstaller sur les 3 OS, publie une Release sur tag `studio-v*` (ou déclenchement manuel). **CI NON déclenchée** (à la demande).
- Archive testée : `dist/SAMBADA-Studio-macOS.zip` (~14 Mo).

## 5. Design & UX (raffinements successifs)

- Design épuré retenu (maquette utilisateur) : étapes numérotées `01…05`, labels + noms de paramètres monospace, panneau "paramètres générés" avec numéros de ligne.
- Alignement "Header row" + "Separator" sur une ligne.
- Panneau paramètres en **fond noir / texte blanc**.
- Uniformisation hauteur des `<select>` (40 px, chevron custom).
- **Logos v6** intégrés : wordmark "Samβada STUDIO" dans l'en-tête + README ; icône β en `.icns`/`.ico` (icône d'app) + favicon. Assets dans `web/assets/`.
- **Tout en anglais** (UI + backend + README + docs). Onglets **Documentation** et **About** poussés à droite.

## 6. Documentation intégrée

- `docs/` (en anglais) : `guide-demarrage.md`, `parametres.md`, `formats.md`, rendues dans l'onglet Documentation.

## 7. Test sur l'exemple Maroc

- Dossier `example_morrocco/` (données privées, **NON commité**) : `parameters.txt`, `env-data-Morocco.txt`, `mol-data-Morocco.txt`.
- Config validée : 26 var. env., 19630 marqueurs, 160 individus, ID `Name`, 2 fichiers — **rien ne manquait**.
- **Exécution réussie** : 480 000 modèles, 478 258 valides, 640 associations p<0,001, meilleure p=6,9e-8. Marqueur `X23.44071708_2` (chr 23) confirme la région candidate de `ensembl.txt`.

## 8. Onglet "Results"

- Nouvel onglet de visualisation (lecture seule) : charge un fichier `-Out-N`, calcule les **p-values** (chi²) côté backend, tri/filtre serveur (fichiers ~160 Mo).
- Affiche : cartes résumé, graphique top-15 associations (barres), tableau triable/filtrable (Marker, Variable, G-score, p-value, Wald, Nagelkerke R², AIC, β).
- Bouton **📊 View results** dans la modale d'exécution.

## 9. Mode démo (pré-remplissage)

- Variable d'env. **`SAMBADA_DEMO_DIR`** → si le dossier contient `parameters.txt`, le formulaire est pré-rempli automatiquement (`build_demo` côté backend, `applyDemo` côté frontend).
- Testé : app lancée avec formulaire Maroc entièrement pré-rempli, prêt à lancer.

## État final

- **Local, non poussé** : branche `feature/sambada-studio-gui` (commit initial fait avec `[skip ci]`), + tous les raffinements depuis (design, logos, anglais, onglet Results, mode démo) **pas encore recommités**.
- **Exclus du commit** : `AUDIT.md`, `.claude/`, `example_morrocco/`, `sambada_logos/`, `dist/`, `.venv/`, `build/`.
- **Push bloqué** : aucune auth GitHub configurée (helper osxkeychain sans identifiant, `gh` absent). À finaliser côté utilisateur.

## Prochaines étapes possibles

- Recommiter les raffinements sur la branche + pousser (auth requise).
- Déclencher la CI (tag `studio-v1.0`) pour générer les 3 exécutables téléchargeables.
- Idées : export CSV depuis Results, graphe Manhattan, bouton "Load Morocco example" dans l'UI.

## Mémoires projet (`~/.claude/.../memory/`)

- `no-functional-changes.md`, `build-requires-gcc.md`, `sambada-gui-deliverable.md`, `AUDIT.md`.
