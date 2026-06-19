/* =====================================================================
   SAMBADA Studio — logique de l'interface (vanilla JS, aucune dépendance)
   ===================================================================== */
"use strict";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let INFO = null;
let lastParamText = "";

window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    INFO = await (await fetch("/api/info")).json();
  } catch (e) {
    INFO = { platform: "?", binaries: {}, home: "" };
  }
  renderEnvBadge();
  renderSambadaForm();
  renderRecodeForm();
  wireTabs();
  loadDoc("guide-demarrage.md");
}

function platLabel(p) { return ({ macos: "macOS", windows: "Windows", linux: "Linux" })[p] || p; }

function renderEnvBadge() {
  const b = INFO.binaries || {};
  const ok = b["sambada"];
  const q = $("#quitBtn"); if (q) q.hidden = !!INFO.native;     // fenêtre native -> pas de bouton Quitter
  $("#verLine").textContent = `v0.9.1 · ${platLabel(INFO.platform)}`;
  const st = $("#statusLine");
  st.className = "status" + (ok ? "" : " bad");
  st.innerHTML = `<span class="dot"></span>` + (ok ? "moteur prêt" : "binaire manquant");
  $("#aboutEnv").textContent =
    `Plateforme   : ${platLabel(INFO.platform)}\n` +
    `Affichage    : ${INFO.native ? "fenêtre native" : "navigateur"}\n` +
    `Python       : ${INFO.python || "?"}\n` +
    `Binaires     : ${Object.entries(b).map(([k, v]) => `${k}=${v ? "ok" : "ABSENT"}`).join("  ")}`;
}

/* ---------- Onglets ---------- */
function wireTabs() {
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.remove("active"));
    $$(".panel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("#tab-" + t.dataset.tab).classList.add("active");
  }));
  $$(".doc-link").forEach(l => l.addEventListener("click", () => {
    $$(".doc-link").forEach(x => x.classList.remove("active"));
    l.classList.add("active");
    loadDoc(l.dataset.doc);
  }));
}

/* =====================================================================
   Helpers de rendu
   ===================================================================== */
function field(opts) {
  // opts: {id,label,param,type,req,help,hint,ph,options,val,attrs,wide}
  const param = opts.param ? `<span class="fld-param">${opts.param}</span>` : "";
  const req = opts.req ? `<span class="fld-req">· requis</span>` : "";
  const help = opts.help ? `<span class="help-dot" data-help="${esc(opts.help)}">?</span>` : "";
  const hint = opts.hint ? `<span class="fld-hint">${opts.hint}</span>` : "";
  let input;
  if (opts.type === "select") {
    input = `<select id="${opts.id}">` +
      opts.options.map(o => `<option value="${o.v}" ${o.v === opts.val ? "selected" : ""}>${o.t}</option>`).join("") +
      `</select>`;
  } else if (opts.type === "file" || opts.type === "dir") {
    input = `<div class="input-file"><input type="text" id="${opts.id}" placeholder="${opts.ph || ""}" value="${opts.val || ""}">` +
      `<button type="button" data-pick="${opts.type}" data-target="${opts.id}">Parcourir</button></div>`;
  } else {
    input = `<input type="${opts.type || "text"}" id="${opts.id}" placeholder="${opts.ph || ""}" value="${opts.val ?? ""}" ${opts.attrs || ""}>`;
  }
  return `<div class="fld ${opts.wide ? "wide" : ""}" data-field="${opts.id}">
    <div class="fld-head"><span class="fld-label">${opts.label}</span>${param}${req}${help}</div>${input}${hint}</div>`;
}

function checkField(id, label, help, checked) {
  return `<div class="chk wide" data-field="${id}">
    <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
    <label for="${id}">${label} ${help ? `<span class="help-dot" data-help="${esc(help)}">?</span>` : ""}</label></div>`;
}

function section(num, title, sub, body) {
  return `<div class="step">
    <div class="step-num">${num}</div>
    <div class="step-body">
      <div class="step-title">${title}</div>
      <div class="step-sub">${sub}</div>
      <div class="step-grid">${body}</div>
    </div></div>`;
}

/* =====================================================================
   FORMULAIRE SAMBADA
   ===================================================================== */
