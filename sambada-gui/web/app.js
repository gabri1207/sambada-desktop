/* =====================================================================
   SAMBADA Studio — interface logic (vanilla JS, no dependencies)
   ===================================================================== */
"use strict";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let INFO = null;
let lastParamText = "";
let lastResults = null;   // last /api/results payload (for CSV export)

/* Session token: the backend injects window.SAMBADA_TOKEN into the page and
   requires it on every /api call. Transparently attach it so other pages open
   in the same browser cannot reach the local API. */
const TOKEN = window.SAMBADA_TOKEN || "";
const _nativeFetch = window.fetch.bind(window);
window.fetch = (url, opts = {}) => {
  if (typeof url === "string" && url.startsWith("/api")) {
    opts = { ...opts, headers: { ...(opts.headers || {}), "X-Sambada-Token": TOKEN } };
  }
  return _nativeFetch(url, opts);
};

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
  loadDoc("getting-started.md");
  // "Load example" button, shown only when a bundled example dataset is present.
  if (INFO.example) {
    const bar = $("#sambadaActions");
    if (bar) {
      bar.hidden = false;
      $("#loadExample").addEventListener("click", () => applyDemo(INFO.example));
    }
  }
  if (INFO.demo) applyDemo(INFO.demo);   // demo mode: pre-filled form
}

function applyDemo(c) {
  const sv = (id, v) => { const e = $("#" + id); if (e && v != null && v !== "") e.value = v; };
  const ck = (id, v) => { const e = $("#" + id); if (e) e.checked = !!v; };
  ck("twoFiles", c.twoFiles);
  sv("dataFile1", c.dataFile1); sv("dataFile2", c.dataFile2);
  if (c.headers != null) ck("headers", c.headers);
  if (c.worddelim) {
    const m = { " ": "space", ",": ",", ";": ";", "\t": "\t" };
    const s = $("#worddelim"); if (s) s.value = m[c.worddelim] || "custom";
    if (s && s.value === "custom") sv("worddelimCustom", c.worddelim);
  }
  sv("numvarenv", c.numvarenv); sv("nummark", c.nummark); sv("numindiv", c.numindiv);
  sv("idindiv", c.idindiv); sv("dimmax", c.dimmax);
  sv("colsupenv", c.colsupenv); sv("colsupmark", c.colsupmark);
  sv("subsetvarenv", c.subsetvarenv); sv("subsetmark", c.subsetmark);
  // Spatial analysis
  ck("spatialEnable", c.spatial);
  sv("spatialLon", c.spatialLon); sv("spatialLat", c.spatialLat);
  sv("spatialCoord", c.spatialCoord); sv("spatialNeigh", c.spatialNeigh); sv("spatialScale", c.spatialScale);
  ck("autocorrEnable", c.autocorr);
  sv("autocorrType", c.autocorrType); sv("autocorrVars", c.autocorrVars); sv("autocorrPerm", c.autocorrPerm);
  ck("gwrEnable", c.gwr);
  ck("shapefileEnable", c.shapefile);
  ck("storey", c.storey);
  sv("populationvar", c.populationvar);
  sv("savetypeTiming", c.savetypeTiming); sv("savetypeScope", c.savetypeScope); sv("savetypePval", c.savetypePval);
  sv("logName", c.logName); sv("unconverged", c.unconverged);
  sv("outputDir", c.outputDir); sv("outputBase", c.outputBase);
  updateSambadaPreview();
}

function platLabel(p) { return ({ macos: "macOS", windows: "Windows", linux: "Linux" })[p] || p; }

function renderEnvBadge() {
  const b = INFO.binaries || {};
  const ok = b["sambada"];
  const q = $("#quitBtn"); if (q) q.hidden = !!INFO.native;   // native window -> no Quit button
  $("#verLine").textContent = `v${INFO.version || "?"} · ${platLabel(INFO.platform)}`;
  const st = $("#statusLine");
  st.className = "status" + (ok ? "" : " bad");
  st.innerHTML = `<span class="dot"></span>` + (ok ? "engine ready" : "binary missing");
  $("#aboutEnv").textContent =
    `Platform : ${platLabel(INFO.platform)}\n` +
    `Display  : ${INFO.native ? "native window" : "browser"}\n` +
    `Python   : ${INFO.python || "?"}\n` +
    `Binaries : ${Object.entries(b).map(([k, v]) => `${k}=${v ? "ok" : "MISSING"}`).join("  ")}`;
}

/* ---------- Tabs ---------- */
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
   Render helpers
   ===================================================================== */
