struct Uniforms {
    projection: mat4x4f,
    view: mat4x4f,
    eyePosition: vec4f,
};

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) uv: vec2f,
}

//~ TODO: unused binding position 0
@group(0) @binding(1) var<uniform> uni: Uniforms;
// feeding the positions from array directly
@group(0) @binding(2) var<storage, read> xPositions: array<f32>;
@group(0) @binding(3) var<storage, read> yPositions: array<f32>;
@group(0) @binding(4) var<storage, read> zPositions: array<f32>;
@group(0) @binding(5) var<storage, read> colors: array<vec4f>;

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
        //~ triangle geometry hardcoded here
    let pos = array(
        vec2f(0.0, 0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f(0.5, -0.5)   // bottom right
    );

    const scale = 0.1; //~ this is to scale the triangles themselves, not the positions

    var vsOut: VSOutput;
    var positionsScale = 0.1; //~ scaling the positions (TODO: actually normalize)

        //~ constructing the world position from component buffers
    var x = xPositions[instanceIndex] * positionsScale;
    var y = yPositions[instanceIndex] * positionsScale;
    var z = zPositions[instanceIndex] * positionsScale;
    var instPos = vec4f(x, y, z, 1.0);

        //~ impostors: align to alway face camera
    var eyeToPos = normalize(instPos - uni.eyePosition);
    var upVec = vec3f(0.0, 1.0, 0.0);
    var rightVec = cross(eyeToPos.xyz, upVec);
    var v = pos[vertexIndex] * scale;
    var vPos = v.x * rightVec + v.y * upVec;

        //~ calculate position of each instance vertex
        //var vertPos = instPos + vec4f(pos[vertexIndex] * scale, 0.0, 1.0);
    var vertPos = instPos + vec4f(vPos, 1.0);
        //~ camera transform + projection
    var transformedPos = uni.projection * uni.view * vertPos;

        //~ outputs for fragment shader
    vsOut.position = transformedPos;
    vsOut.color = colors[instanceIndex];
    vsOut.uv = pos[vertexIndex];
    return vsOut;
}

@fragment
fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        //if (distance(vsOut.uv, vec2f(0, 0)) > 0.1) {
        //    discard;
        //}
    return vsOut.color;
        //return vec4f(vsOut.uv, 0, 1.0);
}
