# File formats

## Input data file

A text table: one row per individual, one column per variable, values separated by the character defined in `WORDDELIM` (space by default).

- **First row (if `HEADERS Yes`)**: the column names.
- **Environmental columns**: numeric values (temperature, elevation…).
- **Marker columns**: genotypes (typically `0`, `1`, `2`, or presence/absence `0`/`1`).
- **Optional columns**: identifier (`IDINDIV`), coordinates (`SPATIAL`).

Example (CSV, with headers):

```
"ID","x","y","Env1","Env2","Marq"
"1",-1.873,-5.537,134.93,-1.81,1
"2",-8.408,0.645,82.13,-9.12,0
```

When everything is in **one file**, the expected order is: environmental variables first, then markers. With **two files**, the first holds the environment, the second the markers.

## Output files produced by `sambada`

With a base name `OUTPUTFILE results`, you get:

| File | Contents |
|---|---|
| `results-Out-0.txt` | "Constant" models (no environmental variable) — reference |
| `results-Out-1.txt` | **Univariate** models (1 environmental variable) |
| `results-Out-2.txt`, … | **Bivariate** models, etc. (depending on `DIMMAX`) |
| `results-log.txt` | Execution log |
| `results-AS-Env.txt` | Spatial autocorrelation of environmental variables |
| `results-AS-Mark.txt` | Spatial autocorrelation of markers |
| `results-AS-*-pVal.txt` | Autocorrelation p-values |
| `results-AS-*-Sim.txt` | Simulated distributions (permutations) |
| `results.shp` / `.shx` / `.dbf` | Shapefile (if `SHAPEFILE`) — for a GIS |

> Note: when `OUTPUTFILE` is set, SAMBADA names the result files without a `.txt` extension (e.g. `results-Out-1`). They are plain text — use the **Preview** button in the app, or open them with any text editor.

### Columns of the `-Out-N` files

```
Marker, Env_1, …, Loglikelihood, Gscore, WaldScore, NumError,
Efron, McFadden, McFaddenAdj, CoxSnell, Nagelkerke, AIC, BIC, Beta_0, Beta_1, …
```

- **Marker**: marker name; **Env_1…**: the model's environmental variable(s).
- **Loglikelihood**: the model's log-likelihood.
- **Gscore** / **WaldScore**: significance test statistics.
- **NumError**: model status code (see below; `0` = OK).
- **Efron, McFadden, McFaddenAdj, CoxSnell, Nagelkerke**: pseudo-R² (goodness of fit).
- **AIC, BIC**: model selection criteria.
- **Beta_0, Beta_1…**: estimated coefficients (intercept, then slopes).

### `NumError` codes

| Code | Meaning |
|---|---|
| `0` | Model computed correctly |
| `1` | Exponential divergence |
| `2` | Singular information matrix |
| `3` | Divergence of the coefficients (β) |
| `4` | Maximum number of iterations reached |
| `5` | Monomorphic marker (no variation) |
| `6` | Non-significant parent models |

A non-zero code flags a model whose estimation did not complete normally; those rows should usually be excluded from interpretation.

## Plink format (input to `recode-plink`)

- `file.ped`: genotypes (one individual per row).
- `file.map`: marker description.

Both files must share the **same base name** and live in the **same folder**. `recode-plink` converts them to SAMBADA's tabular format; `recode-plink-lfmm` converts them to the LFMM format.

> ℹ️ Provide the **exact** number of samples and SNPs: these values are used to size the reading. A wrong number or a malformed file can make the recoding fail.
