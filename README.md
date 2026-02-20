# scattered: a composable library for 3D scatterplots

*3D scatterplots probably suck, but they're much more fun than regular scatterplots!*

> [!CAUTION]
> This project is as Work-In-Progress as it gets.
<img width="2000" height="288" alt="teaser" src="./teaser.png" />

The basic idea is:
- arrow/dataframe as input (with 'x', 'y', 'z' columns)
- minimal dependencies & small bundle size
- webgpu rendering
- javascript library (npm), jupyter widget (pypi), web page (like [quak](https://github.com/manzt/quak))

## use in python

Install:
```sh
uv add scattered
```
or: `pip install scattered`

Then use:
```python
import scattered
import numpy as np
import pandas as pd

df = pd.DataFrame({
    "x": np.random.rand(5),
    "y": np.random.rand(5),
    "z": np.random.rand(5),
})

scattered.Widget(df)
```

## use in javascript
Install:
```sh
pnpm add scattered
```
or: `npm install scattered` or `yarn add scattered`

Then use:
```typescript
import * as sctrd from "scattered";

const url = "https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow";
const c = sctrd.display(url,
    { // encoding
        x: "x",
        y: "y",
        z: "z",
        color: "category",
    });

let appEl = document.querySelector('#app');
if (c) {
    appEl.appendChild(c);
}
```

## about

This project is developed by David Kouřil ([web](https://www.davidkouril.com),
[bsky](https://bsky.app/profile/dvdkouril.xyz)).

### why
I think we're missing a modern, simple to use library for interactive 3D
scatterplots. Visualization libraries are typically centered around 2D plots to make exporting as vector graphics easier.

However, learning is the primary motivation:
1. learn a bit of webgpu
2. explore the composability principles for visualization tools
3. learn about bundling, and how to maintain multi-package project

`scattered` is very much inspired by [quak](https://github.com/manzt/quak) and also follow
the structure of that repo.

### related and inspo
From researching 3D scatterplots in the wild.

- https://matplotlib.org/stable/gallery/mplot3d/scatter3d.html
- https://plotly.com/python/3d-scatter-plots/
- https://jupyter-scatter.dev (i don't think there's 3D option)
- https://abdenlab.org/eigen-tour/ (repo: https://github.com/abdenlab/eigen-tour)
- https://projector.tensorflow.org
