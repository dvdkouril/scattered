import { prepareViewMatrix, prepareCameraMatrix } from "./utils";
import { vec3 } from "gl-matrix";
import { Camera } from "./camera";

export function uploadDataToGPU(
  device: GPUDevice,
  xPositionsArray: Float32Array,
  yPositionsArray: Float32Array,
  zPositionsArray: Float32Array
): [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer] {
  const uploadPositionBuffer = (bufferSize: number, dataValues: Float32Array) => {
    const dataBuffer = device.createBuffer({
      label: "buffer for x positions",
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(dataBuffer, 0, dataValues);
    return dataBuffer;
  };

  const numOfPoints = xPositionsArray.length;
  /* generating random colors */
  const colorsArr: number[] = [];
  for (let i = 0; i < numOfPoints; i++) {
    const rgb = [Math.random(), Math.random(), Math.random(), 1.0];
    colorsArr.push(...rgb);
  }

  const bufferSize = 4 * 4 * numOfPoints;
  /* x buffer */
  const xBuffer = uploadPositionBuffer(bufferSize, xPositionsArray);
  /* y buffer */
  const yBuffer = uploadPositionBuffer(bufferSize, yPositionsArray);
  /* z buffer */
  const zBuffer = uploadPositionBuffer(bufferSize, zPositionsArray);
  /* colors buffer: TODO: kinda semantically not correct */
  const colBuffer = uploadPositionBuffer(bufferSize, new Float32Array(colorsArr));

  return [xBuffer, yBuffer, zBuffer, colBuffer];
}

export function createShaders(device: GPUDevice, presentationFormat: GPUTextureFormat): GPURenderPipeline {
  /* -------- shaders setup --------  */
  const module = device.createShaderModule({
    label: 'instanced triangles',
    code: `
      struct Uniforms {
        projection: mat4x4f,
        view: mat4x4f,
        eyePosition: vec4f,
      };

      //struct Settings {
      //  scalingFactor: float,
      //};

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
 
      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        //if (distance(vsOut.uv, vec2f(0, 0)) > 0.1) {
        //    discard;
        //}
        return vsOut.color;
        //return vec4f(vsOut.uv, 0, 1.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      entryPoint: 'vs',
      module,
    },
    fragment: {
      entryPoint: 'fs',
      module,
      targets: [{ format: presentationFormat }],
    },
  });

  return pipeline;
}

export async function initWebGPUStuff(
  canvas: HTMLCanvasElement,
  xArray: Float32Array,
  yArray: Float32Array,
  zArray: Float32Array,
) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    console.error('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  if (!context) {
    console.error('failed when getting webgpu context');
    return;
  }
  context.configure({
    device,
    format: presentationFormat,
  });

  const pipeline = createShaders(device, presentationFormat);

  const [xBuffer, yBuffer, zBuffer, colorsBuffer] = uploadDataToGPU(
    device,
    xArray,
    yArray,
    zArray,
  );

  /* -------- buffer setup: uniforms (matrices) --------  */
  const uniformBufferSize = 4 * 16 * 2 + 4 * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  //const uniformValues = new Float32Array(uniformBufferSize / 4);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      //{ binding: 0, resource: { buffer: dataBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
      { binding: 2, resource: { buffer: xBuffer } },
      { binding: 3, resource: { buffer: yBuffer } },
      { binding: 4, resource: { buffer: zBuffer } },
      { binding: 5, resource: { buffer: colorsBuffer } },
    ],
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        view: context.getCurrentTexture().createView(), //~ had to add this to get rid of ts error
        clearValue: [0.0, 0.0, 0.0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  let autoOrbiting = {
    angle: 0,
    speed: 0.01,
    radius: 2,
  };
  let camera = new Camera();
  let firstInteractionHappened = false;

  function render() {
    //console.log("render()");
    //let requestId = requestAnimationFrame(render);
    requestAnimationFrame(render);
    if (!device) {
      console.warn("device should not be null or undefined at this point!");
      return;
    }
    if (!context) {
      console.warn("context should not be null or undefined at this point!");
      return;
    }

    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    for (const colAtt of renderPassDescriptor.colorAttachments) {
      if (colAtt) {
        colAtt.view = context.getCurrentTexture().createView();
      }
    }

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    let cameraPosition: vec3;
    if (!firstInteractionHappened) {
      const camX = Math.cos(autoOrbiting.angle) * autoOrbiting.radius;
      const camZ = Math.sin(autoOrbiting.angle) * autoOrbiting.radius;
      cameraPosition = vec3.fromValues(camX, 0, camZ);
    } else {
      cameraPosition = camera.getPosition();
    }
    const projectionMatrix = prepareCameraMatrix(w, h);
    const viewMatrix = prepareViewMatrix(cameraPosition);
    console.log("cameraPosition");
    console.log(cameraPosition);

    const projectionMatAsF32A = projectionMatrix as Float32Array; //~ TODO: is this correct???
    const viewMatAsF32A = viewMatrix as Float32Array; //~ TODO: is this correct???

    const numOfMatrices = 2;
    const allUniformArrays = new Float32Array(numOfMatrices * 16 + 4);
    allUniformArrays.set(projectionMatAsF32A, 0);
    allUniformArrays.set(viewMatAsF32A, projectionMatAsF32A.length);
    allUniformArrays.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 1.0], projectionMatAsF32A.length + viewMatAsF32A.length);

    device.queue.writeBuffer(uniformBuffer, 0, allUniformArrays);

    const numOfObjects = xArray.length; //~ TODO: kinda hacky
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, numOfObjects);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    //~ yeah this is probably the worst way of doing this
    const speed = autoOrbiting.speed;
    autoOrbiting = {
      ...autoOrbiting,
      angle: autoOrbiting.angle += speed * Math.PI / 12
    };
  }


  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // re-render
      render();
    }
  });
  observer.observe(canvas);

  function onPointerDown(event: PointerEvent) {
    if (!firstInteractionHappened) {
      camera = new Camera(autoOrbiting.angle, autoOrbiting.radius);
      firstInteractionHappened = true;
    }
    camera.onPointerDown(event);
  }

  function onPointerUp(event: PointerEvent) {
    camera.onPointerUp(event);
  }

  function onMouseMove(event: MouseEvent) {
    camera.onMouseMove(event);
  }

  function onWheel(event: WheelEvent) {
    if (!firstInteractionHappened) {
      camera = new Camera(autoOrbiting.angle, autoOrbiting.radius);
      firstInteractionHappened = true;
    }
    event.preventDefault();
    camera.onWheel(event);
  }
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel);
  canvas.style.touchAction = 'none'; //~ disable page scroll
}