function renderSambadaForm() {
  const home = INFO.home || "";
  const f = $("#sambadaForm");
  f.innerHTML =
    section("01", "Fichiers de données", "Source des génotypes et variables environnementales.",
      checkField("twoFiles", "Données réparties dans <b>deux fichiers</b> (environnement, puis marqueurs)",
        "Cochez si environnement et marqueurs sont dans deux fichiers distincts. Sinon, un seul fichier contenant tout.") +
      field({ id: "dataFile1", label: "Fichier de données", param: "DATAFILE", type: "file", req: true, wide: true,
        ph: "/chemin/vers/donnees.csv",
        help: "Le fichier contenant vos données (un seul fichier = environnement + marqueurs ensemble)." }) +
      field({ id: "dataFile2", label: "Fichier des marqueurs", param: "MARKERFILE", type: "file", wide: true,
        ph: "/chemin/vers/marqueurs.csv", help: "Utilisé uniquement en mode deux fichiers." }) +
      `<div class="fld wide inline" data-field="hdrsep">
        <label class="chk-mini"><input type="checkbox" id="headers" checked> <span>Ligne d'en-têtes</span></label>
        <div class="sep-mini"><span class="fld-label">Séparateur</span>
          <select id="worddelim">
            <option value="space" selected>Espace ( )</option>
            <option value=",">Virgule (,)</option>
            <option value=";">Point-virgule (;)</option>
            <option value="\t">Tabulation</option>
            <option value="custom">Autre…</option>
          </select></div></div>` +
      field({ id: "worddelimCustom", label: "Séparateur personnalisé", param: "WORDDELIM", wide: true,
        ph: "un seul caractère", hint: "Utilisé si « Autre… » est choisi." })
    ) +
    section("02", "Description des données", "Dimensions du jeu de données.",
      field({ id: "numvarenv", label: "Variables d'env.", param: "NUMVARENV", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Nombre de colonnes de variables environnementales." }) +
      field({ id: "nummark", label: "Marqueurs", param: "NUMMARK", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Nombre de marqueurs génétiques (SNP) à analyser." }) +
      field({ id: "numindiv", label: "Individus", param: "NUMINDIV", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Nombre de lignes de données (individus échantillonnés)." }) +
      field({ id: "idindiv", label: "Colonne identifiant", param: "IDINDIV", ph: "ID",
        help: "Nom (si en-têtes) ou numéro 0…N-1 (sinon) de la colonne des identifiants." }) +
      field({ id: "colsupenv", label: "Colonnes d'env. ignorées", param: "COLSUPENV", ph: "ex : ID x y",
        help: "Colonnes inactives parmi l'environnement (noms ou numéros séparés par des espaces)." }) +
      field({ id: "colsupmark", label: "Colonnes marqueurs ignorées", param: "COLSUPMARK", ph: "ex : ID",
        help: "Colonnes inactives parmi les marqueurs." }) +
      field({ id: "subsetvarenv", label: "Sous-ensemble d'env.", param: "SUBSETVARENV", ph: "liste de colonnes",
        help: "Restreindre l'analyse à ces variables d'environnement." }) +
      field({ id: "subsetmark", label: "Sous-ensemble de marqueurs", param: "SUBSETMARK", ph: "liste de colonnes",
        help: "Restreindre l'analyse à ces marqueurs." })
    ) +
    section("03", "Modèles &amp; sauvegarde", "Critères de calcul et de sélection.",
      field({ id: "dimmax", label: "Dimension maximale", param: "DIMMAX", type: "number", val: "1", attrs: "min=1",
        help: "1 = univarié, 2 = bivarié, 3 = trivarié… Nombre maximal de variables d'env. par modèle." }) +
      field({ id: "savetypeTiming", label: "Moment de sauvegarde", param: "SAVETYPE", type: "select", val: "END",
        help: "END = à la fin du calcul ; REAL = en temps réel pendant le calcul.",
        options: [{ v: "END", t: "À la fin (END)" }, { v: "REAL", t: "Temps réel (REAL)" }] }) +
      field({ id: "savetypeScope", label: "Modèles à garder", type: "select", val: "ALL",
        help: "ALL = tous les modèles ; BEST = seulement les significatifs (nécessite un seuil de p-valeur).",
        options: [{ v: "ALL", t: "Tous (ALL)" }, { v: "BEST", t: "Significatifs (BEST)" }] }) +
      field({ id: "savetypePval", label: "Seuil de p-valeur", type: "number", val: "0.01", attrs: "step=0.001 min=0",
        help: "Requis avec « Significatifs (BEST) »." }) +
      field({ id: "populationvar", label: "Structure de population", param: "POPULATIONVAR", type: "select", val: "",
        help: "Intègre des variables de population (préfixées « pop »). Nécessite SAVETYPE ALL.",
        options: [{ v: "", t: "Aucune" }, { v: "FIRST", t: "En premier (FIRST)" }, { v: "LAST", t: "En dernier (LAST)" }] }) +
      checkField("storey", "Histogrammes pour le contrôle FDR (STOREY)",
        "Produit les histogrammes de scores (méthode de Storey). Nécessite SAVETYPE ALL.")
    ) +
    section("04", "Analyse spatiale", "Voisinage, autocorrélation, GWR — facultatif.",
      checkField("spatialEnable", "Activer l'analyse spatiale (SPATIAL)",
        "Nécessaire pour l'autocorrélation, la GWR et l'export shapefile. Requiert des colonnes de coordonnées.") +
      field({ id: "spatialLon", label: "Longitude / X", ph: "ex : x",
        help: "Nom (si en-têtes) ou numéro de la colonne de longitude (ou X en cartésien)." }) +
      field({ id: "spatialLat", label: "Latitude / Y", ph: "ex : y",
        help: "Nom (si en-têtes) ou numéro de la colonne de latitude (ou Y en cartésien)." }) +
      field({ id: "spatialCoord", label: "Type de coordonnées", type: "select", val: "CARTESIAN",
        help: "SPHERICAL = degrés lon/lat ; CARTESIAN = plan X/Y.",
        options: [{ v: "CARTESIAN", t: "Cartésiennes (X/Y)" }, { v: "SPHERICAL", t: "Sphériques (lon/lat)" }] }) +
      field({ id: "spatialNeigh", label: "Voisinage / pondération", type: "select", val: "BISQUARE",
        help: "DISTANCE / GAUSSIAN / BISQUARE (bandwidth) ou NEAREST (nombre de voisins).",
        options: [{ v: "DISTANCE", t: "Distance (DISTANCE)" }, { v: "GAUSSIAN", t: "Gaussienne (GAUSSIAN)" }, { v: "BISQUARE", t: "Bicarrée (BISQUARE)" }, { v: "NEAREST", t: "k plus proches (NEAREST)" }] }) +
      field({ id: "spatialScale", label: "Paramètre d'échelle", type: "number", val: "5", attrs: "step=any min=0",
        help: "Bandwidth (DISTANCE/GAUSSIAN/BISQUARE) ou nombre de voisins (NEAREST)." }) +
      checkField("autocorrEnable", "Autocorrélation spatiale (AUTOCORR)",
        "Indices de Moran/Geary, avec test par permutations.") +
      field({ id: "autocorrType", label: "Portée", type: "select", val: "BOTH",
        help: "Globale, locale ou les deux.",
        options: [{ v: "BOTH", t: "Globale + locale" }, { v: "GLOBAL", t: "Globale" }, { v: "LOCAL", t: "Locale" }] }) +
      field({ id: "autocorrVars", label: "Variables", type: "select", val: "BOTH",
        help: "Environnement, marqueurs ou les deux.",
        options: [{ v: "BOTH", t: "Env. + marqueurs" }, { v: "ENV", t: "Environnement" }, { v: "MARK", t: "Marqueurs" }] }) +
      field({ id: "autocorrPerm", label: "Permutations", type: "number", val: "9999", attrs: "min=1",
        help: "Permutations du test de significativité (9999 recommandé)." }) +
      checkField("gwrEnable", "Régression géographiquement pondérée (GWR)",
        "Régression locale pondérée par le voisinage spatial.") +
      checkField("shapefileEnable", "Export shapefile (SHAPEFILE)",
        "Produit des fichiers .shp/.shx/.dbf ouvrables dans un SIG (QGIS, ArcGIS).")
    ) +
    section("05", "Sortie", "Emplacement et nom des résultats.",
      field({ id: "outputDir", label: "Dossier de sortie", type: "dir", req: true, wide: true, val: home,
        ph: "dossier où écrire les résultats", help: "Les résultats seront écrits dans ce dossier." }) +
      field({ id: "outputBase", label: "Nom de base des résultats", param: "OUTPUTFILE", wide: true, val: "resultats-sambada",
        help: "Préfixe des fichiers produits (ex. resultats-sambada-Out-1)." }) +
      field({ id: "logName", label: "Fichier journal", param: "LOG", ph: "(automatique)",
        help: "Nom du fichier de journal d'exécution." }) +
      field({ id: "unconverged", label: "Modèles divergents", param: "UNCONVERGEDMODELS", ph: "(facultatif)",
        help: "Fichier listant les modèles n'ayant pas convergé." })
    );

  f.addEventListener("input", updateSambadaPreview);
  f.addEventListener("change", updateSambadaPreview);
  f.addEventListener("click", e => {
    const pick = e.target.closest("[data-pick]");
    if (pick) openFilePicker(pick.dataset.pick, pick.dataset.target);
  });
  $("#copyParam").addEventListener("click", () => {
    navigator.clipboard.writeText(lastParamText);
    const btn = $("#copyParam"); btn.textContent = "copié ✓";
    setTimeout(() => btn.textContent = "copier", 1200);
  });
  $("#runSambada").addEventListener("click", runSambada);
  updateSambadaPreview();
}

/* ---------- Construction du fichier de paramètres ---------- */
function val(id) { const e = $("#" + id); return e ? e.value.trim() : ""; }
function checked(id) { const e = $("#" + id); return e ? e.checked : false; }
function q(s) { return /\s/.test(s) ? `"${s}"` : s; }

function buildSambadaParam() {
  const errors = [], warnings = [], missing = [], lines = [];
  const twoFiles = checked("twoFiles");

  lines.push("HEADERS " + (checked("headers") ? "Yes" : "No"));
  const wd = val("worddelim");
  let delim = null;
  if (wd === "space") delim = null;
  else if (wd === "custom") delim = val("worddelimCustom") || null;
  else if (wd === "\t") delim = "\t";
  else delim = wd;
  if (delim) lines.push(`WORDDELIM "${delim === "\t" ? "\\t" : delim}"`);

  const nv = val("numvarenv"), nm = val("nummark"), ni = val("numindiv");
  if (!nv || +nv <= 0) missing.push("NUMVARENV");
  if (!nm || +nm <= 0) missing.push("NUMMARK");
  if (!ni || +ni <= 0) missing.push("NUMINDIV");
  if (nv) lines.push("NUMVARENV " + nv);
  if (nm) lines.push("NUMMARK " + nm);
  if (ni) lines.push("NUMINDIV " + ni);
  if (val("idindiv")) lines.push("IDINDIV " + q(val("idindiv")));
  if (val("colsupenv")) lines.push("COLSUPENV " + val("colsupenv"));
  if (val("colsupmark")) lines.push("COLSUPMARK " + val("colsupmark"));
  if (val("subsetvarenv")) lines.push("SUBSETVARENV " + val("subsetvarenv"));
  if (val("subsetmark")) lines.push("SUBSETMARK " + val("subsetmark"));

  lines.push("DIMMAX " + (val("dimmax") || "1"));

  if (checked("spatialEnable")) {
    const lon = val("spatialLon"), lat = val("spatialLat");
    if (!lon || !lat) errors.push("Analyse spatiale : indiquez longitude et latitude.");
    const scale = val("spatialScale") || "5";
    lines.push(`SPATIAL ${q(lon)} ${q(lat)} ${val("spatialCoord")} ${val("spatialNeigh")} ${scale}`);
    if (checked("autocorrEnable"))
      lines.push(`AUTOCORR ${val("autocorrType")} ${val("autocorrVars")} ${val("autocorrPerm") || "9999"}`);
    if (checked("gwrEnable")) lines.push("GWR");
    if (checked("shapefileEnable")) lines.push("SHAPEFILE");
  } else if (checked("autocorrEnable") || checked("gwrEnable") || checked("shapefileEnable")) {
    warnings.push("AUTOCORR, GWR et SHAPEFILE nécessitent l'analyse spatiale (ignorés).");
  }

  const scope = val("savetypeScope"), timing = val("savetypeTiming");
  if (scope === "ALL") {
    lines.push(`SAVETYPE ${timing} ALL`);
  } else {
    const p = val("savetypePval");
    if (!p) errors.push("Avec BEST, un seuil de p-valeur est requis.");
    lines.push(`SAVETYPE ${timing} BEST ${p || "0.01"}`);
  }

  if (val("populationvar")) {
    lines.push("POPULATIONVAR " + val("populationvar"));
    if (scope !== "ALL") errors.push("POPULATIONVAR nécessite SAVETYPE = Tous (ALL).");
  }
  if (checked("storey")) {
    lines.push("STOREY");
    if (scope !== "ALL") errors.push("STOREY nécessite SAVETYPE = Tous (ALL).");
  }

  const base = val("outputBase") || "resultats-sambada";
  lines.push("OUTPUTFILE " + q(base));
  if (val("logName")) lines.push("LOG " + q(val("logName")));
  if (val("unconverged")) lines.push("UNCONVERGEDMODELS " + q(val("unconverged")));

  const df1 = val("dataFile1"), df2 = val("dataFile2");
  if (!df1) missing.push("DATAFILE");
  if (twoFiles && !df2) missing.push("MARKERFILE");
  const args = twoFiles ? [df1, df2] : [df1];

  if (!val("outputDir")) errors.push("Indiquez le dossier de sortie.");

  return {
    text: lines.join("\n") + "\n",
    args: args.filter(Boolean),
    cwd: val("outputDir"),
    paramFileName: base + "-parametres.txt",
    errors, warnings, missing,
  };
}

function updateSambadaPreview() {
  const cust = $('[data-field="worddelimCustom"]');
  if (cust) cust.style.display = val("worddelim") === "custom" ? "" : "none";
  const f2 = $('[data-field="dataFile2"]');
  if (f2) f2.style.display = checked("twoFiles") ? "" : "none";

  const r = buildSambadaParam();
  lastParamText = r.text;
  const linesArr = r.text.replace(/\n+$/, "").split("\n");
  $("#paramPreview").innerHTML = linesArr.map((l, i) =>
    `<div class="cl"><span class="ln">${i + 1}</span><span class="ct">${esc(l)}</span></div>`).join("");

  let html = "";
  if (r.missing.length) {
    html += `<div class="miss-h">${r.missing.length} paramètre${r.missing.length > 1 ? "s" : ""} manquant${r.missing.length > 1 ? "s" : ""}</div>` +
      r.missing.map(m => `<div class="miss-i">— ${m}</div>`).join("");
  }
  html += r.errors.map(e => `<div class="miss-e">⚠ ${e}</div>`).join("");
  html += r.warnings.map(w => `<div class="miss-e">• ${w}</div>`).join("");
  if (!r.missing.length && !r.errors.length) html += `<div class="ready">✓ Prêt à lancer</div>`;
  $("#validationMsg").innerHTML = html;
  $("#runSambada").disabled = r.missing.length > 0 || r.errors.length > 0;
}

async function runSambada() {
  const r = buildSambadaParam();
  if (r.missing.length || r.errors.length) return;
  await runTool({ tool: "sambada", title: "Analyse SAMBADA", cwd: r.cwd,
    paramText: r.text, paramFileName: r.paramFileName, args: r.args });
}

/* =====================================================================
   FORMULAIRE RECODE-PLINK
   ===================================================================== */
function renderRecodeForm() {
  const f = $("#recodeForm");
  f.innerHTML =
    section("01", "Paramètres du recodage", "Conversion de données Plink (.ped / .map) vers SAMBADA ou LFMM.",
      field({ id: "rcTool", label: "Format de sortie", type: "select", val: "recode-plink",
        help: "recode-plink → format SAMBADA ; recode-plink-lfmm → format LFMM.",
        options: [{ v: "recode-plink", t: "Format SAMBADA" }, { v: "recode-plink-lfmm", t: "Format LFMM" }] }) +
      field({ id: "rcSamples", label: "Échantillons", param: "nbSamples", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Nombre d'individus dans le fichier .ped." }) +
      field({ id: "rcSnp", label: "SNP (marqueurs)", param: "nbSNP", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Nombre de marqueurs dans le fichier .map." }) +
      field({ id: "rcPed", label: "Fichier Plink", param: ".ped / .map", type: "file", req: true, wide: true,
        ph: "/chemin/vers/donnees.ped", help: "Le .ped ou .map (même nom de base, même dossier)." }) +
      field({ id: "rcOut", label: "Fichier de sortie", req: true, wide: true, val: "donnees-recodees.txt",
        help: "Fichier résultat au format choisi." }) +
      field({ id: "rcSubset", label: "Sous-échantillon", type: "file", wide: true, ph: "(facultatif)",
        help: "Liste d'individus à conserver. Vide = tous." }) +
      field({ id: "rcOutDir", label: "Dossier de sortie", type: "dir", req: true, wide: true, val: INFO.home || "",
        help: "Dossier où écrire le fichier recodé." })
    );
  f.addEventListener("input", updateRecodePreview);
  f.addEventListener("change", updateRecodePreview);
  f.addEventListener("click", e => {
    const pick = e.target.closest("[data-pick]");
    if (pick) openFilePicker(pick.dataset.pick, pick.dataset.target);
  });
  $("#runRecode").addEventListener("click", runRecode);
  updateRecodePreview();
}

function buildRecode() {
  const errors = [];
  const tool = val("rcTool");
  const s = val("rcSamples"), n = val("rcSnp"), ped = val("rcPed"), out = val("rcOut"), sub = val("rcSubset");
  if (!s || +s <= 0) errors.push("Nombre d'échantillons requis (> 0).");
  if (!n || +n <= 0) errors.push("Nombre de SNP requis (> 0).");
  if (!ped) errors.push("Fichier Plink (.ped/.map) requis.");
  if (!out) errors.push("Nom du fichier de sortie requis.");
  if (!val("rcOutDir")) errors.push("Dossier de sortie requis.");
  const args = [s, n, ped, out];
  if (sub) args.push(sub);
  return { tool, args: args.filter(x => x !== ""), cwd: val("rcOutDir"), errors };
}

function updateRecodePreview() {
  const r = buildRecode();
  const cmd = `${r.tool} ${r.args.map(a => /\s/.test(a) ? `"${a}"` : a).join(" ")}`;
  $("#recodePreview").innerHTML = `<div class="cl"><span class="ln">$</span><span class="ct">${esc(cmd)}</span></div>`;
  $("#recodeValidation").innerHTML = r.errors.length
    ? r.errors.map(e => `<div class="miss-e">⚠ ${e}</div>`).join("")
    : `<div class="ready">✓ Prêt à lancer</div>`;
  $("#runRecode").disabled = r.errors.length > 0;
}

async function runRecode() {
  const r = buildRecode();
  if (r.errors.length) return;
  await runTool({ tool: r.tool, title: "Recodage Plink", cwd: r.cwd, args: r.args });
}

/* =====================================================================
   EXÉCUTION (streaming)
   ===================================================================== */
async function runTool(payload) {
  const modal = $("#runModal"), cons = $("#console"), results = $("#results"), status = $("#runStatus");
  $("#runTitle").textContent = payload.title;
  cons.textContent = "";
  results.innerHTML = "";
  status.textContent = "en cours…";
  status.className = "run-status";
  $("#openOutputDir").hidden = true;
  modal.classList.add("show");

  let buffer = "";
  try {
    const res = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "erreur " + res.status }));
      cons.textContent = "[ERREUR] " + (j.error || res.status);
      status.textContent = "échec"; status.className = "run-status fail";
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const idx = buffer.indexOf("__SAMBADA_DONE__");
      cons.textContent = idx >= 0 ? buffer.slice(0, idx) : buffer;
      cons.scrollTop = cons.scrollHeight;
    }
  } catch (e) {
    cons.textContent += "\n[ERREUR réseau] " + e;
    status.textContent = "échec"; status.className = "run-status fail";
    return;
  }

  const idx = buffer.indexOf("__SAMBADA_DONE__");
  if (idx >= 0) {
    cons.textContent = buffer.slice(0, idx).trimEnd();
    let summary = {};
    try { summary = JSON.parse(buffer.slice(idx + "__SAMBADA_DONE__".length).trim()); } catch (_) {}
    const ok = summary.exitCode === 0;
    status.textContent = ok ? "terminé ✓" : `code de sortie ${summary.exitCode}`;
    status.className = "run-status " + (ok ? "ok" : "fail");
    if (summary.cwd) {
      $("#openOutputDir").hidden = false;
      $("#openOutputDir").onclick = () => fetch("/api/open?path=" + encodeURIComponent(summary.cwd));
    }
    const files = summary.produced || [];
    if (files.length) {
      results.innerHTML = `<p style="font-size:13px;color:var(--ink2);margin:12px 4px 4px">${files.length} fichier(s) produit(s) :</p>` +
        files.map(fl => `<div class="result-item">
          <span class="fname">${esc(fl.name)}</span>
          <span class="fsize">${fmtSize(fl.size)}</span>
          <button class="ghost small" data-preview="${esc(fl.path)}">👁 Aperçu</button>
          <button class="ghost small" data-osopen="${esc(fl.path)}">📂 Ouvrir</button>
        </div>`).join("");
    } else if (ok) {
      results.innerHTML = `<p style="font-size:13px;color:var(--ink2);margin:12px 4px">Terminé (aucun nouveau fichier détecté).</p>`;
    }
  } else {
    status.textContent = "terminé"; status.className = "run-status ok";
  }
}

$("#closeRun")?.addEventListener("click", () => $("#runModal").classList.remove("show"));

$("#quitBtn")?.addEventListener("click", async () => {
  if (!confirm("Arrêter SAMBADA Studio ? Vous pourrez ensuite fermer cet onglet.")) return;
  try { await fetch("/api/quit"); } catch (_) {}
  document.body.innerHTML =
    '<div style="padding:70px 20px;text-align:center;font-family:system-ui;color:#5b6776">' +
    '<div style="font-size:42px">🧬</div>' +
    '<h2 style="color:#1d2a38">SAMBADA Studio est arrêté</h2>' +
    '<p>Vous pouvez fermer cet onglet en toute sécurité.</p></div>';
});

$("#results")?.addEventListener("click", async e => {
  const pv = e.target.closest("[data-preview]");
  if (pv) {
    const item = pv.closest(".result-item");
    const next = item.nextElementSibling;
    if (next && next.classList.contains("file-view")) { next.remove(); return; }
    let data = {};
    try { data = await (await fetch("/api/file?path=" + encodeURIComponent(pv.dataset.preview))).json(); }
    catch (_) { data = { error: "lecture impossible" }; }
    const pre = document.createElement("pre");
    pre.className = "file-view";
    pre.textContent = (data.content ?? data.error ?? "(vide)") + (data.truncated ? "\n…(aperçu tronqué)" : "");
    item.after(pre);
    return;
  }
  const os = e.target.closest("[data-osopen]");
  if (os) fetch("/api/open?path=" + encodeURIComponent(os.dataset.osopen));
});

/* =====================================================================
   SÉLECTEUR DE FICHIERS
   ===================================================================== */
let fbState = { mode: "file", target: null, cur: null };

function openFilePicker(mode, targetId) {
  fbState = { mode, target: targetId, cur: $("#" + targetId).value || INFO.home };
  $("#fbTitle").textContent = mode === "dir" ? "Choisir un dossier" : "Choisir un fichier";
  $("#fbChooseDir").hidden = mode !== "dir";
  $("#fileModal").classList.add("show");
  fbBrowse($("#" + targetId).value || INFO.home);
}

async function fbBrowse(path) {
  let data;
  try { data = await (await fetch("/api/browse?path=" + encodeURIComponent(path || ""))).json(); }
  catch (e) { return; }
  fbState.cur = data.path;
  $("#fbPath").value = data.path;
  let html = "";
  if (data.parent) html += `<div class="fb-row dir" data-go="${esc(data.parent)}"><span class="ic">⬆️</span> .. (dossier parent)</div>`;
  for (const e of data.entries) {
    if (e.is_dir) {
      html += `<div class="fb-row dir" data-go="${esc(e.path)}"><span class="ic">📁</span> ${esc(e.name)}</div>`;
    } else if (fbState.mode === "file") {
      html += `<div class="fb-row" data-file="${esc(e.path)}"><span class="ic">📄</span> ${esc(e.name)}<span class="sz">${fmtSize(e.size)}</span></div>`;
    }
  }
  $("#fbList").innerHTML = html || `<p style="padding:16px;color:var(--ink3)">(dossier vide)</p>`;
}

$("#fbList")?.addEventListener("click", e => {
  const dir = e.target.closest("[data-go]");
  if (dir) return fbBrowse(dir.dataset.go);
  const file = e.target.closest("[data-file]");
  if (file) choosePath(file.dataset.file);
});
$("#fbGo")?.addEventListener("click", () => fbBrowse($("#fbPath").value));
$("#fbPath")?.addEventListener("keydown", e => { if (e.key === "Enter") fbBrowse($("#fbPath").value); });
$("#fbCancel")?.addEventListener("click", () => $("#fileModal").classList.remove("show"));
$("#fbChooseDir")?.addEventListener("click", () => choosePath(fbState.cur));

function choosePath(path) {
  const inp = $("#" + fbState.target);
  if (inp) { inp.value = path; inp.dispatchEvent(new Event("input", { bubbles: true })); }
  $("#fileModal").classList.remove("show");
}

/* =====================================================================
   DOCUMENTATION (rendu Markdown minimal)
   ===================================================================== */
async function loadDoc(name) {
  const el = $("#docsContent");
  el.innerHTML = "Chargement…";
  try {
    const md = await (await fetch("/api/doc?name=" + encodeURIComponent(name))).text();
    el.innerHTML = mdToHtml(md);
  } catch (e) {
    el.innerHTML = "<p>Impossible de charger la documentation.</p>";
  }
}

function mdToHtml(md) {
  const esc2 = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0, inTable = false;
  const inline = s => esc2(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  const closeTable = () => { if (inTable) { html += "</tbody></table>"; inTable = false; } };

  while (i < lines.length) {
    let l = lines[i];
    if (/^```/.test(l)) {
      let code = ""; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + "\n"; i++; }
      html += "<pre><code>" + esc2(code) + "</code></pre>"; i++; continue;
    }
    if (/^\|(.+)\|\s*$/.test(l)) {
      const cells = l.split("|").slice(1, -1).map(c => c.trim());
      if (i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        closeTable();
        html += "<table><thead><tr>" + cells.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        inTable = true; i += 2; continue;
      } else if (inTable) {
        html += "<tr>" + cells.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>"; i++; continue;
      }
    } else closeTable();

    if (/^#{1,4}\s/.test(l)) {
      const lvl = l.match(/^#+/)[0].length;
      html += `<h${lvl}>${inline(l.replace(/^#+\s/, ""))}</h${lvl}>`;
    } else if (/^>\s?/.test(l)) {
      html += `<blockquote>${inline(l.replace(/^>\s?/, ""))}</blockquote>`;
    } else if (/^[-*]\s/.test(l)) {
      html += "<ul>";
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^[-*]\s/, ""))}</li>`; i++; }
      html += "</ul>"; continue;
    } else if (/^\d+\.\s/.test(l)) {
      html += "<ol>";
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\d+\.\s/, ""))}</li>`; i++; }
      html += "</ol>"; continue;
    } else if (/^---+\s*$/.test(l)) {
      html += "<hr>";
    } else if (l.trim() === "") {
      /* saut de ligne */
    } else {
      html += `<p>${inline(l)}</p>`;
    }
    i++;
  }
  closeTable();
  return html;
}

/* ---------- utilitaires ---------- */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function fmtSize(n) { if (n < 1024) return n + " o"; if (n < 1048576) return (n / 1024).toFixed(1) + " Ko"; return (n / 1048576).toFixed(1) + " Mo"; }
