function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  gl.shaderSource(shader, source);

  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Failed to compile shader');
  }

  return shader;
}

export type WebGLProgramWrapper = {
  program: WebGLProgram;
  [key: string]: WebGLUniformLocation | number | WebGLProgram;
};

export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgramWrapper {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create program');
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Failed to link program');
  }

  const wrapper: {
    program: WebGLProgram;
    [key: string]: WebGLUniformLocation | number | WebGLProgram;
  } = { program: program };

  const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < numAttributes; i++) {
    const attribute = gl.getActiveAttrib(program, i);
    if (attribute) {
      wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
    }
  }
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < numUniforms; i++) {
    const uniform = gl.getActiveUniform(program, i);
    if (uniform) {
      wrapper[uniform.name] = gl.getUniformLocation(
        program,
        uniform.name,
      ) as WebGLUniformLocation;
    }
  }

  return wrapper;
}

export function createTexture(
  gl: WebGLRenderingContext,
  filter: number,
  data: Uint8Array | HTMLImageElement,
  width?: number,
  height?: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create texture');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (data instanceof Uint8Array) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width!,
      height!,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function bindTexture(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  unit: number,
): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

export function createBuffer(
  gl: WebGLRenderingContext,
  data: BufferSource,
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create buffer');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

export function bindAttribute(
  gl: WebGLRenderingContext,
  buffer: WebGLBuffer,
  attribute: number,
  numComponents: number,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

export function bindFramebuffer(
  gl: WebGLRenderingContext,
  framebuffer: WebGLFramebuffer | null,
  texture?: WebGLTexture,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  }
}

export interface TileID {
  x: number;
  y: number;
  z: number;
}

export function getOffsetAndScaleForTileMapping(
  windTile: TileID,
  targetTile: TileID,
) {
  const zoomDiff = targetTile.z - windTile.z;
  // const wrap = (tile.tileID.wrap - proxyTileID.wrap) << proxyTileID.overscaledZ;
  if (zoomDiff < 0) {
    console.warn(
      'Implementation here assumes that wind rasters are of lower or equal zoom than the terrain drape tiles.',
    );
  }
  const scale = 1 << zoomDiff;
  const tileX =
    ((targetTile.x % (1 << targetTile.z)) + (1 << targetTile.z)) %
    (1 << targetTile.z); // don't care here about wrap, render the same to all world copies
  const xTileOffset = ((windTile.x << zoomDiff) - tileX) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
  const yTileOffset =
    ((windTile.y << zoomDiff) - targetTile.y) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
  return [xTileOffset, yTileOffset, scale, scale];
}
