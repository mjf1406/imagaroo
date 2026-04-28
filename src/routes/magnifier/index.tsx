import { useCallback, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import type { ImageFile } from '@/components/ImagePreview'
import type { MagnifierFrame } from '@/lib/image-magnifier'

import { MagnifierActions } from './-components/MagnifierActions'
import { MagnifierCanvas } from './-components/MagnifierCanvas'
import { MagnifierControls } from './-components/MagnifierControls'
import { MagnifierPageHeader } from './-components/MagnifierPageHeader'
import type { MagnifierOutputFormat, MagnifierSelection } from './-components/MagnifierControls'

export const Route = createFileRoute('/magnifier/')({
  component: MagnifierImagePage,
})

function framesEqual(a: MagnifierFrame | null, b: MagnifierFrame | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function MagnifierImagePage() {
  const [image, setImage] = useState<ImageFile | null>(null)
  const [frame, setFrame] = useState<MagnifierFrame | null>(null)
  const [past, setPast] = useState<Array<MagnifierFrame | null>>([])
  const pendingHistoryRef = useRef<MagnifierFrame | null>(null)

  const [selectedTarget, setSelectedTarget] = useState<MagnifierSelection | null>(
    'source',
  )

  const [outputFormat, setOutputFormat] = useState<MagnifierOutputFormat>('webp')
  const [jpgBackgroundColor, setJpgBackgroundColor] = useState('#ffffff')

  const onInteractionStart = useCallback(() => {
    pendingHistoryRef.current = structuredClone(frame)
  }, [frame])

  const onInteractionEnd = useCallback((finalFrame: MagnifierFrame | null) => {
    const before = pendingHistoryRef.current
    pendingHistoryRef.current = null
    if (!framesEqual(before, finalFrame)) {
      setPast((p) => [...p, before ?? null])
    }
  }, [])

  const handleImageFromFile = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random()}`
    const preview = URL.createObjectURL(file)
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { id, file, preview, outputFormat: null }
    })
    setFrame(null)
    setPast([])
  }, [])

  const handleClearFrame = useCallback(() => {
    setPast((p) => [...p, structuredClone(frame)])
    setFrame(null)
    setSelectedTarget(null)
  }, [frame])

  const handleClearAll = useCallback(() => {
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
    setFrame(null)
    setPast([])
  }, [])

  const handleUndo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1] ?? null
      setFrame(prev)
      return p.slice(0, -1)
    })
  }, [])

  const patchFrame = useCallback(
    (patch: Partial<MagnifierFrame>) => {
      setFrame((prev) => {
        if (!prev) return prev
        return { ...prev, ...patch }
      })
    },
    [setFrame],
  )

  const patchSourceOutline = useCallback((patch: Partial<MagnifierFrame['sourceOutline']>) => {
    setFrame((prev) => {
      if (!prev) return prev
      return { ...prev, sourceOutline: { ...prev.sourceOutline, ...patch } }
    })
  }, [])

  const patchInsetOutline = useCallback((patch: Partial<MagnifierFrame['insetOutline']>) => {
    setFrame((prev) => {
      if (!prev) return prev
      return { ...prev, insetOutline: { ...prev.insetOutline, ...patch } }
    })
  }, [])

  const patchConnector = useCallback((patch: Partial<MagnifierFrame['connector']>) => {
    setFrame((prev) => {
      if (!prev) return prev
      return { ...prev, connector: { ...prev.connector, ...patch } }
    })
  }, [])

  const setInsetBackgroundColor = useCallback((v: string) => {
    setFrame((prev) => {
      if (!prev) return prev
      return { ...prev, insetBackgroundColor: v }
    })
  }, [])

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <MagnifierPageHeader />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <MagnifierCanvas
            image={image}
            frame={frame}
            selectedTarget={frame ? selectedTarget : null}
            onFrameChange={setFrame}
            onSelectedTargetChange={setSelectedTarget}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
            onImageReplace={handleImageFromFile}
          />
        </div>
        <div className="md:w-80 md:shrink-0 space-y-4">
          <MagnifierControls
            frame={frame}
            editing={selectedTarget ?? 'source'}
            onEditingChange={(v) => setSelectedTarget(v)}
            outputFormat={outputFormat}
            onOutputFormatChange={setOutputFormat}
            jpgBackgroundColor={jpgBackgroundColor}
            onJpgBackgroundColorChange={setJpgBackgroundColor}
            onFramePatch={patchFrame}
            onSourceOutlinePatch={patchSourceOutline}
            onInsetOutlinePatch={patchInsetOutline}
            onConnectorPatch={patchConnector}
            onInsetBackgroundColorChange={setInsetBackgroundColor}
          />
          <MagnifierActions
            image={image}
            frame={frame}
            outputFormat={outputFormat}
            jpgBackgroundColor={jpgBackgroundColor}
            canUndo={past.length > 0}
            onUndo={handleUndo}
            onClearFrame={handleClearFrame}
            onClearAll={handleClearAll}
          />
        </div>
      </div>
    </div>
  )
}

