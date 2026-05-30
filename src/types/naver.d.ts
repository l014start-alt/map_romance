declare namespace naver {
  namespace maps {
    class Map {
      constructor(element: string | HTMLElement, options?: MapOptions)
      setCenter(latlng: LatLng): void
      getCenter(): LatLng
      getZoom(): number
      setZoom(zoom: number, animate?: boolean): void
      panTo(latlng: LatLng, options?: { duration?: number; easing?: string }): void
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
      open(map: Map, anchor: Marker | LatLng): void
      close(): void
      setContent(content: string): void
      getMap(): Map | null
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
      maxWidth?: number
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
        callback: (status: string, response: GeocodeResponse) => void
      ): void
      function reverseGeocode(
        options: ReverseGeocodeOptions,
        callback: (status: string, response: ReverseGeocodeResponse) => void
      ): void
      const Status: { OK: string; ERROR: string }
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
        addressElements?: Array<{ types: string[]; longName: string; shortName: string; code: string }>
      }
      interface ReverseGeocodeOptions {
        coords: LatLng
        orders?: string
      }
      interface ReverseGeocodeResponse {
        v2: {
          results: ReverseGeocodeResult[]
          address: { jibunAddress: string; roadAddress: string }
        }
      }
      interface ReverseGeocodeResult {
        name: string
        code: { id: string; type: string; mappingId: string }
        region: {
          area0: { name: string }
          area1: { name: string }
          area2: { name: string }
          area3: { name: string }
          area4: { name: string }
        }
        land: {
          type: string
          number1: string
          number2: string
          name: string
          addition0: { type: string; value: string }
        }
      }
    }
  }
}

interface Window {
  naver: typeof naver
  __naverMapCallback?: Record<string, (action: string, lat: number, lng: number, address: string) => void>
}
