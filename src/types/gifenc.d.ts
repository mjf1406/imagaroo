declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Array<Array<number>>
        delay?: number
        first?: boolean
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
  }

  export function quantize(
    data: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: Record<string, unknown>,
  ): Array<Array<number>>

  export function applyPalette(
    data: Uint8ClampedArray | Uint8Array,
    palette: Array<Array<number>>,
    format?: string,
  ): Uint8Array
}
