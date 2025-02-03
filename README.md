# scattered (scatter 3D)

*composable library for 3D scatterplots.*

the basic idea is:
- input: an arrow/parquet (just with 'x', 'y', 'z' columns)
- zero dependencies (just vite, typescript for dev)
- webgpu rendering
- minimal API for displaying 3D scatterplots in canvas
- also a widget version, can consume numpy and pandas

## related and inspo:
- https://matplotlib.org/stable/gallery/mplot3d/scatter3d.html
- https://plotly.com/python/3d-scatter-plots/
- https://jupyter-scatter.dev (i don't think there's 3D option)
- https://abdenlab.org/eigen-tour/

## name
scatter plot -> scatter 3D, scatter3rd -> scatter3d/scattered

## goals
1. demonstrate composability principles
2. learn a bit of webgpu
