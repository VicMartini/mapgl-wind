import mapboxgl, { ProjectionSpecification } from 'mapbox-gl';
import GlobeWindRenderer from './globe/renderer.js';
import MercatorWindRenderer from './mercator/renderer.js';
import { TileID } from './utils.js';
import { RampColors } from './mercator/renderer.js';

interface WindData {
  source?: string;
  date?: string;
  width: number;
  height: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

interface WindLayerParams {
  id?: string;
  windDataURL: string;
  windMetadata: WindData;
  maxzoom?: number;
  minzoom?: number;
  opacity?: number;
  globeModeResolution?: number;
  globeModeNumberOfParticles?: number;
  mercatorModeNumberOfParticles?: number;
  globeModeFadeOpacity?: number;
  mercatorModeFadeOpacity?: number;
  globeModeSpeedFactor?: number;
  mercatorModeSpeedFactor?: number;
  transformRequest?: (url: string) => {
    url: string;
    headers?: Record<string, string>;
  };
  colors?: RampColors;
}

export class WindLayer implements mapboxgl.CustomLayerInterface {
  public id: string;
  public type: 'custom';
  public maxzoom?: number;
  public minzoom?: number;
  public renderingMode: '2d';

  private map?: mapboxgl.Map;
  private mercatorRenderer?: MercatorWindRenderer;
  private globeRenderer?: GlobeWindRenderer;
  private windDataURL: string;
  private colors?: RampColors;
  private opacity: number;
  private globeModeResolution: number;
  private globeModeNumberOfParticles: number;
  private mercatorModeNumberOfParticles: number;
  private windData: WindData;
  private globeModeFadeOpacity: number;
  private mercatorModeFadeOpacity: number;
  private globeModeSpeedFactor: number;
  private mercatorModeSpeedFactor: number;
  private transformRequest?: (url: string) => {
    url: string;
    headers?: Record<string, string>;
  };

  constructor({
    id = 'wind-layer',
    windDataURL,
    windMetadata: windData,
    globeModeResolution = 10240,
    globeModeNumberOfParticles = 65536,
    mercatorModeNumberOfParticles = 6553,
    globeModeFadeOpacity = 0.996,
    mercatorModeFadeOpacity = 0.996,
    globeModeSpeedFactor = 0.25,
    mercatorModeSpeedFactor = 0.25,
    maxzoom = 20,
    minzoom = 0,
    opacity = 1.0,
    colors,
    transformRequest,
  }: WindLayerParams) {
    this.id = id;
    this.type = 'custom';
    this.renderingMode = '2d';
    this.windDataURL = windDataURL;
    this.windData = windData;
    this.globeModeResolution = globeModeResolution;
    this.globeModeNumberOfParticles = globeModeNumberOfParticles;
    this.mercatorModeNumberOfParticles = mercatorModeNumberOfParticles;
    this.maxzoom = maxzoom;
    this.minzoom = minzoom;
    this.colors = colors;
    this.transformRequest = transformRequest;
    this.globeModeFadeOpacity = globeModeFadeOpacity;
    this.mercatorModeFadeOpacity = mercatorModeFadeOpacity;
    this.globeModeSpeedFactor = globeModeSpeedFactor;
    this.mercatorModeSpeedFactor = mercatorModeSpeedFactor;
    this.opacity = opacity;
  }

  public onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;

    this.mercatorRenderer = new MercatorWindRenderer(
      gl,
      map,
      this.colors,
      this.opacity,
      this.mercatorModeFadeOpacity,
      this.mercatorModeSpeedFactor,
    );

    this.globeRenderer = new GlobeWindRenderer(
      gl,
      map,
      this.globeModeResolution,
      this.globeModeResolution,
      this.colors,
      this.opacity,
      this.globeModeFadeOpacity,
      this.globeModeSpeedFactor,
    );

    this.map.setLayerZoomRange(this.id, this.minzoom ?? 0, this.maxzoom ?? 20);

    this.mercatorRenderer.numParticles = this.mercatorModeNumberOfParticles;
    this.globeRenderer.numParticles = this.globeModeNumberOfParticles;

    this.setWindTextureURL(this.windDataURL);
  }

  public async setWindTextureURL(url: string) {
    const request = this.transformRequest
      ? this.transformRequest(url)
      : { url };
    const response = await fetch(request.url, { headers: request.headers });
    const blob = await response.blob();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = URL.createObjectURL(blob);

    image.onload = () => {
      if (!this.mercatorRenderer || !this.globeRenderer || !this.map) {
        console.warn('Renderers or map not initialized');
        return;
      }

      this.mercatorRenderer.setWind(this.windData, image);
      this.globeRenderer.setWind(this.windData, image);
      this.map.triggerRepaint();
    };
  }

  public renderToTile(gl: WebGL2RenderingContext, tileId: TileID) {
    if (!this.map) {
      throw new Error('Attempted to render to tile before adding layer to map');
    }
    this.globeRenderer?.renderToTile(gl, tileId);
    this.map.triggerRepaint();
  }

  public shouldRerenderTiles(): boolean {
    return true;
  }

  public prerender(
    gl: WebGL2RenderingContext,
    matrix: Array<number>,
    projection?: ProjectionSpecification,
    projectionToMercatorMatrix?: Array<number>,
    projectionToMercatorTransition?: number,
    centerInMercator?: Array<number>,
    pixelsPerMeterRatio?: number,
  ) {
    try {
      const renderer =
        projectionToMercatorTransition === undefined
          ? this.mercatorRenderer
          : this.globeRenderer;

      renderer?.prerender(
        gl,
        matrix,
        projection,
        projectionToMercatorMatrix,
        projectionToMercatorTransition,
        centerInMercator,
        pixelsPerMeterRatio,
      );
    } catch (error) {
      console.warn(
        'Warning: Mapbox tried to call prerender before the wind texture was loaded',
      );
    }
  }

  public render(
    gl: WebGL2RenderingContext,
    matrix: Array<number>,
    projection?: ProjectionSpecification,
    projectionToMercatorMatrix?: Array<number>,
    projectionToMercatorTransition?: number,
    centerInMercator?: Array<number>,
    pixelsPerMeterRatio?: number,
  ) {
    if (!this.map) {
      throw new Error('Attempted to render before adding layer to map');
    }
    this.mercatorRenderer?.render(
      gl,
      matrix,
      projection,
      projectionToMercatorMatrix,
      projectionToMercatorTransition,
      centerInMercator,
      pixelsPerMeterRatio,
    );
    this.map.triggerRepaint();
  }

  public onRemove() {
    this.mercatorRenderer?.destroy();
    this.globeRenderer?.destroy();
  }
}
