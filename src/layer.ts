import { Map as MapboxMap } from 'mapbox-gl';
import { MapGLWindRenderer } from './index.js'; // Assuming this class exists
import { TileID } from './utils.js';
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

  public onAdd(map: MapboxMap, gl: WebGL2RenderingContext) {
    this.mapInstance = map;
    this.renderer = new MapGLWindRenderer(
      gl,
      this.textureWidth,
      this.textureHeight,
    );

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = this.windDataURL;

    this.renderer.numParticles = this.numParticles;
    this.renderer.fadeOpacity = this.fadeOpacity;

    image.onload = () => {
      this?.renderer?.setWind(DEFAULT_WIND_DATA, image);
      this?.renderer?.resize();
    };
    this.mapInstance.triggerRepaint();
  }

  public renderToTile(gl: WebGLRenderingContext, tileId: TileID) {
    if (!this.mapInstance) {
      throw new Error('Attempted to render to tile before adding layer to map');
    }
    this.renderer?.renderToTile(gl, tileId, this.mapInstance);
  }

  public shouldRerenderTiles(): boolean {
    return true;
  }
  public prerender(_gl: WebGLRenderingContext, _matrix: number[]) {
    this.renderer?.prerender();
  }

  public render(_gl: WebGLRenderingContext, _matrix: number[]) {
    throw new Error('Method not implemented.');
  }
}
