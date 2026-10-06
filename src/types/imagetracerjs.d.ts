// imagetracerjs ships no types; only the two calls the vectorizer uses.
declare module 'imagetracerjs' {
  interface TraceData {
    width: number
    height: number
    palette: { r: number; g: number; b: number; a: number }[]
    layers: {
      isholepath: boolean
      // [minX, minY, maxX, maxY] in pixels
      boundingbox: [number, number, number, number]
    }[][]
  }
  interface ImageLike {
    width: number
    height: number
    data: Uint8ClampedArray
  }
  const ImageTracer: {
    imagedataToTracedata(img: ImageLike, options: object): TraceData
    getsvgstring(data: TraceData, options: object): string
  }
  export default ImageTracer
}
