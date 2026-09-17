export function RemoveImagePageHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-2">Remove Background</h1>
      <p className="text-muted-foreground">
        Remove backgrounds in your browser with on-device models. Standard
        (RMBG-1.4) works on most devices. Quality (BiRefNet) is selected when
        this device has WebGPU and enough GPU capacity. The first run downloads
        the selected model, then uses WebGPU when it can and WASM otherwise.
      </p>
    </div>
  )
}
