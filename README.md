# scattered: a composable library for 3D scatterplots

*3D scatterplots probably suck, but they're much more fun than regular scatterplots!*

> [!CAUTION]
> This project is as Work-In-Progress as it gets.
<img width="863" alt="image" src="https://github.com/user-attachments/assets/7e63c09b-90ac-4c23-abcd-69e559e5dcce" />

The basic idea is:
- arrow/dataframe as input (with 'x', 'y', 'z' columns)
- minimal dependencies & small bundle size
- webgpu rendering
- javascript library (npm), jupyter widget (pypi), web page (like [quak](https://github.com/manzt/quak))

## usage

```typescript
import * as sctrd from "scattered";

const c = sctrd.display("https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow");

let appEl = document.querySelector('#app');
if (c) {
    appEl.appendChild(c);
}
```

## about

This project is developed by David Kouřil ([web](https://www.davidkouril.com),
[bsky](https://bsky.app/profile/dvdkouril.xyz)).

### goals
1. demonstrate composability principles
2. learn a bit of webgpu
    - just following https://webgpufundamentals.org/ for now

### name
scatter plot -> scatter 3D, scatter3rd -> scatter3d/scattered

### related and inspo:
- https://matplotlib.org/stable/gallery/mplot3d/scatter3d.html
- https://plotly.com/python/3d-scatter-plots/
- https://jupyter-scatter.dev (i don't think there's 3D option)
- https://abdenlab.org/eigen-tour/ (repo: https://github.com/abdenlab/eigen-tour)
- https://projector.tensorflow.org

## development

The repository very much follows the structure of [quak](https://github.com/manzt/quak).

