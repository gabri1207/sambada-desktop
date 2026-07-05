# Getting started

Welcome! This guide walks you through SAMBADA step by step, even if you have never used it before.

## 1. What is SAMBADA?

SAMBADA looks for **associations between genetic markers and environmental variables** (temperature, elevation, precipitation…). It is a **landscape genomics** method: it helps detect genes potentially under **environmental selection** and analyses the **spatial structure** of the data.

For each pair (marker, environmental variable), SAMBADA fits a **logistic regression** and computes statistical scores (G-score, Wald, p-values, pseudo-R²…).

## 2. Launching the application

Download the executable for your system and open it — **no installation required**:

- **macOS** — unzip `SAMBADA-Studio-macOS.zip`, then **right-click `SAMBADA Studio.app` → Open** (first time only, to bypass Gatekeeper for an unsigned app).
- **Windows** — unzip `SAMBADA-Studio-Windows.zip`, run `SambadaStudio.exe`. If "Windows protected your PC" appears: **More info → Run anyway**.
- **Linux** — extract `SAMBADA-Studio-Linux.tar.gz`, then `chmod +x SambadaStudio` and `./SambadaStudio`.

SAMBADA Studio opens in its **own application window**. (On Linux it may open in your default browser if the system web component is unavailable.) To quit, simply close the window.

## 3. Preparing your data

SAMBADA expects a table (CSV or text) where **each row is an individual** and **each column is a variable**:

- **environmental** columns (numeric values);
- **genetic marker** columns (genotypes coded `0` / `1` / `2`, or presence/absence);
- optionally an **identifier** column and **coordinate** columns (x/y or longitude/latitude).

You can keep everything in **one file**, or split environment and markers into **two files**.

> **Starting from Plink data (`.ped` / `.map`)?** First use the **"Prepare data (Plink)"** tab to convert it to SAMBADA's format.

## 4. Configuring the analysis ("SAMBADA Analysis" tab)

Fill in at least:

1. **Data file** — click *Browse…* and select your file.
2. **Headers** — keep it checked if the first row contains column names.
3. **Separator** — Space, Comma, etc., depending on your file.
4. **Number of environmental variables / markers / individuals** — the three required numbers.
5. **Output folder** — where to write the results.

Click the **?** icon next to each field for an explanation. On the right, the **parameter file preview** updates live, and a message tells you when everything is ready.

### Advanced options (optional)

- **Maximum dimension**: set to 2 or 3 for multivariate models (slower).
- **Spatial analysis**: tick *Enable spatial analysis*, give the coordinate columns, then turn on **autocorrelation**, **GWR** or **shapefile export** as needed.

## 5. Running and reading the results

Click **▶ Run analysis**. A window shows the **live progress**. When it finishes:

- the **exit status** tells you whether all went well (`done ✓`);
- the list of **produced files** appears, each with a **Preview** and **Open** button;
- the **📂 Open results folder** button opens the folder in your file explorer.

The main results are in `…-Out-1.txt` (univariate models), `…-Out-2.txt` (bivariate), etc. See the **File formats** tab for the column details.

## 6. Try it right now (example dataset)

A ready-to-use example dataset ships with the app (`examples/random-data/random-sample.txt`). For a quick test:

- Data file: the bundled `random-sample.txt`
- Headers: checked · Separator: **Comma**
- Environmental variables: **5** · Markers: **1** · Individuals: **100**
- Identifier column: `ID`
- Output folder: any folder you like

Run it: you should get the result files within a few seconds.

## 7. Troubleshooting

- **"binary missing"** in the top banner: the SAMBADA program has not been compiled for your system yet. See the `README` (Compilation section).
- **An error in the console**: the message comes from SAMBADA itself (often a number of variables/individuals that does not match the file, or a wrong separator). Check the numbers and the separator.
- **To quit**: close the application window.
