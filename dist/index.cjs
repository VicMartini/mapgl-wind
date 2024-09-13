"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  MapGLWindRenderer: () => MapGLWindRenderer,
  WindLayer: () => WindLayer
});
module.exports = __toCommonJS(src_exports);

// src/util.ts
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Failed to compile shader");
  }
  return shader;
}
function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Failed to link program");
  }
  const wrapper = { program };
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
      wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }
  }
  return wrapper;
}
function createTexture(gl, filter, data, width, height) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (data instanceof Uint8Array) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}
function bindTexture(gl, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}
function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}
function bindAttribute(gl, buffer, attribute, numComponents) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}
function bindFramebuffer(gl, framebuffer, texture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }
}

// src/shaders/draw.vert.glsl
var draw_vert_default = "precision mediump float;attribute float a_index;uniform sampler2D u_particles;uniform float u_particles_res;uniform mat4 u_matrix;uniform vec4 u_bbox;varying vec2 v_particle_pos;void main(){vec4 color=texture2D(u_particles,vec2(fract(a_index/u_particles_res),floor(a_index/u_particles_res)/u_particles_res));vec2 pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);v_particle_pos=u_bbox.xy+pos*(u_bbox.zw-u_bbox.xy);float s=sin(radians(v_particle_pos.y*180.0-90.0));float y=1.0-(degrees(log((1.0+s)/(1.0-s)))/360.0+1.0)/2.0;gl_PointSize=12.0;gl_Position=u_matrix*vec4(v_particle_pos.x,y,0,1);}";

// src/shaders/draw.frag.glsl
var draw_frag_default = "precision mediump float;uniform sampler2D u_wind;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform sampler2D u_color_ramp;varying vec2 v_particle_pos;void main(){vec2 velocity=mix(u_wind_min,u_wind_max,texture2D(u_wind,v_particle_pos).rg);float speed_t=length(velocity)/length(u_wind_max);vec2 center=gl_PointCoord-0.5;float dist=length(center*2.0);if(dist>1.0){discard;}vec2 ramp_pos=vec2(fract(16.0*speed_t),floor(16.0*speed_t)/16.0);gl_FragColor=texture2D(u_color_ramp,ramp_pos);}";

// src/shaders/quad.vert.glsl
var quad_vert_default = "precision mediump float;attribute vec2 a_pos;varying vec2 v_tex_pos;void main(){v_tex_pos=a_pos;gl_Position=vec4(1.0-2.0*a_pos,0,1);}";

// src/shaders/tile_quad.vert.glsl
var tile_quad_vert_default = "precision mediump float;uniform vec4 u_offset_scale;attribute vec2 a_pos;varying vec2 v_tex_pos;void main(){vec2 uv=a_pos/u_offset_scale.zw-u_offset_scale.xy;v_tex_pos=vec2(1.0-uv.x,uv.y);gl_Position=vec4(2.0*a_pos-1.0,0,1);}";

// src/shaders/screen.frag.glsl
var screen_frag_default = "precision mediump float;uniform sampler2D u_screen;uniform float u_opacity;varying vec2 v_tex_pos;void main(){vec2 texSize=vec2(16384.0,16384.0);vec2 texel=1.0/texSize;vec4 color=vec4(0.0);vec2 uv=1.0-v_tex_pos;vec2 texel_offset=vec2(0.5)*texel;vec4 tl=texture2D(u_screen,uv+vec2(-texel_offset.x,-texel_offset.y));vec4 tr=texture2D(u_screen,uv+vec2(texel_offset.x,-texel_offset.y));vec4 bl=texture2D(u_screen,uv+vec2(-texel_offset.x,texel_offset.y));vec4 br=texture2D(u_screen,uv+vec2(texel_offset.x,texel_offset.y));vec2 f=fract(uv*texSize);vec4 tA=mix(tl,tr,f.x);vec4 tB=mix(bl,br,f.x);color=mix(tA,tB,f.y);color*=u_opacity;gl_FragColor=vec4(floor(255.0*color.rgb)/255.0,color.a);}";

