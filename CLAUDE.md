# scattered: a visualization tool for 3D scatterplots
This repository contains code for a 3D scatterplot visualization toolkit.

## Project structure
The repository contains two principle components:
1. TypeScript code that is bundled into a Javascript package published to NPM.
   The responsibility of this part is to render the 3D scatterplot based on
dataset that is provided, and an object that specifies "encoding", that is,
which columns from the datasets map to which visual attributes (such as, xyz
position, or color).
2. Python code that contains a Jupyter widget, using the anywidget package.
   This Python part uses the Javascript package described above.

## Technical details
For rendering of the 3D scatterplots, we are using the modern WebGPU API, not
WebGL.
