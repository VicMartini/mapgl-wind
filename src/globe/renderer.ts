import * as utils from '../utils.js';

import drawVert from './shaders/draw.vert.glsl';
import drawFrag from './shaders/draw.frag.glsl';

import quadVert from './shaders/quad.vert.glsl';
import tileQuadVert from './shaders/tile_quad.vert.glsl';

import screenFrag from './shaders/screen.frag.glsl';
import updateFrag from './shaders/update.frag.glsl';

import { Map, ProjectionSpecification } from 'mapbox-gl';

export interface RampColors {
  [key: number]: string;
}

const defaultRampColors: RampColors = {
  0.0: '#e6f3ff', // Light sky blue
  0.1: '#d1e8ff', // Pale blue
  0.2: '#b8e2ff', // Light azure
  0.3: '#a0dcff', // Light cyan
  0.4: '#8ad6ff', // Light turquoise
  0.5: '#75d0ff', // Light cerulean
  0.6: '#61caff', // Light sky
  0.7: '#4dc4ff', // Light cornflower
  0.8: '#38beff', // Light steel blue
  0.9: '#24b8ff', // Light dodger blue
  1.0: '#10b2ff', // Light deep sky blue
};

interface WindData {
  width: number;
  height: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}
export default class GlobeWindRenderer {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;
  public fadeOpacity: number;
  private speedFactor: number;
  private dropRate: number;
  private dropRateBump: number;
  private _numParticles?: number;
  private particleStateResolution?: number;
  private drawProgram: utils.WebGLProgramWrapper;
  private screenProgram: utils.WebGLProgramWrapper;
  private tileProgram: utils.WebGLProgramWrapper;
  private updateProgram: utils.WebGLProgramWrapper;
  private quadBuffer: WebGLBuffer;
  private framebuffer: WebGLFramebuffer;
  private backgroundTexture?: WebGLTexture;
  private screenTexture?: WebGLTexture;
  private colorRampTexture: WebGLTexture;
  private particleStateTexture0?: WebGLTexture;
  private particleStateTexture1?: WebGLTexture;
  private particleIndexBuffer?: WebGLBuffer;
  private windData?: WindData;
  private windTexture?: WebGLTexture;
  private bbox?: number[];
  private matrix?: Float32Array;
  private map: Map;
  private opacity: number;
  constructor(
    gl: WebGL2RenderingContext,
    map: Map,
    width: number,
    height: number,
    colors: RampColors = defaultRampColors,
    opacity: number = 1.0,
    fadeOpacity: number = 0.96,
    speedFactor: number = 0.25,
    dropRate: number = 0.003,
    dropRateBump: number = 0.01,
  ) {
    this.gl = gl;
    this.map = map;

    this.width = width;
    this.height = height;

    this.fadeOpacity = fadeOpacity; // how fast the particle trails fade on each frame
    this.speedFactor = speedFactor; // how fast the particles move
    this.dropRate = dropRate; // how often the particles move to a random place
    this.dropRateBump = dropRateBump; // drop rate increase relative to individual particle speed

    this.drawProgram = utils.createProgram(gl, drawVert, drawFrag);
    this.screenProgram = utils.createProgram(gl, quadVert, screenFrag);
    this.tileProgram = utils.createProgram(gl, tileQuadVert, screenFrag);
    this.updateProgram = utils.createProgram(gl, quadVert, updateFrag);

    this.quadBuffer = utils.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    );
    this.framebuffer = gl.createFramebuffer()!;
    this.colorRampTexture = utils.createTexture(
      this.gl,
      this.gl.LINEAR,
      getColorRamp(colors),
      16,
      16,
    );

    this.opacity = opacity;

