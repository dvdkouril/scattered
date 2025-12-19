import chroma from "chroma-js";
import { vec3, mat4 } from "gl-matrix";

export function prepareCameraMatrix(width: number, height: number): mat4 {

  const projMat = mat4.create();
  const fovy = Math.PI / 4.0;
  const near = 0.1;
  const far = 10.0;
  const aspect = width / height;
  // https://github.com/toji/gl-matrix/pull/413
  mat4.perspectiveZO(projMat, fovy, aspect, near, far);

  return projMat;
}

export function prepareViewMatrix(eye: vec3): mat4 {
  const viewMat = mat4.create();

  const center = vec3.fromValues(0, 0, 0);
  const up = vec3.fromValues(0, 1, 0);
  mat4.lookAt(viewMat, eye, center, up);

  return viewMat;
}

export function generateRandomPoints(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    res.push(rand(), rand(), rand(), 1);
  }
  return res;
}

function rand(min?: number, max?: number): number {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
}

export function hexColorToFloatArray(color: string): number[] {
  // remove leading #
  color = color.replace(/^#/, '');

  // handle short form "#RGB"
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }

  const int = parseInt(color, 16);

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return [r, g, b].map(v => v / 255);
}

export function pickRandomBackgroundColor(mode?: string): string {
  const lightColors = [
    "#f0ffff", // azure
    "#f0f8ff", // aliceblue
    "#fff8dc", // cornsilk
    "#f8f8ff", // ghostwhite
    "#f0fff0", // honeydew
    "#fff0f5", // lavenderblush
  ];
  const darkColors = [
    "#6a5acd", // slateblue
    "#000080", // navy
    "#2f4f4f", // darkslategray
    "#006400", // darkgreen
  ];

  if (mode === "light") {
    return lightColors[Math.floor(Math.random() * lightColors.length)];
  } else if (mode === "dark") {
    return darkColors[Math.floor(Math.random() * darkColors.length)];
  } else {
    const allColors = lightColors.concat(darkColors);
    return allColors[Math.floor(Math.random() * allColors.length)];
  }
}

/*
 * Asserting function for checking if a string is a valid chroma.js Brewer palette name
 */
export function isBrewerPaletteName(
  colorString: string,
): colorString is chroma.BrewerPaletteName {
  const brewerPalettes = Object.keys(chroma.brewer).map((name) =>
    name.toLowerCase(),
  );
  return brewerPalettes.includes(colorString.toLowerCase());
}
