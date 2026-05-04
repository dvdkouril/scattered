export type SpriteMapResult = {
  texture: GPUTexture;
  sampler: GPUSampler;
  gridCols: number;
  gridRows: number;
};

/**
 * If the source image exceeds GPU texture limits, re-layout the tiles into a
 * squarer grid that fits. Returns an ImageBitmap ready for GPU upload along
 * with the new grid dimensions.
 */
function relayoutIfNeeded(
  source: ImageBitmap,
  thumbnailWidth: number,
  thumbnailHeight: number,
  maxTextureSize: number,
): { bitmap: ImageBitmap; gridCols: number; gridRows: number } | null {
  const srcCols = Math.floor(source.width / thumbnailWidth);
  const srcRows = Math.floor(source.height / thumbnailHeight);

  if (source.width <= maxTextureSize && source.height <= maxTextureSize) {
    return null; // no relayout needed
  }

  const totalTiles = srcCols * srcRows;

  // Compute a new square-ish grid that fits within maxTextureSize
  const maxCols = Math.floor(maxTextureSize / thumbnailWidth);
  const newCols = Math.min(maxCols, Math.ceil(Math.sqrt(totalTiles)));
  const newRows = Math.ceil(totalTiles / newCols);

  const newWidth = newCols * thumbnailWidth;
  const newHeight = newRows * thumbnailHeight;

  if (newWidth > maxTextureSize || newHeight > maxTextureSize) {
    throw new Error(
      `Sprite map has ${totalTiles} tiles — even after relayout the texture ` +
      `(${newWidth}x${newHeight}) exceeds the GPU limit of ${maxTextureSize}.`,
    );
  }

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < totalTiles; i++) {
    const srcCol = i % srcCols;
    const srcRow = Math.floor(i / srcCols);
    const dstCol = i % newCols;
    const dstRow = Math.floor(i / newCols);

    ctx.drawImage(
      source,
      srcCol * thumbnailWidth,
      srcRow * thumbnailHeight,
      thumbnailWidth,
      thumbnailHeight,
      dstCol * thumbnailWidth,
      dstRow * thumbnailHeight,
      thumbnailWidth,
      thumbnailHeight,
    );
  }

  const bitmap = canvas.transferToImageBitmap();
  return { bitmap, gridCols: newCols, gridRows: newRows };
}

/**
 * Creates a 1×1 tile magenta (#FF00FF) fallback texture. The sampler uses
 * repeat addressing so every sprite UV maps to the same magenta fill.
 */
function createFallbackSpriteMap(
  device: GPUDevice,
  thumbnailWidth: number,
  thumbnailHeight: number,
): SpriteMapResult {
  const texture = device.createTexture({
    label: "sprite map fallback texture",
    size: [thumbnailWidth, thumbnailHeight, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const pixels = new Uint8Array(thumbnailWidth * thumbnailHeight * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i]     = 0xFF; // R
    pixels[i + 1] = 0x00; // G
    pixels[i + 2] = 0xFF; // B
    pixels[i + 3] = 0xFF; // A
  }
  device.queue.writeTexture(
    { texture },
    pixels,
    { bytesPerRow: thumbnailWidth * 4 },
    [thumbnailWidth, thumbnailHeight],
  );

  const sampler = device.createSampler({
    label: "sprite map fallback sampler",
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
  });

  return { texture, sampler, gridCols: 1, gridRows: 1 };
}

export async function loadSpriteMap(
  device: GPUDevice,
  url: string,
  thumbnailWidth: number,
  thumbnailHeight: number,
): Promise<SpriteMapResult> {
  let imageBitmap: ImageBitmap;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch sprite map (${response.status}): ${url}`);
      return createFallbackSpriteMap(device, thumbnailWidth, thumbnailHeight);
    }
    const blob = await response.blob();
    imageBitmap = await createImageBitmap(blob);
  } catch (err) {
    console.error(`Failed to load sprite map: ${url}`, err);
    return createFallbackSpriteMap(device, thumbnailWidth, thumbnailHeight);
  }

  const maxTextureSize = device.limits.maxTextureDimension2D;

  let uploadSource: ImageBitmap = imageBitmap;
  let gridCols = Math.floor(imageBitmap.width / thumbnailWidth);
  let gridRows = Math.floor(imageBitmap.height / thumbnailHeight);

  const relayout = relayoutIfNeeded(
    imageBitmap,
    thumbnailWidth,
    thumbnailHeight,
    maxTextureSize,
  );
  if (relayout) {
    uploadSource = relayout.bitmap;
    gridCols = relayout.gridCols;
    gridRows = relayout.gridRows;
    imageBitmap.close();
  }

  const texture = device.createTexture({
    label: "sprite map texture",
    size: [uploadSource.width, uploadSource.height, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: uploadSource },
    { texture },
    [uploadSource.width, uploadSource.height],
  );

  const sampler = device.createSampler({
    label: "sprite map sampler",
    magFilter: "linear",
    minFilter: "linear",
  });

  uploadSource.close();

  return { texture, sampler, gridCols, gridRows };
}
