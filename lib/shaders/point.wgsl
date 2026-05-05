struct Uniforms {
  projection: mat4x4f,
  view: mat4x4f,
  eyePosition: vec4f,
  positionsScale: f32,
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

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  //~ triangle geometry hardcoded here
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.5, -0.5),  // bottom left
    vec2f( 0.5, -0.5)   // bottom right
  );

  const scale = 0.1; //~ this is to scale the triangles themselves, not the positions

  var vsOut: VSOutput;
  //~ constructing the world position from component buffers
  var x = xPositions[instanceIndex] * uni.positionsScale;
  var y = yPositions[instanceIndex] * uni.positionsScale;
  var z = zPositions[instanceIndex] * uni.positionsScale;
  var instPos = vec4f(x, y, z, 1.0);

  //~ impostors: align to always face camera
  var eyeToPos = normalize(instPos.xyz - uni.eyePosition.xyz);
  //~ use a fallback reference up when the view direction is near-parallel to world up
  var worldUp = vec3f(0.0, 1.0, 0.0);
  if (abs(dot(eyeToPos, worldUp)) > 0.999) {
      worldUp = vec3f(0.0, 0.0, 1.0);
  }
  var rightVec = normalize(cross(eyeToPos, worldUp));
  var billboardUp = cross(rightVec, eyeToPos);
  var v = pos[vertexIndex] * scale;
  var vPos = v.x * rightVec + v.y * billboardUp;

  //~ calculate position of each instance vertex
  var vertPos = instPos + vec4f(vPos, 0.0);
  //~ camera transform + projection
  var transformedPos = uni.projection * uni.view * vertPos;

  //~ outputs for fragment shader
  vsOut.position = transformedPos;
  vsOut.color = colors[instanceIndex];
  vsOut.uv = pos[vertexIndex];
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  if (distance(vsOut.uv, vec2f(0, 0)) > 0.1) {
     discard;
  }
  return vsOut.color;
}
