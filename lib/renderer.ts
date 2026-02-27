import { prepareViewMatrix, prepareCameraMatrix, hexColorToFloatArray, showCanvasError } from "./utils";
import { vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { assert } from "./assert";
import { DisplayOptions, ScreenshotOptions } from "./types.ts";
import { findPointsInLasso, ScreenPoint } from "./lasso";

/**
 * Uploads the positional coordinate arrays to GPU buffers. 
 * Also generates random colors (for now) and uploads them to a GPU buffer, too.
 *
 */
export function uploadDataToGPU(
  device: GPUDevice,
  xPositionsArray: Float32Array,
  yPositionsArray: Float32Array,
  zPositionsArray: Float32Array,
  colorsArray: Float32Array,
): [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer] {
  const uploadPositionBuffer = (bufferSize: number, dataValues: Float32Array, label: string = "position buffer") => {
    const dataBuffer = device.createBuffer({
      label: label,
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(dataBuffer, 0, dataValues);
    return dataBuffer;
  };

  const numOfPoints = xPositionsArray.length;
  assert(yPositionsArray.length === numOfPoints, "number of y-coordinates should correspond to the number of x-coordinates.");
  assert(zPositionsArray.length === numOfPoints, "number of z-coordinates should correspond to the number of x-coordinates.");

  /* x buffer */
  const xBuffer = uploadPositionBuffer(xPositionsArray.byteLength, xPositionsArray, "buffer for x positions");
  /* y buffer */
  const yBuffer = uploadPositionBuffer(yPositionsArray.byteLength, yPositionsArray, "buffer for y positions");
  /* z buffer */
  const zBuffer = uploadPositionBuffer(zPositionsArray.byteLength, zPositionsArray, "buffer for z positions");
  /* colors buffer: TODO: kinda semantically not correct */
  const colBuffer = uploadPositionBuffer(colorsArray.byteLength, colorsArray, "buffer for colors");

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
        positionsScale: f32,
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
        //~ constructing the world position from component buffers
        var x = xPositions[instanceIndex] * uni.positionsScale;
        var y = yPositions[instanceIndex] * uni.positionsScale;
        var z = zPositions[instanceIndex] * uni.positionsScale;
        var instPos = vec4f(x, y, z, 1.0);

        //~ impostors: align to alway face camera
        var eyeToPos = normalize(instPos - uni.eyePosition);
        var upVec = vec3f(0.0, 1.0, 0.0);
        var rightVec = cross(upVec, eyeToPos.xyz);
        var v = pos[vertexIndex] * scale;
        var vPos = v.x * rightVec + v.y * upVec;

        //~ calculate position of each instance vertex
        //var vertPos = instPos + vec4f(pos[vertexIndex] * scale, 0.0, 1.0);
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
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  return pipeline;
}

export async function initWebGPUStuff(
  canvas: HTMLCanvasElement,
  xArray: Float32Array,
  yArray: Float32Array,
  zArray: Float32Array,
  colorsArray: Float32Array,
  positionsScale: number,
  options?: DisplayOptions,
): Promise<{ destroy: () => void; screenshot: (options?: ScreenshotOptions) => Promise<void> } | undefined> {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    showCanvasError(canvas, '`scattered` requires the WebGPU API, which is not supported in this browser.');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  if (!context) {
    showCanvasError(canvas, 'Failed to get a WebGPU context.');
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
    colorsArray,
  );

  /* -------- buffer setup: uniforms (matrices) --------  */
  const uniformBufferSize = 4 * 16 * 2 + 4 * 4 + 4 * 4; // 2 matrices + eyePosition vec4 + positionsScale f32 (padded to 16)
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

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const bgColor = options?.backgroundColor ?? "#ffffff";
  const bgColorArr = hexColorToFloatArray(bgColor);

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        view: context.getCurrentTexture().createView(), //~ had to add this to get rid of ts error
        clearValue: [...bgColorArr, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  let autoOrbiting = {
    angle: 0,
    speed: 0.01,
    radius: 3,
  };
  let camera = new Camera();
  let firstInteractionHappened = false;
  let animFrameId: number;

  // Lasso selection state
  let isLassoing = false;
  let lassoPath: ScreenPoint[] = [];
  let originalColors: Float32Array | null = null;

  // Lasso overlay canvas (2D drawing surface on top of WebGPU canvas)
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.top = "0";
  overlayCanvas.style.left = "0";
  overlayCanvas.style.width = "100%";
  overlayCanvas.style.height = "100%";
  overlayCanvas.style.pointerEvents = "none";
  if (canvas.parentElement) {
    const parentPos = getComputedStyle(canvas.parentElement).position;
    if (parentPos === "static") {
      canvas.parentElement.style.position = "relative";
    }
    canvas.parentElement.appendChild(overlayCanvas);
  }
  const overlayCtx = overlayCanvas.getContext("2d")!;

  function syncOverlaySize() {
    const w = overlayCanvas.clientWidth;
    const h = overlayCanvas.clientHeight;
    if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }
  }
  syncOverlaySize();

  function drawLassoOverlay() {
    syncOverlaySize();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (lassoPath.length < 2) return;
    overlayCtx.beginPath();
    overlayCtx.moveTo(lassoPath[0].x, lassoPath[0].y);
    for (let i = 1; i < lassoPath.length; i++) {
      overlayCtx.lineTo(lassoPath[i].x, lassoPath[i].y);
    }
    overlayCtx.closePath();
    overlayCtx.fillStyle = "rgba(255, 105, 180, 0.1)";
    overlayCtx.fill();
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.strokeStyle = "rgba(255, 105, 180, 0.8)";
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();
  }

  function render() {
    animFrameId = requestAnimationFrame(render);

    assert(device, "device should not be null or undefined at this point!");
    assert(context, "context should not be null or undefined at this point!");

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
    // firstInteractionHappened = true; //~ turning off the auto orbiting for now
    if (!firstInteractionHappened) {
      const camX = Math.cos(autoOrbiting.angle) * autoOrbiting.radius;
      const camZ = Math.sin(autoOrbiting.angle) * autoOrbiting.radius;
      cameraPosition = vec3.fromValues(camX, 0, camZ);
    } else {
      cameraPosition = camera.getPosition();
    }
    const projectionMatrix = prepareCameraMatrix(w, h);
    const viewMatrix = prepareViewMatrix(cameraPosition, camera.target);

    const projectionMatAsF32A = projectionMatrix as Float32Array; //~ TODO: is this correct???
    const viewMatAsF32A = viewMatrix as Float32Array; //~ TODO: is this correct???

    const numOfMatrices = 2;
    const allUniformArrays = new Float32Array(numOfMatrices * 16 + 8); // +8 for eyePosition vec4 + positionsScale f32 (padded to 16)
    allUniformArrays.set(projectionMatAsF32A, 0);
    allUniformArrays.set(viewMatAsF32A, projectionMatAsF32A.length);
    allUniformArrays.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 1.0], projectionMatAsF32A.length + viewMatAsF32A.length);
    allUniformArrays.set([positionsScale], projectionMatAsF32A.length + viewMatAsF32A.length + 4);

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

      const newDepthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTexture.destroy(); //~ clean up old texture
      renderPassDescriptor.depthStencilAttachment = {
        ...renderPassDescriptor.depthStencilAttachment,
        view: newDepthTexture.createView(),
      };

      // Sync overlay canvas buffer to its CSS size
      syncOverlaySize();

      // re-render
      render();
    }
  });
  observer.observe(canvas);

  function onPointerDown(event: PointerEvent) {
    if (!firstInteractionHappened) {
      camera = new Camera(autoOrbiting.angle, autoOrbiting.radius, Math.PI / 2);
      firstInteractionHappened = true;
    }
    canvas.setPointerCapture(event.pointerId);

    if (event.shiftKey) {
      isLassoing = true;
      lassoPath = [{ x: event.offsetX, y: event.offsetY }];
      return;
    }

    camera.onPointerDown(event);
  }

  function onPointerUp(event: PointerEvent) {
    if (isLassoing) {
      isLassoing = false;
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Compute camera matrices
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cameraPosition = firstInteractionHappened
        ? camera.getPosition()
        : vec3.fromValues(
          Math.cos(autoOrbiting.angle) * autoOrbiting.radius,
          0,
          Math.sin(autoOrbiting.angle) * autoOrbiting.radius,
        );
      const projectionMatrix = prepareCameraMatrix(w, h);
      const viewMatrix = prepareViewMatrix(cameraPosition, camera.target);

      const selectedIndices = findPointsInLasso(
        xArray, yArray, zArray,
        projectionMatrix, viewMatrix,
        w, h, positionsScale, lassoPath,
      );

      console.log(`Lasso selected ${selectedIndices.length} points:`, selectedIndices);

      // Notify via callback
      if (options?.onSelect) {
        options.onSelect(selectedIndices);
      }

      // Save original colors on first selection
      if (!originalColors) {
        originalColors = new Float32Array(colorsArray);
      }

      if (selectedIndices.length > 0) {
        const newColors = new Float32Array(originalColors);
        for (const idx of selectedIndices) {
          newColors[idx * 4 + 0] = 1.0;   // R
          newColors[idx * 4 + 1] = 0.412; // G
          newColors[idx * 4 + 2] = 0.706; // B
          newColors[idx * 4 + 3] = 1;     // A
        }
        assert(device, "device should not be null or undefined at this point!");
        device.queue.writeBuffer(colorsBuffer, 0, newColors);
      } else {
        // No selection: restore original colors
        assert(device, "device should not be null or undefined at this point!");
        device.queue.writeBuffer(colorsBuffer, 0, originalColors);
      }

      return;
    }

    camera.onPointerUp(event);
  }

  function onMouseMove(event: MouseEvent) {
    if (isLassoing) {
      lassoPath.push({ x: event.offsetX, y: event.offsetY });
      drawLassoOverlay();
      return;
    }

    camera.onMouseMove(event);
  }

  function onWheel(event: WheelEvent) {
    if (!firstInteractionHappened) {
      camera = new Camera(autoOrbiting.angle, autoOrbiting.radius, Math.PI / 2);
      firstInteractionHappened = true;
    }
    event.preventDefault();
    camera.onWheel(event);
  }
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel);
  function onContextMenu(event: Event) { event.preventDefault(); }
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.style.touchAction = 'none'; //~ disable page scroll

  async function screenshot(options?: ScreenshotOptions): Promise<void> {
    assert(device, "device should not be null or undefined at this point!");

    const filename = options?.filename ?? "screenshot.png";

    // If width/height not specified, scale up the canvas to ~4K preserving aspect ratio
    let w: number;
    let h: number;
    if (options?.width || options?.height) {
      w = options?.width ?? canvas.width;
      h = options?.height ?? canvas.height;
    } else {
      const targetLongEdge = 4096;
      const scale = targetLongEdge / Math.max(canvas.width, canvas.height);
      w = Math.round(canvas.width * scale);
      h = Math.round(canvas.height * scale);
    }

    // 1. Create an offscreen canvas at the target resolution
    const offscreen = new OffscreenCanvas(w, h);
    const offCtx = offscreen.getContext("webgpu");
    if (!offCtx) {
      throw new Error("Failed to get WebGPU context on OffscreenCanvas");
    }
    offCtx.configure({
      device,
      format: presentationFormat,
    });

    // 2. Create a depth texture at the target resolution
    const offDepthTexture = device.createTexture({
      size: [w, h],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // 3. Build a render pass descriptor
    const offRenderPassDescriptor: GPURenderPassDescriptor = {
      label: "screenshot offscreen renderPass",
      colorAttachments: [
        {
          view: offCtx.getCurrentTexture().createView(),
          clearValue: [...bgColorArr, 1],
          loadOp: "clear" as const,
          storeOp: "store" as const,
        },
      ],
      depthStencilAttachment: {
        view: offDepthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear" as const,
        depthStoreOp: "store" as const,
      },
    };

    // 4. Compute camera position (respecting current orbit/interaction state)
    let cameraPosition: vec3;
    if (!firstInteractionHappened) {
      const camX = Math.cos(autoOrbiting.angle) * autoOrbiting.radius;
      const camZ = Math.sin(autoOrbiting.angle) * autoOrbiting.radius;
      cameraPosition = vec3.fromValues(camX, 0, camZ);
    } else {
      cameraPosition = camera.getPosition();
    }

    // 5. Compute matrices using offscreen dimensions for correct aspect ratio
    const projectionMatrix = prepareCameraMatrix(w, h);
    const viewMatrix = prepareViewMatrix(cameraPosition, camera.target);

    const projectionMatAsF32A = projectionMatrix as Float32Array;
    const viewMatAsF32A = viewMatrix as Float32Array;

    const numOfMatrices = 2;
    const allUniformArrays = new Float32Array(numOfMatrices * 16 + 8);
    allUniformArrays.set(projectionMatAsF32A, 0);
    allUniformArrays.set(viewMatAsF32A, projectionMatAsF32A.length);
    allUniformArrays.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 1.0], projectionMatAsF32A.length + viewMatAsF32A.length);
    allUniformArrays.set([positionsScale], projectionMatAsF32A.length + viewMatAsF32A.length + 4);

    // 6. Write uniforms, encode render pass, submit
    device.queue.writeBuffer(uniformBuffer, 0, allUniformArrays);

    const encoder = device.createCommandEncoder({ label: "screenshot encoder" });
    const pass = encoder.beginRenderPass(offRenderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, xArray.length);
    pass.end();
    device.queue.submit([encoder.finish()]);

    // 7. Wait for GPU work to complete
    await device.queue.onSubmittedWorkDone();

    // 8. Capture the offscreen canvas as a blob and trigger download
    const blob = await offscreen.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    // 9. Clean up
    URL.revokeObjectURL(url);
    offDepthTexture.destroy();
  }

  return {
    destroy: () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      overlayCanvas.remove();
      device.destroy();
    },
    screenshot,
  };
}