    this.setView([0, 0, 1, 1]);
    this.resize();
  }

  get ready(): boolean {
    return !!this.windTexture;
  }

  texWidth(): number {
    return this.width || this.gl.canvas.width;
  }
  texHeight(): number {
    return this.width || this.gl.canvas.height;
  }

  resize(): void {
    const gl = this.gl;
    const emptyPixels = new Uint8Array(this.texWidth() * this.texHeight() * 4);
    // screen textures to hold the drawn screen for the previous and the current frame
    this.backgroundTexture = utils.createTexture(
      gl,
      gl.NEAREST,
      emptyPixels,
      this.texWidth(),
      this.texHeight(),
    );
    this.screenTexture = utils.createTexture(
      gl,
      gl.NEAREST,
      emptyPixels,
      this.texWidth(),
      this.texHeight(),
    );
  }

  set numParticles(numParticles: number) {
    const gl = this.gl;

    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    const particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(numParticles),
    ));
    this._numParticles = particleRes * particleRes;

    const particleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < particleState.length; i++) {
      particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }
    // textures to hold the particle state for the current and the next frame
    this.particleStateTexture0 = utils.createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes,
    );
    this.particleStateTexture1 = utils.createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes,
    );

    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
    this.particleIndexBuffer = utils.createBuffer(gl, particleIndices);
  }
  get numParticles(): number {
    if (!this._numParticles) {
      throw new Error('numParticles is not set');
    }
    return this._numParticles;
  }

  setWind(data: WindData, image: HTMLImageElement | Uint8Array): void {
    this.windData = data;
    this.windTexture = utils.createTexture(this.gl, this.gl.LINEAR, image);
  }

  setView(bbox: number[], matrix?: Float32Array): void {
    this.bbox = bbox;

    if (matrix) {
      this.matrix = matrix;
    } else {
      const minX = bbox[0];
      const minY = mercY(bbox[3]);
      const maxX = bbox[2];
      const maxY = mercY(bbox[1]);

      const kx = 2 / (maxX - minX);
      const ky = 2 / (maxY - minY);

      this.matrix = new Float32Array([
        kx,
        0,
        0,
        0,
        0,
        ky,
        0,
        0,
        0,
        0,
        1,
        0,
        -1 - minX * kx,
        -1 - minY * ky,
        0,
        1,
      ]);
    }
  }

  draw(): void {
    const gl = this.gl;
    if (!this.windTexture || !this.particleStateTexture0) {
      throw new Error('No wind texture or particle state texture');
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    utils.bindTexture(gl, this.windTexture, 0);
    utils.bindTexture(gl, this.particleStateTexture0, 1);

    this.drawScreen();
    this.updateParticles();
  }

  drawScreen(): void {
    const gl = this.gl;
    if (!this.backgroundTexture || !this.screenTexture) {
      throw new Error('No background texture or screen texture');
    }
    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    utils.bindFramebuffer(gl, this.framebuffer, this.screenTexture);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.drawTexture(this.backgroundTexture, this.fadeOpacity);
    this.drawParticles();

    utils.bindFramebuffer(gl, null);
    // enable blending to support drawing on top of an existing background (e.g. a map)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.drawTexture(this.screenTexture, 1.0);
    gl.disable(gl.BLEND);

    // save the current screen as the background for the next frame
    const temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;
  }

  drawTexture(
    texture: WebGLTexture,
    opacity: number,
    offsetScale?: number[],
  ): void {
    const gl = this.gl;
    const program = offsetScale ? this.tileProgram : this.screenProgram;
    gl.useProgram(program.program);

    utils.bindAttribute(gl, this.quadBuffer, program.a_pos as number, 2);
    utils.bindTexture(gl, texture, 2);
    gl.uniform1i(program.u_screen as number, 2);
    gl.uniform1f(program.u_opacity, opacity);
    if (offsetScale) {
      gl.uniform4fv(program.u_offset_scale, offsetScale);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawParticles(): void {
    const gl = this.gl;
    if (
      !this.particleIndexBuffer ||
      !this.particleStateResolution ||
      !this.windData ||
      !this.matrix ||
      !this.bbox ||
      !this._numParticles
    ) {
      throw new Error(
        'Missing required particle data: ' +
          (!this.particleIndexBuffer ? 'particle index buffer, ' : '') +
          (!this.particleStateResolution ? 'particle state resolution, ' : '') +
          (!this.windData ? 'wind data, ' : '') +
          (!this.matrix ? 'matrix, ' : '') +
          (!this.bbox ? 'bounding box, ' : '') +
          (!this._numParticles ? 'number of particles' : ''),
      );
    }
    const program = this.drawProgram;
    gl.useProgram(program.program);

    utils.bindAttribute(
      gl,
      this.particleIndexBuffer,
      program.a_index as number,
      1,
    );
    utils.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, this.matrix);
    gl.uniform4fv(program.u_bbox, this.bbox);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  updateParticles(): void {
    const gl = this.gl;
    if (
      !this.particleStateResolution ||
      !this.framebuffer ||
      !this.particleStateTexture1 ||
      !this.windData ||
      !this.bbox
    ) {
      throw new Error(
        'Missing required particle state data: ' +
          (!this.particleStateResolution ? 'particle state resolution, ' : '') +
          (!this.framebuffer ? 'framebuffer, ' : '') +
          (!this.particleStateTexture1 ? 'particle state texture 1' : '') +
          (!this.windData ? 'wind data, ' : '') +
          (!this.bbox ? 'bounding box' : ''),
      );
    }
    utils.bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution,
    );

    const program = this.updateProgram;
    gl.useProgram(program.program);

    utils.bindAttribute(gl, this.quadBuffer, program.a_pos as number, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
    gl.uniform4fv(program.u_bbox, this.bbox);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    const temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;
  }

  public prerender(
    gl: WebGL2RenderingContext,
    _matrix: Array<number>,
    _projection?: ProjectionSpecification,
    _projectionToMercatorMatrix?: Array<number>,
    _projectionToMercatorTransition?: number,
    _centerInMercator?: Array<number>,
    _pixelsPerMeterRatio?: number,
  ) {
    if (!this.windTexture || !this.particleStateTexture0) {
      throw new Error('No wind texture or particle state texture');
    }

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    // save the current screen as the background for the next frame
    const temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;

    utils.bindTexture(gl, this.windTexture, 0);
    utils.bindTexture(gl, this.particleStateTexture0, 1);

    this.updateParticles();

    utils.bindTexture(gl, this.windTexture, 0);
    utils.bindTexture(gl, this.particleStateTexture0, 1);

    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    utils.bindFramebuffer(gl, this.framebuffer, this.screenTexture);
    gl.viewport(0, 0, this.texWidth(), this.texHeight());
    if (!this.backgroundTexture) {
      throw new Error('No background texture');
    }

    this.drawTexture(this.backgroundTexture, this.fadeOpacity);
    this.drawParticles();

    gl.disable(gl.BLEND);
  }

  public render(_gl: WebGL2RenderingContext, _matrix: number[]) {
    throw new Error(
      'Not implemented, this renderer is meant to be used only for the globe mode',
    );
  }

  public renderToTile(gl: WebGLRenderingContext, tileId: utils.TileID) {
    const offsetScale = utils.getOffsetAndScaleForTileMapping(
      { x: 0, y: 0, z: 0 },
      tileId,
    );
    this.drawTexture(
      this.screenTexture as WebGLTexture,
      this.opacity,
      offsetScale,
    );
  }

  public destroy() {
    if (this.windTexture) {
      this.gl.deleteTexture(this.windTexture);
    }
    if (this.particleStateTexture0) {
      this.gl.deleteTexture(this.particleStateTexture0);
    }
    if (this.particleStateTexture1) {
      this.gl.deleteTexture(this.particleStateTexture1);
    }
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.colorRampTexture);
    this.gl.deleteBuffer(this.quadBuffer);
  }
}

function getColorRamp(colors: RampColors): Uint8Array {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    antialias: true,
  }) as CanvasRenderingContext2D;

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  canvas.width = 512;
  canvas.height = 1;

  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  for (const stop in colors) {
    gradient.addColorStop(+stop, colors[+stop]);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);

  return new Uint8Array(ctx.getImageData(0, 0, 512, 1).data);
}

function mercY(y: number): number {
  const s = Math.sin(Math.PI * (y - 0.5));
  const y2 =
    1.0 - (Math.log((1.0 + s) / (1.0 - s)) / (2 * Math.PI) + 1.0) / 2.0;
  return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
