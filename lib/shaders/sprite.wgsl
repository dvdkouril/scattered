struct Uniforms {
  projection: mat4x4f,
  view: mat4x4f,
  eyePosition: vec4f,
  positionsScale: f32,
};

struct SpriteUniforms {
  gridCols: f32,
  gridRows: f32,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
}

@group(0) @binding(1) var<uniform> uni: Uniforms;
@group(0) @binding(2) var<storage, read> xPositions: array<f32>;
@group(0) @binding(3) var<storage, read> yPositions: array<f32>;
@group(0) @binding(4) var<storage, read> zPositions: array<f32>;
@group(0) @binding(5) var<storage, read> colors: array<vec4f>;
@group(0) @binding(6) var spriteSampler: sampler;
@group(0) @binding(7) var spriteTexture: texture_2d<f32>;
@group(0) @binding(8) var<uniform> spriteUni: SpriteUniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  // Quad geometry: two triangles forming a square
  let quadPos = array(
    vec2f(-0.5,  0.5),  // top-left
    vec2f(-0.5, -0.5),  // bottom-left
    vec2f( 0.5, -0.5),  // bottom-right
    vec2f(-0.5,  0.5),  // top-left
    vec2f( 0.5, -0.5),  // bottom-right
    vec2f( 0.5,  0.5),  // top-right
  );

  let quadUV = array(
    vec2f(0.0, 0.0),  // top-left
    vec2f(0.0, 1.0),  // bottom-left
    vec2f(1.0, 1.0),  // bottom-right
    vec2f(0.0, 0.0),  // top-left
    vec2f(1.0, 1.0),  // bottom-right
    vec2f(1.0, 0.0),  // top-right
  );

  const scale = 0.01;

  var vsOut: VSOutput;
  var x = xPositions[instanceIndex] * uni.positionsScale;
  var y = yPositions[instanceIndex] * uni.positionsScale;
  var z = zPositions[instanceIndex] * uni.positionsScale;
  var instPos = vec4f(x, y, z, 1.0);

  // Billboard alignment (same as sphere shader)
  var eyeToPos = normalize(instPos.xyz - uni.eyePosition.xyz);
  var worldUp = vec3f(0.0, 1.0, 0.0);
  if (abs(dot(eyeToPos, worldUp)) > 0.999) {
      worldUp = vec3f(0.0, 0.0, 1.0);
  }
  var rightVec = normalize(cross(eyeToPos, worldUp));
  var billboardUp = cross(rightVec, eyeToPos);
  var v = quadPos[vertexIndex] * scale;
  var vPos = v.x * rightVec + v.y * billboardUp;

  var vertPos = instPos + vec4f(vPos, 0.0);
  var transformedPos = uni.projection * uni.view * vertPos;

  // Compute sprite map UV from instance index
  let gridCols = u32(spriteUni.gridCols);
  let gridRows = u32(spriteUni.gridRows);
  let totalTiles = gridCols * gridRows;
  let col = instanceIndex % gridCols;
  let row = instanceIndex / gridCols;
  let tileSizeU = 1.0 / spriteUni.gridCols;
  let tileSizeV = 1.0 / spriteUni.gridRows;
  let localUV = quadUV[vertexIndex];
  let spriteUV = vec2f(
    (f32(col) + localUV.x) * tileSizeU,
    (f32(row) + localUV.y) * tileSizeV,
  );

  vsOut.position = transformedPos;
  // Flag out-of-bounds instances with a negative alpha so the fragment shader
  // can return a debug color instead of sampling the texture.
  if (instanceIndex >= totalTiles) {
    vsOut.color = vec4f(1.0, 0.0, 1.0, -1.0);
  } else {
    vsOut.color = colors[instanceIndex];
  }
  vsOut.uv = spriteUV;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Out-of-bounds instances are flagged with negative alpha in the vertex shader
  if (vsOut.color.a < 0.0) {
    return vec4f(1.0, 0.0, 1.0, 1.0); // debug magenta
  }
  let texColor = textureSample(spriteTexture, spriteSampler, vsOut.uv);
  if (texColor.a < 0.01) {
    discard;
  }
  return texColor;
}
