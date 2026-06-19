# SAMBADA parameter reference

The `sambada` program reads a **parameter file**: a text file where **each line starts with a parameter name**, followed by its values separated by spaces. Lines starting with `#` are comments.

> 💡 With **SAMBADA Studio** you don't need to write this file by hand: fill in the form and the preview is built for you. This page explains each parameter so you understand what you are setting.

## How the program is called

```
sambada  parameter-file.txt  [data-file1  [data-file2]]
```

- **1 data file**: it contains both the environment and the markers.
- **2 data files**: the **1st** = environmental variables, the **2nd** = markers.
- File names can also be given inside the parameter file via `INPUTFILE` (SAMBADA Studio passes them as arguments instead).

## The 4 MANDATORY parameters

| Parameter | Role |
|---|---|
| `NUMVARENV` | Number of environmental variables |
| `NUMMARK` | Number of genetic markers |
| `NUMINDIV` | Number of individuals (samples) |
| `SAVETYPE` | How to save the results |

All other parameters are **optional**.

---

## Describing the data

### `NUMVARENV` (mandatory)
Number of environmental variable columns.
`NUMVARENV 5`

### `NUMMARK` (mandatory)
Number of genetic markers. When computations are split, this is the total number of markers.
`NUMMARK 1159`

### `NUMINDIV` (mandatory)
Number of individuals (data rows).
`NUMINDIV 777`

### `HEADERS`
`HEADERS Yes` or `HEADERS No`. Whether the **first row** holds column names. If there are no headers (or the parameter is omitted), environmental variables are numbered `P1, P2, …` and markers `M1, M2, …`.

### `WORDDELIM`
The **single** character separating values, in quotes. Default: a space.
`WORDDELIM ","` (CSV)  ·  `WORDDELIM " "` (space)

### `IDINDIV`
Column holding the individual identifiers: by **name** if `HEADERS Yes`, otherwise by **number** (0 to N-1).
`IDINDIV "ID"`
If there are two data files but a single `IDINDIV`, the same column is used in both.

### `COLSUPENV` / `COLSUPMARK`
**Inactive** columns (ignored in the models) among the environment / the markers. A list of names or numbers separated by spaces.
`COLSUPENV "ID" x y`

### `SUBSETVARENV` / `SUBSETMARK`
Restrict the analysis to a **subset** of environmental variables / markers.

---

## Models and saving

### `DIMMAX`
Maximum model dimension for multivariate analysis: `1` = univariate, `2` = bivariate, `3` = trivariate… Defaults to `1` if omitted.
`DIMMAX 2`

### `SAVETYPE` (mandatory)
`SAVETYPE  <timing>  <scope>  [threshold]`

- **timing**: `END` (save at the end) or `REAL` (in real time during computation).
- **scope**: `ALL` (all models) or `BEST` (significant models only).
- **threshold**: p-value cutoff, **required if `BEST`**, omitted if `ALL`.

```
SAVETYPE END ALL
SAVETYPE END BEST 0.01
```

> ⚠️ The value `SIGNIF` (instead of `ALL`/`BEST`) is **deprecated**.

### `POPULATIONVAR`
Accounts for **population structure**. Value: `FIRST` (population variables placed before the environmental ones) or `LAST` (after). Population variables must have a name starting with `pop`.
**Requires `SAVETYPE … ALL`.**

### `STOREY`
Enables computation of the **score histograms** used for false discovery rate control (FDR, Storey's method). Presence alone = enabled. An optional second argument sets a score threshold.
**Requires `SAVETYPE … ALL`.**

---

## Spatial analysis

### `SPATIAL`
`SPATIAL  <longitude>  <latitude>  <coord-type>  <neighbourhood>  <scale>` — **exactly 5 values**.

- **longitude / latitude**: coordinate columns (name if headers, otherwise number).
- **coord-type**: `CARTESIAN` (X/Y plane) or `SPHERICAL` (lon/lat degrees).
- **neighbourhood** (weighting): `DISTANCE`, `GAUSSIAN`, `BISQUARE` or `NEAREST`.
- **scale**: the bandwidth (for `DISTANCE`/`GAUSSIAN`/`BISQUARE`) **or** the number of neighbours (for `NEAREST`).

```
SPATIAL x y CARTESIAN BISQUARE 5
SPATIAL longitude latitude SPHERICAL NEAREST 50
```

> The spatial parameters below **require** `SPATIAL`.

### `AUTOCORR`
`AUTOCORR  <scope>  <variables>  [permutations]` — 2 or 3 values.

- **scope**: `GLOBAL`, `LOCAL` or `BOTH`.
- **variables**: `ENV`, `MARK` or `BOTH`.
- **permutations**: number of permutations for the significance test (internal default **99** if omitted; **9999** recommended).

`AUTOCORR BOTH BOTH 9999`

### `GWR`
Enables **geographically weighted regression** (local regression). Presence alone = enabled (`GWR`). Use `GWR No` (or `0`) to disable.

### `SHAPEFILE`
Exports the spatial results as a **shapefile** (`.shp` / `.shx` / `.dbf`), openable in a GIS (QGIS, ArcGIS). Presence alone = enabled.

---

## Output

### `OUTPUTFILE`
**Base** name of the result files. E.g. with `OUTPUTFILE results`, you get `results-Out-1.txt`, etc.

### `LOG`
Name of the execution **log** file. Automatic if omitted.

### `UNCONVERGEDMODELS`
File listing the **models that did not converge**.

### `INPUTFILE`
Name(s) of the data file(s), if you prefer to specify them here rather than as arguments. (SAMBADA Studio passes them as arguments, so it does not generate this parameter.)

---

## Reserved parameters

- `DISCRETEVAR`: intended for categorical variables; not used in this version.

---

## Full example (CSV, spatial analysis)

```
HEADERS Yes
WORDDELIM ","
NUMVARENV 5
NUMMARK 1
NUMINDIV 100
IDINDIV "ID"
COLSUPENV "ID" x y
SPATIAL x y CARTESIAN BISQUARE 5
AUTOCORR BOTH BOTH 9999
SHAPEFILE
DIMMAX 1
OUTPUTFILE results-random
SAVETYPE END ALL
```

## Constraints to remember

- `POPULATIONVAR` and `STOREY` require `SAVETYPE … ALL`.
- `AUTOCORR`, `GWR`, `SHAPEFILE` require `SPATIAL`.
- With `SAVETYPE … BEST`, the **p-value threshold is mandatory**.
- `longitude` and `latitude` cannot be chosen as the `IDINDIV` column.
