declare namespace naver {
  namespace maps {
    class Map {
      constructor(element: string | HTMLElement, options?: MapOptions)
      setCenter(latlng: LatLng): void
      getCenter(): LatLng
      setZoom(zoom: number, animate?: boolean): void
      destroy(): void
    }
    class LatLng {
      constructor(lat: number, lng: number)
      lat(): number
      lng(): number
    }
    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      getPosition(): LatLng
    }
    class InfoWindow {
      constructor(options: InfoWindowOptions)
      open(map: Map, anchor: Marker): void
      close(): void
    }
    interface MapOptions {
      center?: LatLng
      zoom?: number
      mapTypeId?: string
      mapDataControl?: boolean
      logoControl?: boolean
      logoControlOptions?: object
      scaleControl?: boolean
      zoomControl?: boolean
      zoomControlOptions?: object
      minZoom?: number
      maxZoom?: number
      tileSpare?: number
    }
    interface MarkerOptions {
      position: LatLng
      map?: Map
      icon?: MarkerImageOptions | string
      title?: string
    }
    interface MarkerImageOptions {
      content?: string
      size?: Size
      anchor?: Point
    }
    interface InfoWindowOptions {
      content: string
      borderWidth?: number
      disableAnchor?: boolean
      backgroundColor?: string
      borderColor?: string
      pixelOffset?: Point
    }
    class Size {
      constructor(width: number, height: number)
    }
    class Point {
      constructor(x: number, y: number)
    }
    namespace Event {
      function addListener(target: object, type: string, listener: (e: unknown) => void): unknown
    }
    namespace Service {
      function geocode(
        options: GeocodeOptions,
        callback: (status: Status, response: GeocodeResponse) => void
      ): void
      const Status: {
        OK: string
        ERROR: string
      }
      interface GeocodeOptions {
        query: string
        coordinate?: string
      }
      interface GeocodeResponse {
        v2: {
          addresses: GeocodeAddress[]
          meta: { totalCount: number }
        }
      }
      interface GeocodeAddress {
        roadAddress: string
        jibunAddress: string
        x: string
        y: string
      }
    }
  }
}

interface Window {
  naver: typeof naver
}