// src/shaders/update.frag.glsl
var update_frag_default = "precision highp float;uniform sampler2D u_particles;uniform sampler2D u_wind;uniform vec2 u_wind_res;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform float u_rand_seed;uniform float u_speed_factor;uniform float u_drop_rate;uniform float u_drop_rate_bump;uniform vec4 u_bbox;varying vec2 v_tex_pos;const vec3 rand_constants=vec3(12.9898,78.233,4375.85453);float rand(const vec2 co){float t=dot(rand_constants.xy,co);return fract(sin(t)*(rand_constants.z+t));}vec2 lookup_wind(const vec2 uv){vec2 px=1.0/u_wind_res;vec2 vc=(floor(uv*u_wind_res))*px;vec2 f=fract(uv*u_wind_res);vec2 tl=texture2D(u_wind,vc).rg;vec2 tr=texture2D(u_wind,vc+vec2(px.x,0)).rg;vec2 bl=texture2D(u_wind,vc+vec2(0,px.y)).rg;vec2 br=texture2D(u_wind,vc+px).rg;return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}void main(){vec4 color=texture2D(u_particles,v_tex_pos);vec2 pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);vec2 global_pos=u_bbox.xy+pos*(u_bbox.zw-u_bbox.xy);vec2 velocity=mix(u_wind_min,u_wind_max,lookup_wind(global_pos));float speed_t=length(velocity)/length(u_wind_max);float distortion=cos(radians(global_pos.y*180.0-90.0));vec2 offset=vec2(velocity.x/distortion,-velocity.y)*0.0001*u_speed_factor;pos=fract(1.0+pos+offset);vec2 seed=(pos+v_tex_pos)*u_rand_seed;float drop_rate=u_drop_rate+speed_t*u_drop_rate_bump;float retain=step(drop_rate,rand(seed));vec2 random_pos=vec2(rand(seed+1.3),1.0-rand(seed+2.1));pos=mix(pos,random_pos,1.0-retain);gl_FragColor=vec4(fract(pos*255.0),floor(pos*255.0)/255.0);}";

