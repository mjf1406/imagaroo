import { useCallback, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { SpotlightActions } from './-components/SpotlightActions'
import { SpotlightCanvas } from './-components/SpotlightCanvas'
import { SpotlightControls } from './-components/SpotlightControls'
import { SpotlightPageHeader } from './-components/SpotlightPageHeader'
import type { SpotlightTool } from './-components/SpotlightCanvas'
import type { SpotlightOutputFormat } from './-components/SpotlightControls'

import type { ImageFile } from '@/components/ImagePreview'
import type {
  SpotlightEffect,
  SpotlightFocusArea,
  SpotlightShape,
  SpotlightShapeFillStyle,
  SpotlightShapeOutlineStyle,
} from '@/lib/image-spotlight'
import {
  clampSpotlightFillOpacityPct,
  clampSpotlightOutlineWidthPx,
} from '@/lib/image-spotlight'

export const Route = createFileRoute('/spotlight/')({
  component: SpotlightImagePage,
})

function shapeListsEqual(
  a: Array<SpotlightShape>,
  b: Array<SpotlightShape>,
): boolean {
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function SpotlightImagePage() {
  const [image, setImage] = useState<ImageFile | null>(null)
  const [shapes, setShapes] = useState<Array<SpotlightShape>>([])
  const [past, setPast] = useState<Array<Array<SpotlightShape>>>([])
  const pendingHistoryRef = useRef<Array<SpotlightShape> | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<SpotlightTool>('rect')
  const [effect, setEffect] = useState<SpotlightEffect>('darken')
  const [darkenStrength, setDarkenStrength] = useState(60)
  const [blurStrength, setBlurStrength] = useState(12)
  const [focusArea, setFocusArea] = useState<SpotlightFocusArea>('inside')
  const [outputFormat, setOutputFormat] =
    useState<SpotlightOutputFormat>('webp')
  const [jpgBackgroundColor, setJpgBackgroundColor] = useState('#ffffff')
  const [attachOutlineToNewShapes, setAttachOutlineToNewShapes] =
    useState(false)
  const [defaultOutlineColor, setDefaultOutlineColor] = useState('#000000')
  const [defaultOutlineWidthPx, setDefaultOutlineWidthPx] = useState(3)
  const [attachFillToNewShapes, setAttachFillToNewShapes] = useState(false)
  const [defaultFillColor, setDefaultFillColor] = useState('#2563eb')
  const [defaultFillOpacityPct, setDefaultFillOpacityPct] = useState(30)

  const addOutlineToShape = useCallback(
    (shapeId: string) => {
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== shapeId) return s
          if (s.outline) return s
          return {
            ...s,
            outline: {
              color: defaultOutlineColor,
              widthPx: clampSpotlightOutlineWidthPx(defaultOutlineWidthPx),
            },
          }
        }),
      )
    },
    [defaultOutlineColor, defaultOutlineWidthPx],
  )

  const removeOutlineFromShape = useCallback((shapeId: string) => {
    setShapes((prev) =>
      prev.map((s) =>
        s.id === shapeId ? { ...s, outline: undefined } : s,
      ),
    )
  }, [])

  const patchShapeOutline = useCallback(
    (shapeId: string, patch: Partial<SpotlightShapeOutlineStyle>) => {
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== shapeId) return s
          const w = clampSpotlightOutlineWidthPx(defaultOutlineWidthPx)
          const base: SpotlightShapeOutlineStyle = s.outline ?? {
            color: defaultOutlineColor,
            widthPx: w,
          }
          const next: SpotlightShapeOutlineStyle = {
            ...base,
            ...patch,
            widthPx:
              patch.widthPx !== undefined
                ? clampSpotlightOutlineWidthPx(patch.widthPx)
                : base.widthPx,
          }
          return { ...s, outline: next }
        }),
      )
    },
    [defaultOutlineColor, defaultOutlineWidthPx],
  )

  const addFillToShape = useCallback(
    (shapeId: string) => {
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== shapeId) return s
          if (s.fill) return s
          return {
            ...s,
            fill: {
              color: defaultFillColor,
              opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
            },
          }
        }),
      )
    },
    [defaultFillColor, defaultFillOpacityPct],
  )

  const removeFillFromShape = useCallback((shapeId: string) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === shapeId ? { ...s, fill: undefined } : s)),
    )
  }, [])

  const patchShapeFill = useCallback(
    (shapeId: string, patch: Partial<SpotlightShapeFillStyle>) => {
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== shapeId) return s
          const base: SpotlightShapeFillStyle = s.fill ?? {
            color: defaultFillColor,
            opacityPct: clampSpotlightFillOpacityPct(defaultFillOpacityPct),
          }
          const next: SpotlightShapeFillStyle = {
            ...base,
            ...patch,
            opacityPct:
              patch.opacityPct !== undefined
                ? clampSpotlightFillOpacityPct(patch.opacityPct)
                : base.opacityPct,
          }
          return { ...s, fill: next }
        }),
      )
    },
    [defaultFillColor, defaultFillOpacityPct],
  )

  const resetStrength = useCallback(() => {
    if (effect === 'darken') {
      setDarkenStrength(60)
    } else {
      setBlurStrength(12)
    }
  }, [effect])

  const onInteractionStart = useCallback(() => {
    pendingHistoryRef.current = structuredClone(shapes)
  }, [shapes])

  const onInteractionEnd = useCallback((finalShapes: Array<SpotlightShape>) => {
    const before = pendingHistoryRef.current
    pendingHistoryRef.current = null
    if (before === null) return
    if (!shapeListsEqual(before, finalShapes)) {
      setPast((p) => [...p, before])
    }
  }, [])

  const handleImageFromFile = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random()}`
    const preview = URL.createObjectURL(file)
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { id, file, preview, outputFormat: null }
    })
    setShapes([])
    setPast([])
    setSelectedId(null)
  }, [])

  const handleClearShapes = useCallback(() => {
    setShapes([])
    setPast([])
    setSelectedId(null)
  }, [])

  const handleClearAll = useCallback(() => {
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
    setShapes([])
    setPast([])
    setSelectedId(null)
  }, [])

  const handleUndo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setShapes(prev)
      setSelectedId(null)
      return p.slice(0, -1)
    })
  }, [])

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <SpotlightPageHeader />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <SpotlightCanvas
            image={image}
            shapes={shapes}
            selectedId={selectedId}
            tool={tool}
            effect={effect}
            darkenStrength={darkenStrength}
            blurStrength={blurStrength}
            focusArea={focusArea}
            attachOutlineToNewShapes={attachOutlineToNewShapes}
            defaultOutlineColor={defaultOutlineColor}
            defaultOutlineWidthPx={defaultOutlineWidthPx}
            attachFillToNewShapes={attachFillToNewShapes}
            defaultFillColor={defaultFillColor}
            defaultFillOpacityPct={defaultFillOpacityPct}
            onShapesChange={setShapes}
            onSelectedIdChange={setSelectedId}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
            onImageReplace={handleImageFromFile}
          />
        </div>
        <div className="md:w-80 md:shrink-0 space-y-4">
          <SpotlightControls
            tool={tool}
            onToolChange={setTool}
            effect={effect}
            onEffectChange={setEffect}
            darkenStrength={darkenStrength}
            onDarkenStrengthChange={setDarkenStrength}
            blurStrength={blurStrength}
            onBlurStrengthChange={setBlurStrength}
            focusArea={focusArea}
            onFocusAreaChange={setFocusArea}
            outputFormat={outputFormat}
            onOutputFormatChange={setOutputFormat}
            jpgBackgroundColor={jpgBackgroundColor}
            onJpgBackgroundColorChange={setJpgBackgroundColor}
            shapes={shapes}
            selectedId={selectedId}
            attachOutlineToNewShapes={attachOutlineToNewShapes}
            onAttachOutlineToNewShapesChange={setAttachOutlineToNewShapes}
            defaultOutlineColor={defaultOutlineColor}
            onDefaultOutlineColorChange={setDefaultOutlineColor}
            defaultOutlineWidthPx={defaultOutlineWidthPx}
            onDefaultOutlineWidthChange={setDefaultOutlineWidthPx}
            onShapeOutlinePatch={patchShapeOutline}
            onAddOutlineToShape={addOutlineToShape}
            onRemoveOutlineFromShape={removeOutlineFromShape}
            attachFillToNewShapes={attachFillToNewShapes}
            onAttachFillToNewShapesChange={setAttachFillToNewShapes}
            defaultFillColor={defaultFillColor}
            onDefaultFillColorChange={setDefaultFillColor}
            defaultFillOpacityPct={defaultFillOpacityPct}
            onDefaultFillOpacityPctChange={setDefaultFillOpacityPct}
            onShapeFillPatch={patchShapeFill}
            onAddFillToShape={addFillToShape}
            onRemoveFillFromShape={removeFillFromShape}
            onStrengthReset={resetStrength}
          />
          <SpotlightActions
            image={image}
            shapes={shapes}
            effect={effect}
            darkenStrength={darkenStrength}
            blurStrength={blurStrength}
            focusArea={focusArea}
            outputFormat={outputFormat}
            jpgBackgroundColor={jpgBackgroundColor}
            canUndo={past.length > 0}
            onUndo={handleUndo}
            onClearShapes={handleClearShapes}
            onClearAll={handleClearAll}
          />
        </div>
      </div>
    </div>
  )
}
