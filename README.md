# Imagaroo - Image Tools

## Links

1. [Shadcn Project](https://ui.shadcn.com/create?base=radix&style=lyra&baseColor=stone&theme=lime&iconLibrary=lucide&font=figtree&menuAccent=subtle&menuColor=default&radius=small&item=preview)

## Background removal

Remove Background and Transform run segmentation models entirely in your browser:

- **Standard:** [BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4). Source-available for non-commercial use. Commercial use needs a [BRIA license](https://bria.ai/bria-huggingface-model-license-agreement/).
- **Quality:** a browser-ready [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) export (MIT). Shown only when WebGPU and GPU limits look sufficient.

The first run downloads the selected ONNX weights from Hugging Face (about 45 MB for Standard, 115 MB for Quality) and stores them in the browser cache. Inference prefers WebGPU and falls back to quantized WASM. WASM fallback loads ONNX Runtime from jsDelivr (~27 MB, cached by the browser). Image bytes are not uploaded.

## Change Log

### 2026/09/19

- DX: load ONNX Runtime WASM from jsDelivr so Cloudflare Pages is not blocked by the 25 MiB file limit

### 2026/09/17

- FT: replaced solid-color background removal with on-device ML (RMBG-1.4 Standard, BiRefNet Quality)
- UX: models run in the browser via Transformers.js, prefer WebGPU, and fall back to WASM
- UX: Quality is offered only when this device has WebGPU and enough GPU capacity
- UX: first run downloads the selected model from Hugging Face and caches it locally
- UX: images stay on the device; RMBG-1.4 is non-commercial unless you have a BRIA license

### 2026/06/06

- FT: added Poster tool to tile images across printable pages (A4, A3, Letter) with draggable preview, crop marks, page coordinates, and multi-page PDF export

- FT: feature
- UX: user experience
- UI: user interface
- DX: developer experience
- BE: backend
- BUG: bug

### 2026/04/24

- FT: added Spotlight tool to draw rectangles/ellipses, darken or blur outside
  (or inside) the shapes, and export JPG/PNG/WEBP

### 2026/04/28

- FT: added Magnifier tool to create inset zoom frames with connector lines and export JPG/PNG/WEBP
- FT: merged Magnifier into Spotlight (magnifier source joins darken/blur mask); `/magnifier` redirects to `/spotlight`

### 2026/01/13

- UX: user can now select the background color when converting to JPG
- BE: added flood fill algorithm to remove bg to prevent the bg color from being replaced with transparency within the content of the image
- BUG: copper preview no longer fails to show the correct preview with tolerances of 4 or smaller
- BE: added debouncer to remove bg preview
- UX: combined crop and remove bg pages into one new page, Transform
- FT: added remove bg feature
- UX: added theme switcher
- UI: added navbar
- UI: added logo
- DX: componentized the convert image page