function field(opts) {
  // opts: {id,label,param,type,req,help,hint,ph,options,val,attrs,wide}
  const param = opts.param ? `<span class="fld-param">${opts.param}</span>` : "";
  const req = opts.req ? `<span class="fld-req">· required</span>` : "";
  const help = opts.help ? `<span class="help-dot" data-help="${esc(opts.help)}">?</span>` : "";
  const hint = opts.hint ? `<span class="fld-hint">${opts.hint}</span>` : "";
  let input;
  if (opts.type === "select") {
    input = `<select id="${opts.id}">` +
      opts.options.map(o => `<option value="${o.v}" ${o.v === opts.val ? "selected" : ""}>${o.t}</option>`).join("") +
      `</select>`;
  } else if (opts.type === "file" || opts.type === "dir") {
    input = `<div class="input-file"><input type="text" id="${opts.id}" placeholder="${opts.ph || ""}" value="${opts.val || ""}">` +
      `<button type="button" data-pick="${opts.type}" data-target="${opts.id}">Browse</button></div>`;
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
   SAMBADA FORM
   ===================================================================== */
function renderSambadaForm() {
  const home = INFO.home || "";
  const f = $("#sambadaForm");
  f.innerHTML =
    section("01", "Data files", "Source of genotypes and environmental variables.",
      checkField("twoFiles", "Data split across <b>two files</b> (environment, then markers)",
        "Tick if environment and markers are in two separate files. Otherwise, a single file containing everything.") +
      field({ id: "dataFile1", label: "Data file", param: "DATAFILE", type: "file", req: true, wide: true,
        ph: "/path/to/data.csv",
        help: "The file containing your data (one file = environment + markers together)." }) +
      field({ id: "dataFile2", label: "Markers file", param: "MARKERFILE", type: "file", wide: true,
        ph: "/path/to/markers.csv", help: "Used only in two-file mode." }) +
      `<div class="fld wide inline" data-field="hdrsep">
        <label class="chk-mini"><input type="checkbox" id="headers" checked> <span>Header row</span></label>
        <div class="sep-mini"><span class="fld-label">Separator</span>
          <select id="worddelim">
            <option value="space" selected>Space ( )</option>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="\t">Tab</option>
            <option value="custom">Other…</option>
          </select></div></div>` +
      field({ id: "worddelimCustom", label: "Custom separator", param: "WORDDELIM", wide: true,
        ph: "a single character", hint: "Used if “Other…” is selected." })
    ) +
    section("02", "Data description", "Dataset dimensions.",
      field({ id: "numvarenv", label: "Env. variables", param: "NUMVARENV", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Number of environmental variable columns." }) +
      field({ id: "nummark", label: "Markers", param: "NUMMARK", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Number of genetic markers (SNPs) to analyse." }) +
      field({ id: "numindiv", label: "Individuals", param: "NUMINDIV", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Number of data rows (sampled individuals)." }) +
      field({ id: "idindiv", label: "Identifier column", param: "IDINDIV", ph: "ID",
        help: "Name (if headers) or number 0…N-1 (otherwise) of the identifier column." }) +
      field({ id: "colsupenv", label: "Ignored env. columns", param: "COLSUPENV", ph: "e.g. ID x y",
        help: "Inactive columns among the environment (names or numbers separated by spaces)." }) +
      field({ id: "colsupmark", label: "Ignored marker columns", param: "COLSUPMARK", ph: "e.g. ID",
        help: "Inactive columns among the markers." }) +
      field({ id: "subsetvarenv", label: "Env. subset", param: "SUBSETVARENV", ph: "list of columns",
        help: "Restrict the analysis to these environmental variables." }) +
      field({ id: "subsetmark", label: "Markers subset", param: "SUBSETMARK", ph: "list of columns",
        help: "Restrict the analysis to these markers." })
    ) +
    section("03", "Models &amp; saving", "Computation and selection criteria.",
      field({ id: "dimmax", label: "Maximum dimension", param: "DIMMAX", type: "number", val: "1", attrs: "min=1",
        help: "1 = univariate, 2 = bivariate, 3 = trivariate… Max number of env. variables per model." }) +
      field({ id: "savetypeTiming", label: "Save timing", param: "SAVETYPE", type: "select", val: "END",
        help: "END = at the end of the computation; REAL = in real time during the computation.",
        options: [{ v: "END", t: "At the end (END)" }, { v: "REAL", t: "Real time (REAL)" }] }) +
      field({ id: "savetypeScope", label: "Models to keep", type: "select", val: "ALL",
        help: "ALL = all models; BEST = significant ones only (requires a p-value threshold).",
        options: [{ v: "ALL", t: "All (ALL)" }, { v: "BEST", t: "Significant (BEST)" }] }) +
      field({ id: "savetypePval", label: "P-value threshold", type: "number", val: "0.01", attrs: "step=0.001 min=0",
        help: "Required with “Significant (BEST)”." }) +
      field({ id: "populationvar", label: "Population structure", param: "POPULATIONVAR", type: "select", val: "",
        help: "Includes population variables (prefixed “pop”). Requires SAVETYPE ALL.",
        options: [{ v: "", t: "None" }, { v: "FIRST", t: "First (FIRST)" }, { v: "LAST", t: "Last (LAST)" }] }) +
      checkField("storey", "Histograms for FDR control (STOREY)",
        "Produces score histograms (Storey's method). Requires SAVETYPE ALL.")
    ) +
    section("04", "Spatial analysis", "Neighbourhood, autocorrelation, GWR — optional.",
      checkField("spatialEnable", "Enable spatial analysis (SPATIAL)",
        "Needed for autocorrelation, GWR and shapefile export. Requires coordinate columns.") +
      field({ id: "spatialLon", label: "Longitude / X", ph: "e.g. x",
        help: "Name (if headers) or number of the longitude column (or X in Cartesian)." }) +
      field({ id: "spatialLat", label: "Latitude / Y", ph: "e.g. y",
        help: "Name (if headers) or number of the latitude column (or Y in Cartesian)." }) +
      field({ id: "spatialCoord", label: "Coordinate type", type: "select", val: "CARTESIAN",
        help: "SPHERICAL = lon/lat degrees; CARTESIAN = X/Y plane.",
        options: [{ v: "CARTESIAN", t: "Cartesian (X/Y)" }, { v: "SPHERICAL", t: "Spherical (lon/lat)" }] }) +
      field({ id: "spatialNeigh", label: "Neighbourhood / weighting", type: "select", val: "BISQUARE",
        help: "DISTANCE / GAUSSIAN / BISQUARE (bandwidth) or NEAREST (number of neighbours).",
        options: [{ v: "DISTANCE", t: "Distance (DISTANCE)" }, { v: "GAUSSIAN", t: "Gaussian (GAUSSIAN)" }, { v: "BISQUARE", t: "Bisquare (BISQUARE)" }, { v: "NEAREST", t: "k nearest (NEAREST)" }] }) +
      field({ id: "spatialScale", label: "Scale parameter", type: "number", val: "5", attrs: "step=any min=0",
        help: "Bandwidth (DISTANCE/GAUSSIAN/BISQUARE) or number of neighbours (NEAREST)." }) +
      checkField("autocorrEnable", "Spatial autocorrelation (AUTOCORR)",
        "Moran/Geary indices, with a permutation test.") +
      field({ id: "autocorrType", label: "Scope", type: "select", val: "BOTH",
        help: "Global, local or both.",
        options: [{ v: "BOTH", t: "Global + local" }, { v: "GLOBAL", t: "Global" }, { v: "LOCAL", t: "Local" }] }) +
      field({ id: "autocorrVars", label: "Variables", type: "select", val: "BOTH",
        help: "Environment, markers or both.",
        options: [{ v: "BOTH", t: "Env. + markers" }, { v: "ENV", t: "Environment" }, { v: "MARK", t: "Markers" }] }) +
      field({ id: "autocorrPerm", label: "Permutations", type: "number", val: "9999", attrs: "min=1",
        help: "Permutations for the significance test (9999 recommended)." }) +
      checkField("gwrEnable", "Geographically weighted regression (GWR)",
        "Local regression weighted by the spatial neighbourhood.") +
      checkField("shapefileEnable", "Shapefile export (SHAPEFILE)",
        "Produces .shp/.shx/.dbf files openable in a GIS (QGIS, ArcGIS).")
    ) +
    section("05", "Output", "Location and name of the results.",
      field({ id: "outputDir", label: "Output folder", type: "dir", req: true, wide: true, val: home,
        ph: "folder where to write the results", help: "The results will be written in this folder." }) +
      field({ id: "outputBase", label: "Results base name", param: "OUTPUTFILE", wide: true, val: "results-sambada",
        help: "Prefix of the produced files (e.g. results-sambada-Out-1)." }) +
      field({ id: "logName", label: "Log file", param: "LOG", ph: "(automatic)",
        help: "Name of the execution log file." }) +
      field({ id: "unconverged", label: "Diverged models", param: "UNCONVERGEDMODELS", ph: "(optional)",
        help: "File listing the models that did not converge." })
    );

  f.addEventListener("input", updateSambadaPreview);
  f.addEventListener("change", updateSambadaPreview);
  f.addEventListener("click", e => {
    const pick = e.target.closest("[data-pick]");
    if (pick) openFilePicker(pick.dataset.pick, pick.dataset.target);
  });
  $("#copyParam").addEventListener("click", () => {
    navigator.clipboard.writeText(lastParamText);
    const btn = $("#copyParam"); btn.textContent = "copied ✓";
    setTimeout(() => btn.textContent = "copy", 1200);
  });
  $("#runSambada").addEventListener("click", runSambada);
  updateSambadaPreview();
}

/* ---------- Parameter file builder ---------- */
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
    if (!lon || !lat) errors.push("Spatial analysis: provide longitude and latitude.");
    const scale = val("spatialScale") || "5";
    lines.push(`SPATIAL ${q(lon)} ${q(lat)} ${val("spatialCoord")} ${val("spatialNeigh")} ${scale}`);
    if (checked("autocorrEnable"))
      lines.push(`AUTOCORR ${val("autocorrType")} ${val("autocorrVars")} ${val("autocorrPerm") || "9999"}`);
    if (checked("gwrEnable")) lines.push("GWR");
    if (checked("shapefileEnable")) lines.push("SHAPEFILE");
  } else if (checked("autocorrEnable") || checked("gwrEnable") || checked("shapefileEnable")) {
    warnings.push("AUTOCORR, GWR and SHAPEFILE require spatial analysis (ignored).");
  }

  const scope = val("savetypeScope"), timing = val("savetypeTiming");
  if (scope === "ALL") {
    lines.push(`SAVETYPE ${timing} ALL`);
  } else {
    const p = val("savetypePval");
    if (!p) errors.push("With BEST, a p-value threshold is required.");
    lines.push(`SAVETYPE ${timing} BEST ${p || "0.01"}`);
  }

  if (val("populationvar")) {
    lines.push("POPULATIONVAR " + val("populationvar"));
    if (scope !== "ALL") errors.push("POPULATIONVAR requires SAVETYPE = All (ALL).");
  }
  if (checked("storey")) {
    lines.push("STOREY");
    if (scope !== "ALL") errors.push("STOREY requires SAVETYPE = All (ALL).");
  }

  const base = val("outputBase") || "results-sambada";
  lines.push("OUTPUTFILE " + q(base));
  if (val("logName")) lines.push("LOG " + q(val("logName")));
  if (val("unconverged")) lines.push("UNCONVERGEDMODELS " + q(val("unconverged")));

  const df1 = val("dataFile1"), df2 = val("dataFile2");
  if (!df1) missing.push("DATAFILE");
  if (twoFiles && !df2) missing.push("MARKERFILE");
  const args = twoFiles ? [df1, df2] : [df1];

  if (!val("outputDir")) errors.push("Provide the output folder.");

  return {
    text: lines.join("\n") + "\n",
    args: args.filter(Boolean),
    cwd: val("outputDir"),
    paramFileName: base + "-parameters.txt",
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
    html += `<div class="miss-h">${r.missing.length} missing parameter${r.missing.length > 1 ? "s" : ""}</div>` +
      r.missing.map(m => `<div class="miss-i">— ${m}</div>`).join("");
  }
  html += r.errors.map(e => `<div class="miss-e">⚠ ${e}</div>`).join("");
  html += r.warnings.map(w => `<div class="miss-e">• ${w}</div>`).join("");
  if (!r.missing.length && !r.errors.length) html += `<div class="ready">✓ Ready to run</div>`;
  $("#validationMsg").innerHTML = html;
  $("#runSambada").disabled = r.missing.length > 0 || r.errors.length > 0;
}

async function runSambada() {
  const r = buildSambadaParam();
  if (r.missing.length || r.errors.length) return;
  await runTool({ tool: "sambada", title: "SAMBADA analysis", cwd: r.cwd,
    paramText: r.text, paramFileName: r.paramFileName, args: r.args });
}

/* =====================================================================
   RECODE-PLINK FORM
   ===================================================================== */
function renderRecodeForm() {
  const f = $("#recodeForm");
  f.innerHTML =
    section("01", "Recoding parameters", "Convert Plink data (.ped / .map) to SAMBADA or LFMM.",
      field({ id: "rcTool", label: "Output format", type: "select", val: "recode-plink",
        help: "recode-plink → SAMBADA format; recode-plink-lfmm → LFMM format.",
        options: [{ v: "recode-plink", t: "SAMBADA format" }, { v: "recode-plink-lfmm", t: "LFMM format" }] }) +
      field({ id: "rcSamples", label: "Samples", param: "nbSamples", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Number of individuals in the .ped file." }) +
      field({ id: "rcSnp", label: "SNPs (markers)", param: "nbSNP", type: "number", req: true, attrs: "min=1", ph: "—",
        help: "Number of markers in the .map file." }) +
      field({ id: "rcPed", label: "Plink file", param: ".ped / .map", type: "file", req: true, wide: true,
        ph: "/path/to/data.ped", help: "The .ped or .map (same base name, same folder)." }) +
      field({ id: "rcOut", label: "Output file", req: true, wide: true, val: "recoded-data.txt",
        help: "Result file in the chosen format." }) +
      field({ id: "rcSubset", label: "Subsample", type: "file", wide: true, ph: "(optional)",
        help: "List of individuals to keep. Empty = all." }) +
      field({ id: "rcOutDir", label: "Output folder", type: "dir", req: true, wide: true, val: INFO.home || "",
        help: "Folder where to write the recoded file." })
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
  if (!s || +s <= 0) errors.push("Number of samples required (> 0).");
  if (!n || +n <= 0) errors.push("Number of SNPs required (> 0).");
  if (!ped) errors.push("Plink file (.ped/.map) required.");
  if (!out) errors.push("Output file name required.");
  if (!val("rcOutDir")) errors.push("Output folder required.");
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
    : `<div class="ready">✓ Ready to run</div>`;
  $("#runRecode").disabled = r.errors.length > 0;
}

async function runRecode() {
  const r = buildRecode();
  if (r.errors.length) return;
  await runTool({ tool: r.tool, title: "Plink recoding", cwd: r.cwd, args: r.args });
}

/* =====================================================================
   EXECUTION (streaming)
   ===================================================================== */
async function runTool(payload) {
  const modal = $("#runModal"), cons = $("#console"), results = $("#results"), status = $("#runStatus");
  $("#runTitle").textContent = payload.title;
  cons.textContent = "";
  results.innerHTML = "";
  status.textContent = "running…";
  status.className = "run-status";
  $("#openOutputDir").hidden = true;
  $("#viewResults").hidden = true;
  modal.classList.add("show");

  let buffer = "";
  try {
    const res = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "error " + res.status }));
      cons.textContent = "[ERROR] " + (j.error || res.status);
      status.textContent = "failed"; status.className = "run-status fail";
      return;
    }
    if (!res.body || !res.body.getReader) {
      // No streaming support: fall back to reading the whole response at once.
      buffer = await res.text();
      cons.textContent = buffer.split("__SAMBADA_DONE__")[0];
    } else {
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
    }
  } catch (e) {
    cons.textContent += "\n[network error] " + e;
    status.textContent = "failed"; status.className = "run-status fail";
    return;
  }

  const idx = buffer.indexOf("__SAMBADA_DONE__");
  if (idx >= 0) {
    cons.textContent = buffer.slice(0, idx).trimEnd();
    let summary = {};
    try { summary = JSON.parse(buffer.slice(idx + "__SAMBADA_DONE__".length).trim()); } catch (_) {}
    const ok = summary.exitCode === 0;
    status.textContent = ok ? "done ✓" : `exit code ${summary.exitCode}`;
    status.className = "run-status " + (ok ? "ok" : "fail");
    if (summary.cwd) {
      $("#openOutputDir").hidden = false;
      $("#openOutputDir").onclick = () => fetch("/api/open?path=" + encodeURIComponent(summary.cwd));
    }
    const files = summary.produced || [];
    if (files.length) {
      results.innerHTML = `<p style="font-size:13px;color:var(--ink2);margin:12px 4px 4px">${files.length} file(s) produced:</p>` +
        files.map(fl => `<div class="result-item">
          <span class="fname">${esc(fl.name)}</span>
          <span class="fsize">${fmtSize(fl.size)}</span>
          <button class="ghost small" data-preview="${esc(fl.path)}">👁 Preview</button>
          <button class="ghost small" data-osopen="${esc(fl.path)}">📂 Open</button>
        </div>`).join("");
    } else if (ok) {
      results.innerHTML = `<p style="font-size:13px;color:var(--ink2);margin:12px 4px">Done (no new file detected).</p>`;
    }
    // "View results": pick the highest-dimension -Out-N file (N >= 1)
    const out = files.map(f => f.path)
      .map(p => ({ p, n: +((p.match(/-Out-(\d+)(?:\.txt)?$/) || [])[1]) }))
      .filter(o => o.n >= 1).sort((a, b) => b.n - a.n)[0];
    if (out) {
      const vr = $("#viewResults");
      vr.hidden = false;
      vr.onclick = () => {
        $("#resPath").value = out.p;
        $("#runModal").classList.remove("show");
        $$(".tab").forEach(x => x.classList.remove("active"));
        $$(".panel").forEach(x => x.classList.remove("active"));
        $('.tab[data-tab="results"]').classList.add("active");
        $("#tab-results").classList.add("active");
        loadResults();
      };
    }
  } else {
    status.textContent = "done"; status.className = "run-status ok";
  }
}

$("#closeRun")?.addEventListener("click", () => $("#runModal").classList.remove("show"));

$("#quitBtn")?.addEventListener("click", async () => {
  if (!confirm("Quit SAMBADA Studio? You can then close this tab.")) return;
  try { await fetch("/api/quit"); } catch (_) {}
  document.body.innerHTML =
    '<div style="padding:70px 20px;text-align:center;font-family:system-ui;color:#5b6776">' +
    '<div style="font-size:42px">🧬</div>' +
    '<h2 style="color:#1d2a38">SAMBADA Studio has stopped</h2>' +
    '<p>You can safely close this tab.</p></div>';
});

$("#results")?.addEventListener("click", async e => {
  const pv = e.target.closest("[data-preview]");
  if (pv) {
    const item = pv.closest(".result-item");
    const next = item.nextElementSibling;
    if (next && next.classList.contains("file-view")) { next.remove(); return; }
    let data = {};
    try { data = await (await fetch("/api/file?path=" + encodeURIComponent(pv.dataset.preview))).json(); }
    catch (_) { data = { error: "cannot read" }; }
    const pre = document.createElement("pre");
    pre.className = "file-view";
    pre.textContent = (data.content ?? data.error ?? "(empty)") + (data.truncated ? "\n…(preview truncated)" : "");
    item.after(pre);
    return;
  }
  const os = e.target.closest("[data-osopen]");
  if (os) fetch("/api/open?path=" + encodeURIComponent(os.dataset.osopen));
});

/* =====================================================================
   FILE PICKER
   ===================================================================== */
let fbState = { mode: "file", target: null, cur: null };

function openFilePicker(mode, targetId) {
  fbState = { mode, target: targetId, cur: $("#" + targetId).value || INFO.home };
  $("#fbTitle").textContent = mode === "dir" ? "Choose a folder" : "Choose a file";
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
  if (data.parent) html += `<div class="fb-row dir" data-go="${esc(data.parent)}"><span class="ic">⬆️</span> .. (parent folder)</div>`;
  for (const e of data.entries) {
    if (e.is_dir) {
      html += `<div class="fb-row dir" data-go="${esc(e.path)}"><span class="ic">📁</span> ${esc(e.name)}</div>`;
    } else if (fbState.mode === "file") {
      html += `<div class="fb-row" data-file="${esc(e.path)}"><span class="ic">📄</span> ${esc(e.name)}<span class="sz">${fmtSize(e.size)}</span></div>`;
    }
  }
  $("#fbList").innerHTML = html || `<p style="padding:16px;color:var(--ink3)">(empty folder)</p>`;
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
   RESULTS (visualisation of -Out-N files)
   ===================================================================== */
async function loadResults() {
  const path = $("#resPath").value.trim();
  const msg = $("#resMsg");
  if (!path) { msg.textContent = "Choose a results file first."; return; }
  msg.textContent = "Loading… (large files take a few seconds)";
  $("#resSummary").innerHTML = ""; $("#resManhattan").innerHTML = ""; $("#resChart").innerHTML = ""; $("#resTableWrap").innerHTML = "";
  const sort = $("#resSort").value, filter = $("#resFilter").value,
        limit = $("#resLimit").value, query = $("#resSearch").value.trim();
  let data;
  try {
    const url = `/api/results?path=${encodeURIComponent(path)}&sort=${sort}&filter=${filter}&limit=${limit}&q=${encodeURIComponent(query)}`;
    data = await (await fetch(url)).json();
  } catch (e) { msg.textContent = "Error: " + e; return; }
  if (data.error) { msg.textContent = "⚠ " + data.error; $("#resControls").hidden = true; lastResults = null; return; }
  msg.textContent = "";
  lastResults = data;
  $("#resControls").hidden = false;
  renderResultsSummary(data);
  renderResultsManhattan(data);
  renderResultsChart(data);
  renderResultsTable(data);
}

/* Parse a chromosome and a base-pair position out of a marker name.
   Handles names such as "X23.44071708_2", "23:44071708", "chr7_12345",
   "rs12345" (position only). Returns null when nothing usable is found. */
function parseLocus(marker) {
  const m = String(marker);
  let mm = m.match(/(?:chr|CHR|X)?\s*(\d+)[.:_-](\d{3,})/);
  if (mm) return { chr: +mm[1], pos: +mm[2] };
  mm = m.match(/(?:chr|CHR)\s*(\d+|[XYM])\b/i);
  if (mm) return { chr: /^\d+$/.test(mm[1]) ? +mm[1] : mm[1], pos: null };
  return null;
}

function renderResultsManhattan(d) {
  const el = $("#resManhattan");
  el.innerHTML = "";
  const pts = [];
  for (const r of d.rows) {
    const loc = parseLocus(r.marker);
    if (!loc || loc.pos == null || r.pvalue == null) continue;
    pts.push({ chr: loc.chr, pos: loc.pos, y: -Math.log10(Math.max(r.pvalue, 1e-300)),
               marker: r.marker, env: r.env, p: r.pvalue });
  }
  // Only draw if we could locate a reasonable share of the loaded markers.
  if (pts.length < 8 || pts.length < d.rows.length * 0.5) return;

  // Group by chromosome, order, and lay out cumulatively along the X axis.
  const chrOrder = [...new Set(pts.map(p => String(p.chr)))].sort((a, b) => {
    const na = +a, nb = +b, aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1; if (bNum) return 1; return a < b ? -1 : 1;
  });
  const W = 900, H = 300, padL = 46, padR = 12, padT = 14, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxY = Math.max(3, ...pts.map(p => p.y)) * 1.08;
  const yScale = v => padT + plotH - (v / maxY) * plotH;

  // Give each chromosome a horizontal band proportional to its span.
  const bands = {}; let cum = 0; const gap = plotW * 0.012;
  for (const c of chrOrder) {
    const cp = pts.filter(p => String(p.chr) === c).map(p => p.pos);
    const lo = Math.min(...cp), hi = Math.max(...cp);
    bands[c] = { lo, hi, span: Math.max(1, hi - lo) };
  }
  const totalSpan = chrOrder.reduce((s, c) => s + bands[c].span, 0);
  const usableW = plotW - gap * (chrOrder.length - 1);
  for (const c of chrOrder) {
    bands[c].x0 = padL + cum;
    bands[c].w = usableW * (bands[c].span / totalSpan);
    cum += bands[c].w + gap;
  }
  const xOf = p => bands[String(p.chr)].x0 +
    (bands[String(p.chr)].w * (p.pos - bands[String(p.chr)].lo) / bands[String(p.chr)].span);

  const colours = ["#1d2a38", "#5b6776"];
  const sig = 1e-3, sug = 1e-2;
  const yGrid = [];
  for (let g = 2; g <= maxY; g += 2) yGrid.push(g);

  let svg = `<h3>Manhattan plot — genomic overview (loaded models)</h3>`;
  svg += `<svg class="manhattan" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Manhattan plot">`;
  // Y axis + grid
  svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#d7dde3"/>`;
  for (const g of yGrid) {
    const y = yScale(g);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#eef1f4"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#97a1ad">${g}</text>`;
  }
  svg += `<text x="12" y="${padT + plotH / 2}" font-size="9.5" fill="#5b6776" transform="rotate(-90 12 ${padT + plotH / 2})" text-anchor="middle">−log₁₀(p)</text>`;
  // Significance thresholds
  for (const [thr, col, lbl] of [[sig, "#c0392b", "p=1e-3"], [sug, "#b06a0d", "p=1e-2"]]) {
    const yv = -Math.log10(thr);
    if (yv < maxY) {
      const y = yScale(yv);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${col}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
      svg += `<text x="${W - padR}" y="${y - 3}" text-anchor="end" font-size="8.5" fill="${col}">${lbl}</text>`;
    }
  }
  // Points
  for (const p of pts) {
    const ci = chrOrder.indexOf(String(p.chr));
    const col = p.p < sig ? "#c0392b" : colours[ci % 2];
    svg += `<circle cx="${xOf(p).toFixed(1)}" cy="${yScale(p.y).toFixed(1)}" r="${p.p < sig ? 3 : 2.2}" fill="${col}"><title>${esc(p.marker)} × ${esc(p.env)}\np=${p.p.toExponential(2)}</title></circle>`;
  }
  // Chromosome labels
  for (const c of chrOrder) {
    const b = bands[c];
    svg += `<text x="${(b.x0 + b.w / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9" fill="#5b6776">${esc(c)}</text>`;
  }
  svg += `</svg>`;
  svg += `<div class="mh-note">Chromosome × position parsed from marker names; only loaded models are shown.</div>`;
  el.innerHTML = svg;
}

function exportResultsCSV() {
  if (!lastResults || !lastResults.rows || !lastResults.rows.length) return;
  const head = ["Marker", "Variable", "Gscore", "pvalue", "Wald", "Nagelkerke", "AIC", "Beta", "NumError"];
  const cell = v => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = lastResults.rows.map(r =>
    [r.marker, r.env, r.gscore, r.pvalue, r.wald, r.nagelkerke, r.aic, r.beta, r.numerror].map(cell).join(","));
  const csv = head.join(",") + "\n" + rows.join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sambada-results.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function renderResultsSummary(d) {
  const s = d.summary;
  const card = (v, k, cls = "") => `<div class="res-card"><div class="v ${cls}">${v}</div><div class="k">${k}</div></div>`;
  $("#resSummary").innerHTML = `<div class="res-cards">` +
    card(fmtInt(s.total), "models") +
    card(fmtInt(s.valid), "valid", "green") +
    card(fmtInt(s.n01), "p &lt; 0.01", "amber") +
    card(fmtInt(s.n001), "p &lt; 0.001", "amber") +
    card(s.minp != null ? fmtP(s.minp) : "–", "best p-value") +
    `</div>`;
}

function renderResultsChart(d) {
  const rows = [...d.rows].sort((a, b) => b.gscore - a.gscore).slice(0, 15);
  if (!rows.length) { $("#resChart").innerHTML = ""; return; }
  const max = rows[0].gscore || 1;
  $("#resChart").innerHTML = `<h3>Top 15 associations by G-score (independent of the table sort)</h3>` +
    rows.map(r => {
      const w = Math.max(2, 100 * r.gscore / max);
      const sig = r.pvalue < 0.001 ? "sig" : "";
      return `<div class="bar-row"><span class="bl" title="${esc(r.marker + " × " + r.env)}">${esc(r.marker)} × ${esc(r.env)}</span>` +
        `<span class="bt"><span class="bf ${sig}" style="width:${w}%"></span></span>` +
        `<span class="bv">G=${r.gscore.toFixed(1)}</span></div>`;
    }).join("");
}

function renderResultsTable(d) {
  const head = ["Marker", "Variable", "G-score", "p-value", "Wald", "Nagelkerke R²", "AIC", "β", "Err"];
  const body = d.rows.map(r => `<tr class="${r.pvalue < 0.001 ? "sig" : ""}">` +
    `<td class="mono">${esc(r.marker)}</td><td>${esc(r.env)}</td>` +
    `<td class="res-num">${r.gscore.toFixed(2)}</td>` +
    `<td class="res-num mono">${fmtP(r.pvalue)}</td>` +
    `<td class="res-num">${fnum(r.wald, 2)}</td>` +
    `<td class="res-num">${fnum(r.nagelkerke, 3)}</td>` +
    `<td class="res-num">${fnum(r.aic, 1)}</td>` +
    `<td class="res-num">${fnum(r.beta, 3)}</td>` +
    `<td class="res-num">${r.numerror}</td></tr>`).join("");
  $("#resTableWrap").innerHTML =
    `<div class="res-tbl-h">${fmtInt(d.returned)} model(s) shown · dimension ${d.dimension} · sorted by ${d.sort}</div>` +
    `<div class="res-tbl-scroll"><table class="res-table"><thead><tr>` +
    head.map(h => `<th>${h}</th>`).join("") + `</tr></thead><tbody>` +
    (body || `<tr><td colspan="9" style="padding:16px;color:var(--ink3)">No model matches this filter.</td></tr>`) +
    `</tbody></table></div>`;
}

function fmtInt(n) { return (n == null ? 0 : n).toLocaleString("en-US"); }
function fnum(x, d) { return (x == null || Number.isNaN(x)) ? "–" : (+x).toFixed(d); }
function fmtP(p) { if (p == null) return "–"; if (p <= 0) return "<1e-300"; if (p < 1e-4) return p.toExponential(1); return p.toFixed(4); }

$("#resLoad")?.addEventListener("click", loadResults);
$("#resExport")?.addEventListener("click", exportResultsCSV);
$("#resBrowse")?.addEventListener("click", () => openFilePicker("file", "resPath"));
["resSort", "resFilter", "resLimit"].forEach(id =>
  $("#" + id)?.addEventListener("change", () => { if ($("#resPath").value.trim()) loadResults(); }));
$("#resSearch")?.addEventListener("keydown", e => { if (e.key === "Enter") loadResults(); });
$("#resPath")?.addEventListener("keydown", e => { if (e.key === "Enter") loadResults(); });

/* =====================================================================
   DOCUMENTATION (minimal Markdown rendering)
   ===================================================================== */
async function loadDoc(name) {
  const el = $("#docsContent");
  el.innerHTML = "Loading…";
  try {
    const md = await (await fetch("/api/doc?name=" + encodeURIComponent(name))).text();
    el.innerHTML = mdToHtml(md);
  } catch (e) {
    el.innerHTML = "<p>Could not load the documentation.</p>";
  }
}

function mdToHtml(md) {
  const esc2 = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0, inTable = false;
  const inline = s => esc2(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
      /* blank line */
    } else {
      html += `<p>${inline(l)}</p>`;
    }
    i++;
  }
  closeTable();
  return html;
}

/* ---------- utilities ---------- */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fmtSize(n) { if (n < 1024) return n + " B"; if (n < 1048576) return (n / 1024).toFixed(1) + " KB"; return (n / 1048576).toFixed(1) + " MB"; }
