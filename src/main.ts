//import { fetchRemoteData } from "./loaders";

import { mat4 } from "gl-matrix";

async function loadDataFromURL(url: string): Promise<ArrayBuffer | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    //return load(buffer, options);
    return buffer;
  } catch (err) {
    let message = "Unknown Error";
    if (err instanceof Error) message = err.message;
    console.error(message);
    return undefined;
  }
}

function prepareCameraMatrix(width: number, height: number): mat4 {

  const projMat = mat4.create();
  const fovy = Math.PI / 4.0;
  const near = 10.0;
  const far = 0.1;
  const aspect = width / height;
  //mat4.perspective(projMat, fovy, aspect, near, far);
  mat4.perspectiveZO(projMat, fovy, aspect, near, far);

  return projMat;
}

function display(url: string): HTMLCanvasElement {
  const cEl = document.createElement("canvas");
  cEl.style.width = "100%";

  console.log(`gonna fetch from ${url}`);
  //loadDataFromURL(url).then(d => {
  //  if (d) {
  //    console.log(`loaded data of size: ${d.byteLength}`);
  //  } else {
  //    console.log("failed fetching the data");
  //  }
  //  d?.byteLength
  //}).catch(_ => { console.log("failed fetching the data") });

  initWebGPUStuff(cEl);

  return cEl;
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

function generateRandomPoints(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    res.push(rand(), rand(), rand(), 1);
  }
  return res;
}

async function initWebGPUStuff(canvas: HTMLCanvasElement) {
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

  /* -------- shaders setup --------  */
  const module = device.createShaderModule({
    label: 'instanced triangles',
    code: `
      struct TriangleData {
        position: vec4f,
        color: vec4f,
      };
  
      struct Uniforms {
        projection: mat4x4f,
      };

      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @group(0) @binding(0) var<storage, read> triangleData: array<TriangleData>;
      @group(0) @binding(1) var<uniform> uni: Uniforms;

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
        @builtin(instance_index) instanceIndex: u32
      ) -> VSOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
       
        const scale = 0.1;
        var vsOut: VSOutput;
        var instPos = triangleData[instanceIndex].position;
        var vertPos = instPos + vec4f(pos[vertexIndex] * scale, -5.0, 1.0);
        var transformedPos = uni.projection * vertPos;
        //vsOut.position = vec4f(
        //  pos[vertexIndex] * scale + instPos.xy,
        //  0.0, 
        //  1.0
        //);
        vsOut.position = transformedPos;
        vsOut.color = triangleData[instanceIndex].color;
        return vsOut;
      }
 
      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        return vsOut.color;
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

  /* -------- buffer setup --------  */
  const numOfObjects = 100;
  const a = generateRandomPoints(numOfObjects);

  const dataBufferSize =
    4 * 4 + // position is 4 32bit floats (4bytes each)
    4 * 4   // color is 4 32bit floats (4bytes each)
  const dataBuffer = device.createBuffer({
    label: "buffer for positions + colors for each instance",
    size: dataBufferSize * numOfObjects,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const dataValues = new Float32Array(a);
  device.queue.writeBuffer(dataBuffer, 0, dataValues);

  /* -------- buffer setup: uniforms (matrices) --------  */
  const uniformBufferSize = 4 * 4 * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  //const uniformValues = new Float32Array(uniformBufferSize / 4);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dataBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        view: context.getCurrentTexture().createView(), //~ had to add this to get rid of ts error
        clearValue: [1.0, 1.0, 1.0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  function render() {
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
    console.log(`width: ${w}, height: ${h}`);
    const projectionMatrix = prepareCameraMatrix(w, h);

    const uniformValues = projectionMatrix as Float32Array; //~ TODO: is this correct???
    console.log("uniformValues");
    console.log(uniformValues);
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    pass.setBindGroup(0, bindGroup);
    pass.draw(3, numOfObjects);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
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
}

export { display };
