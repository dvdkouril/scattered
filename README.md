# scattered (scatter 3D)

*composable library for 3D scatterplots.*

the basic idea is:
- input: an arrow/parquet (just with 'x', 'y', 'z' columns)
- low number of dependencies: just vite, typescript
- webgpu rendering
- show scatterplot in canvas, 
- widget version can consume numpy and pandas

## related and inspo:
- https://matplotlib.org/stable/gallery/mplot3d/scatter3d.html
- https://plotly.com/python/3d-scatter-plots/
- https://jupyter-scatter.dev (i don't think there's 3D option)

## name
scatter plot -> scatter 3D, scatter3rd -> scatter3d/scattered

## goals
1. demonstrate composability principles
2. learn a bit of webgpu
