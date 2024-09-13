import mapboxgl from 'mapbox-gl';
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

interface WindLayerParams {
  id: string;
  windDataURL: string;
  textureWidth: number;
  textureHeight: number;
  numParticles?: number;
  fadeOpacity?: number;
  maxzoom?: number;
  minzoom?: number;
}

export class WindLayer implements mapboxgl.CustomLayerInterface {
  id: string;
  type: 'custom';
  private map?: mapboxgl.Map;
  private renderer?: MapGLWindRenderer;
  public maxzoom?: number;
  public minzoom?: number;
  private windDataURL: string;
  private textureWidth: number;
  private textureHeight: number;
  private numParticles: number;
  private fadeOpacity: number;
  public renderingMode: '3d';

  constructor({
    id,
    windDataURL,
    textureWidth,
    textureHeight,
    maxzoom = 20,
    minzoom = 0,
    numParticles = 65536,
    fadeOpacity = 0.996,
  }: WindLayerParams) {
    this.id = id;
    this.type = 'custom';
    this.renderingMode = '3d';
    this.windDataURL = windDataURL;
    this.maxzoom = maxzoom;
    this.minzoom = minzoom;
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
    this.numParticles = numParticles;
    this.fadeOpacity = fadeOpacity;
  }

  public onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;

    this.renderer = new MapGLWindRenderer(
      gl,
      this.textureWidth,
      this.textureHeight,
    );

    this.map.setLayerZoomRange(this.id, this.minzoom ?? 0, this.maxzoom ?? 20);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = this.windDataURL;

    this.renderer.numParticles = this.numParticles;
    this.renderer.fadeOpacity = this.fadeOpacity;

    image.onload = () => {
      this?.renderer?.setWind(DEFAULT_WIND_DATA, image);
      this?.renderer?.resize();
      this.renderer?.prerender();
      this.renderer?.renderToTile(gl, { x: 0, y: 0, z: 0 });
      this.map?.triggerRepaint();
    };
  }

  public renderToTile(gl: WebGLRenderingContext, tileId: TileID) {
    if (!this.map) {
      throw new Error('Attempted to render to tile before adding layer to map');
    }
    this.renderer?.renderToTile(gl, tileId);
    this.map.triggerRepaint();
  }

  public shouldRerenderTiles(): boolean {
    return true;
  }
  public prerender(_gl: WebGLRenderingContext, _matrix: number[]) {
    try {
      this.renderer?.prerender();
    } catch (error) {
      // TODO: Is there a better way to handle this?
      console.warn(
        'Warning: Mapbox tried to call prerender before the wind texture was loaded',
      );
    }
  }

  public render(_gl: WebGLRenderingContext, _matrix: number[]) {
    throw new Error('Method not implemented.');
  }
  public onRemove() {
    console.log('onRemove');
    this.renderer?.destroy();
  }
}
