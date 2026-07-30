declare module 'imagetracerjs' {
  export interface TracerOptions {
    numberofcolors?: number
    ltres?: number
    qtres?: number
    pathomit?: number
    scale?: number
    [key: string]: number | boolean | string | undefined
  }
  interface ImageTracerStatic {
    imagedataToSVG(imagedata: ImageData, options?: TracerOptions): string
    imageToSVG(url: string, callback: (svg: string) => void, options?: TracerOptions): void
  }
  const ImageTracer: ImageTracerStatic
  export default ImageTracer
}
