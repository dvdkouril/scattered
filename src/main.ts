//import { fetchRemoteData } from "./loaders";

function display(url: string): HTMLCanvasElement {
  const cEl = document.createElement("canvas");
  initWebGPUStuff(cEl);
  //const data = fetchRemoteData(url);
  console.log(`gonna fetch from ${url}`);
  cEl.style.width = "100%";
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

      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @group(0) @binding(0) var<storage, read> triangleData: array<TriangleData>;

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
        vsOut.position = vec4f(
          pos[vertexIndex] * scale + triangleData[instanceIndex].position.xy,
          0.0, 
          1.0
        );
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

  // create a typedarray to hold the values for the uniforms in JavaScript
  //const uniformValues = new Float32Array(uniformBufferSize / 4);
  const dataValues = new Float32Array(a);

  //const positionOffset = 0;
  //const colorOffset = 4;
  device.queue.writeBuffer(dataBuffer, 0, dataValues);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dataBuffer } },
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

    //const aspect = canvas.width / canvas.height;
    //for (const { scale, bindGroup, uniformBuffer, uniformValues } of objectInfos) {
    //  uniformValues.set([scale / aspect, scale], kScaleOffset);
    //  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
    //  pass.setBindGroup(0, bindGroup);
    //  pass.draw(3);  // call our vertex shader 3 times
    //}
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