// src/renderer.ts
var defaultRampColors = {
  0: "#e6f3ff",
  // Light sky blue
  0.1: "#d1e8ff",
  // Pale blue
  0.2: "#b8e2ff",
  // Light azure
  0.3: "#a0dcff",
  // Light cyan
  0.4: "#8ad6ff",
  // Light turquoise
  0.5: "#75d0ff",
  // Light cerulean
  0.6: "#61caff",
  // Light sky
  0.7: "#4dc4ff",
  // Light cornflower
  0.8: "#38beff",
  // Light steel blue
  0.9: "#24b8ff",
  // Light dodger blue
  1: "#10b2ff"
  // Light deep sky blue
};
var MapGLWindRenderer = class {
  gl;
  width;
  height;
  fadeOpacity;
  speedFactor;
  dropRate;
  dropRateBump;
  _numParticles;
  particleStateResolution;
  drawProgram;
  screenProgram;
  tileProgram;
  updateProgram;
  quadBuffer;
  framebuffer;
  backgroundTexture;
  screenTexture;
  colorRampTexture;
  particleStateTexture0;
  particleStateTexture1;
  particleIndexBuffer;
  windData;
  windTexture;
  bbox;
  matrix;
  constructor(gl, width, height, colors = defaultRampColors) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.fadeOpacity = 0.996;
    this.speedFactor = 0.25;
    this.dropRate = 3e-3;
    this.dropRateBump = 0.01;
    this.numParticles = 65536;
    this.drawProgram = createProgram(gl, draw_vert_default, draw_frag_default);
    this.screenProgram = createProgram(gl, quad_vert_default, screen_frag_default);
    this.tileProgram = createProgram(gl, tile_quad_vert_default, screen_frag_default);
    this.updateProgram = createProgram(gl, quad_vert_default, update_frag_default);
    this.quadBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
    this.framebuffer = gl.createFramebuffer();
    this.colorRampTexture = createTexture(this.gl, this.gl.LINEAR, getColorRamp(colors), 16, 16);
    this.setView([0, 0, 1, 1]);
    this.resize();
  }
  texWidth() {
    return this.width || this.gl.canvas.width;
  }
  texHeight() {
    return this.width || this.gl.canvas.height;
  }
  resize() {
    const gl = this.gl;
    const emptyPixels = new Uint8Array(this.texWidth() * this.texHeight() * 4);
    this.backgroundTexture = createTexture(gl, gl.NEAREST, emptyPixels, this.texWidth(), this.texHeight());
    this.screenTexture = createTexture(gl, gl.NEAREST, emptyPixels, this.texWidth(), this.texHeight());
  }
  set numParticles(numParticles) {
    const gl = this.gl;
    const particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
    this._numParticles = particleRes * particleRes;
    const particleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < particleState.length; i++) {
      particleState[i] = Math.floor(Math.random() * 256);
    }
    this.particleStateTexture0 = createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);
    this.particleStateTexture1 = createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);
    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++)
      particleIndices[i] = i;
    this.particleIndexBuffer = createBuffer(gl, particleIndices);
  }
  get numParticles() {
    if (!this._numParticles) {
      throw new Error("numParticles is not set");
    }
    return this._numParticles;
  }
  setWind(data, image) {
    this.windData = data;
    this.windTexture = createTexture(this.gl, this.gl.LINEAR, image);
  }
  setView(bbox, matrix) {
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
      this.matrix = new Float32Array([kx, 0, 0, 0, 0, ky, 0, 0, 0, 0, 1, 0, -1 - minX * kx, -1 - minY * ky, 0, 1]);
    }
  }
  draw() {
    const gl = this.gl;
    if (!this.windTexture || !this.particleStateTexture0) {
      throw new Error("No wind texture or particle state texture");
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);
    this.drawScreen();
    this.updateParticles();
  }
  drawScreen() {
    const gl = this.gl;
    if (!this.backgroundTexture || !this.screenTexture) {
      throw new Error("No background texture or screen texture");
    }
    bindFramebuffer(gl, this.framebuffer, this.screenTexture);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this.drawTexture(this.backgroundTexture, this.fadeOpacity);
    this.drawParticles();
    bindFramebuffer(gl, null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.drawTexture(this.screenTexture, 1);
    gl.disable(gl.BLEND);
    const temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;
  }
  drawTexture(texture, opacity, offsetScale) {
    const gl = this.gl;
    const program = offsetScale ? this.tileProgram : this.screenProgram;
    gl.useProgram(program.program);
    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
    bindTexture(gl, texture, 2);
    gl.uniform1i(program.u_screen, 2);
    gl.uniform1f(program.u_opacity, opacity);
    if (offsetScale) {
      gl.uniform4fv(program.u_offset_scale, offsetScale);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  drawParticles() {
    const gl = this.gl;
    if (!this.particleIndexBuffer || !this.particleStateResolution || !this.windData || !this.matrix || !this.bbox || !this._numParticles) {
      throw new Error("Missing required particle data: " + (!this.particleIndexBuffer ? "particle index buffer, " : "") + (!this.particleStateResolution ? "particle state resolution, " : "") + (!this.windData ? "wind data, " : "") + (!this.matrix ? "matrix, " : "") + (!this.bbox ? "bounding box, " : "") + (!this._numParticles ? "number of particles" : ""));
    }
    const program = this.drawProgram;
    gl.useProgram(program.program);
    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
    bindTexture(gl, this.colorRampTexture, 2);
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
  updateParticles() {
    const gl = this.gl;
    if (!this.particleStateResolution || !this.framebuffer || !this.particleStateTexture1 || !this.windData || !this.bbox) {
      throw new Error("Missing required particle state data: " + (!this.particleStateResolution ? "particle state resolution, " : "") + (!this.framebuffer ? "framebuffer, " : "") + (!this.particleStateTexture1 ? "particle state texture 1" : "") + (!this.windData ? "wind data, " : "") + (!this.bbox ? "bounding box" : ""));
    }
    bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);
    const program = this.updateProgram;
    gl.useProgram(program.program);
    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
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
    const temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;
  }
};
function getColorRamp(colors) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { antialias: true });
  if (!ctx) {
    throw new Error("Failed to get 2D context");
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
function mercY(y) {
  const s = Math.sin(Math.PI * (y - 0.5));
  const y2 = 1 - (Math.log((1 + s) / (1 - s)) / (2 * Math.PI) + 1) / 2;
  return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}

// src/layer.ts
var wind;
var mapInstance;
var WindLayer = {
  id: "wind",
  type: "custom",
  maxzoom: 1,
  onAdd: (map, gl) => {
    mapInstance = map;
    console.log("onAdd");
    wind = new MapGLWindRenderer(gl, 16384, 16384);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "http://localhost:8001/image/";
    let windData = {
      source: "http://nomads.ncep.noaa.gov",
      date: "2016-11-20T00:00Z",
      width: 360,
      height: 180,
      uMin: -21.32,
      uMax: 26.8,
      vMin: -21.57,
      vMax: 21.42
    };
    wind.numParticles = 55e3;
    wind.fadeOpacity = 0.93;
    image.onload = function() {
      wind.setWind(windData, image);
      wind.resize();
    };
    mapInstance.triggerRepaint();
  },
  renderToTile: (gl, tileId2) => {
    console.log("renderToTile");
    if (wind.windData) {
      const offsetScale = getOffsetAndScaleForTileMapping(
        { x: 0, y: 0, z: 0 },
        tileId2
      );
      wind.drawTexture(wind.screenTexture, 0.6, offsetScale);
      mapInstance.triggerRepaint();
    }
  },
  shouldRerenderTiles: () => {
    return true;
  },
  prerender: (gl, matrix) => {
    wind.windTexture && prerender();
  },
  render: (gl, matrix) => {
    console.log("renderToTile");
    if (wind.windData) {
      const offsetScale = getOffsetAndScaleForTileMapping(
        { x: 0, y: 0, z: 0 },
        tileId
      );
      wind.drawTexture(wind.screenTexture, 0.6, offsetScale);
      mapInstance.triggerRepaint();
    }
  }
};
function getOffsetAndScaleForTileMapping(windTile, targetTile) {
  const zoomDiff = targetTile.z - windTile.z;
  if (zoomDiff < 0) {
    console.warn(
      "Implementation here assumes that wind rasters are of lower or equal zoom than the terrain drape tiles."
    );
  }
  const scale = 1 << zoomDiff;
  const tileX = (targetTile.x % (1 << targetTile.z) + (1 << targetTile.z)) % (1 << targetTile.z);
  const xTileOffset = ((windTile.x << zoomDiff) - tileX) / (1 << targetTile.z);
  const yTileOffset = ((windTile.y << zoomDiff) - targetTile.y) / (1 << targetTile.z);
  return [xTileOffset, yTileOffset, scale, scale];
}
function bindTexture2(gl, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}
function bindFramebuffer2(gl, framebuffer, texture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
  }
}
function prerender() {
  var gl = wind.gl;
  gl.disable(gl.BLEND);
  var temp = wind.backgroundTexture;
  wind.backgroundTexture = wind.screenTexture;
  wind.screenTexture = temp;
  bindTexture2(gl, wind.windTexture, 0);
  bindTexture2(gl, wind.particleStateTexture0, 1);
  wind.updateParticles();
  gl.disable(gl.BLEND);
  bindTexture2(gl, wind.windTexture, 0);
  bindTexture2(gl, wind.particleStateTexture0, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);
  bindFramebuffer2(gl, wind.framebuffer, wind.screenTexture);
  gl.viewport(0, 0, wind.texWidth(), wind.texHeight());
  wind.drawTexture(wind.backgroundTexture, wind.fadeOpacity);
  wind.drawParticles();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MapGLWindRenderer,
  WindLayer
});
