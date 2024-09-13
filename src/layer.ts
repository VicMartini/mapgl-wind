import { Map as MapboxMap } from 'mapbox-gl';
import { MapGLWindRenderer } from './index.js'; // Assuming this class exists
import { bindFramebuffer, bindTexture } from './utils.js';
//TODO: Make this configurable
const DEFAULT_WIND_DATA = {
  source: 'http://nomads.ncep.noaa.gov',
  date: '2016-11-20T00:00Z',
  width: 360,
  height: 180,
  uMin: -21.32,
  uMax: 26.8,
  vMin: -21.57,
  vMax: 21.42,
};

interface TileID {
  x: number;
  y: number;
  z: number;
}

export class WindLayer {
  private mapInstance?: MapboxMap;
  private gl?: WebGL2RenderingContext;
  private renderer?: MapGLWindRenderer;
  public maxZoom?: number;
  private windDataURL: string;
  private textureWidth: number;
  private textureHeight: number;
  private numParticles: number;
  private fadeOpacity: number;

  constructor(
    windDataURL: string,
    textureWidth: number,
    textureHeight: number,
    numParticles: number = 55000,
    fadeOpacity: number = 0.93,

    maxZoom?: number,
  ) {
    this.windDataURL = windDataURL;
    this.maxZoom = maxZoom;
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
    this.numParticles = numParticles;
    this.fadeOpacity = fadeOpacity;
  }

  private onAdd(map: MapboxMap, gl: WebGL2RenderingContext) {
    this.mapInstance = map;
    this.renderer = new MapGLWindRenderer(
      gl,
      this.textureWidth,
      this.textureHeight,
    );

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = this.windDataURL;

    const windData = DEFAULT_WIND_DATA;

    this.renderer.numParticles = this.numParticles;
    this.renderer.fadeOpacity = this.fadeOpacity;

    image.onload = () => {
      this?.renderer?.setWind(DEFAULT_WIND_DATA, image);
      this?.renderer?.resize();
    };
    this.mapInstance.triggerRepaint();
  }

  private renderToTile(gl: WebGLRenderingContext, tileId: TileID) {
    if (this?.renderer?.ready) {
      const offsetScale = this.getOffsetAndScaleForTileMapping(
        { x: 0, y: 0, z: 0 },
        tileId,
      );
      this.renderer.drawTexture(
        //@ts-ignore TODO: Check this. Why does the screenTexture need to be passed here?
        this.renderer.screenTexture as WebGLTexture,
        0.6,
        offsetScale,
      );
      this.mapInstance?.triggerRepaint();
    }
  }

  private shouldRerenderTiles(): boolean {
    return true;
  }

  private prerender(gl: WebGLRenderingContext, matrix: any) {
    if (this.renderer?.ready) {
      this.doPreRender();
    }
  }

  private render(gl: WebGLRenderingContext, matrix: any) {
    console.log('render');
    if (this.renderer?.ready) {
      const offsetScale = this.getOffsetAndScaleForTileMapping(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 }, // Assuming tileId, adjust as needed
      );
      //@ts-ignore TODO: Check this. Why does the screenTexture need to be passed here?
      this.renderer.drawTexture(this.renderer.screenTexture, 0.6, offsetScale);
      this.mapInstance?.triggerRepaint();
    }
  }

  private getOffsetAndScaleForTileMapping(
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
    const xTileOffset =
      ((windTile.x << zoomDiff) - tileX) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
    const yTileOffset =
      ((windTile.y << zoomDiff) - targetTile.y) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
    return [xTileOffset, yTileOffset, scale, scale];
  }
}

function prerender() {
  var gl = wind.gl;

  gl.disable(gl.BLEND);

  // save the current screen as the background for the next frame
  var temp = wind.backgroundTexture;
  wind.backgroundTexture = wind.screenTexture;
  wind.screenTexture = temp;

  bindTexture(gl, wind.windTexture, 0);
  bindTexture(gl, wind.particleStateTexture0, 1);

  wind.updateParticles();

  gl.disable(gl.BLEND);

  bindTexture(gl, wind.windTexture, 0);
  bindTexture(gl, wind.particleStateTexture0, 1);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);

  // draw the screen into a temporary framebuffer to retain it as the background on the next frame
  bindFramebuffer(gl, wind.framebuffer, wind.screenTexture);
  gl.viewport(0, 0, wind.texWidth(), wind.texHeight());

  wind.drawTexture(wind.backgroundTexture, wind.fadeOpacity);
  wind.drawParticles();

  // TODO wind.updateParticles() and split swap of textures to render()
}

function render() {
  // Not used in terrain demo
  var gl = wind.gl;

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);

  // Wind drawScreen:
  bindFramebuffer(gl, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // enable blending to support drawing on top of an existing background (e.g. a map)
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  wind.drawTexture(wind.screenTexture, 1.0);
  gl.disable(gl.BLEND);
}
