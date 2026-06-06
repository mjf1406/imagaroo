import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { PosterActions } from './-components/PosterActions'
import { PosterCanvas } from './-components/PosterCanvas'
import { PosterControls } from './-components/PosterControls'
import { PosterPageHeader } from './-components/PosterPageHeader'

import type { ImageFile } from '@/components/ImagePreview'
import type {
  LengthUnit,
  Orientation,
  PaperSize,
  PosterSettings,
  PrimaryAxis,
} from '@/lib/image-poster'
import {
  clampOffsetMm,
  computePosterLayout,
  computeSheetsForAxis,
  optimumSheetsForPrintDpi,
} from '@/lib/image-poster'

export const Route = createFileRoute('/poster/')({
  component: PosterPage,
})

function PosterPage() {
  const [image, setImage] = useState<ImageFile | null>(null)
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null)

  const [paperSize, setPaperSize] = useState<PaperSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [marginMm, setMarginMm] = useState(10)
  const [overlapMm, setOverlapMm] = useState(5)
  const [unit, setUnit] = useState<LengthUnit>('mm')
  const [primaryAxis, setPrimaryAxis] = useState<PrimaryAxis>('wide')
  const [sheetsWide, setSheetsWide] = useState(2)
  const [sheetsTall, setSheetsTall] = useState(2)
  const [offsetMm, setOffsetMm] = useState(0)
  const [showCropMarks, setShowCropMarks] = useState(true)
  const [showPageCoords, setShowPageCoords] = useState(true)

  useEffect(() => {
    if (!image) {
      setLoadedImg(null)
      return
    }
    const img = new Image()
    img.onload = () => setLoadedImg(img)
    img.onerror = () => setLoadedImg(null)
    img.src = image.preview
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [image])

  const layout = useMemo(() => {
    if (!loadedImg || loadedImg.naturalWidth === 0) return null
    const settings: PosterSettings = {
      paperSize,
      orientation,
      marginMm,
      overlapMm,
      primaryAxis,
      sheetsWide,
      sheetsTall,
      offsetMm,
      showCropMarks,
      showPageCoords,
    }
    return computePosterLayout(
      loadedImg.naturalWidth,
      loadedImg.naturalHeight,
      settings,
    )
  }, [
    loadedImg,
    paperSize,
    orientation,
    marginMm,
    overlapMm,
    primaryAxis,
    sheetsWide,
    sheetsTall,
    offsetMm,
    showCropMarks,
    showPageCoords,
  ])

  useEffect(() => {
    if (!layout) return
    setOffsetMm((prev) => clampOffsetMm(prev, layout.slackMm))
  }, [layout?.slackMm])

  const settings: PosterSettings = useMemo(
    () => ({
      paperSize,
      orientation,
      marginMm,
      overlapMm,
      primaryAxis,
      sheetsWide: layout?.sheetsWide ?? sheetsWide,
      sheetsTall: layout?.sheetsTall ?? sheetsTall,
      offsetMm: layout
        ? clampOffsetMm(offsetMm, layout.slackMm)
        : offsetMm,
      showCropMarks,
      showPageCoords,
    }),
    [
      paperSize,
      orientation,
      marginMm,
      overlapMm,
      primaryAxis,
      sheetsWide,
      sheetsTall,
      offsetMm,
      layout,
      showCropMarks,
      showPageCoords,
    ],
  )

  const handleImageFromFile = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random()}`
    const preview = URL.createObjectURL(file)
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { id, file, preview, outputFormat: null }
    })
    setOffsetMm(0)
    setPrimaryAxis('wide')
    setSheetsWide(2)
    setSheetsTall(2)
  }, [])

  const handleSheetsWideChange = useCallback(
    (v: number) => {
      if (!loadedImg) return
      setPrimaryAxis('wide')
      setSheetsWide(v)
      const derived = computeSheetsForAxis(
        v,
        'wide',
        loadedImg.naturalWidth,
        loadedImg.naturalHeight,
        paperSize,
        orientation,
        marginMm,
        overlapMm,
      )
      setSheetsTall(derived.sheetsTall)
      setOffsetMm(0)
    },
    [loadedImg, paperSize, orientation, marginMm, overlapMm],
  )

  const handleSheetsTallChange = useCallback(
    (v: number) => {
      if (!loadedImg) return
      setPrimaryAxis('tall')
      setSheetsTall(v)
      const derived = computeSheetsForAxis(
        v,
        'tall',
        loadedImg.naturalWidth,
        loadedImg.naturalHeight,
        paperSize,
        orientation,
        marginMm,
        overlapMm,
      )
      setSheetsWide(derived.sheetsWide)
      setOffsetMm(0)
    },
    [loadedImg, paperSize, orientation, marginMm, overlapMm],
  )

  const handleOptimum = useCallback(() => {
    if (!loadedImg) return
    const result = optimumSheetsForPrintDpi(
      loadedImg.naturalWidth,
      loadedImg.naturalHeight,
      paperSize,
      orientation,
      marginMm,
      overlapMm,
    )
    setPrimaryAxis(result.primaryAxis)
    setSheetsWide(result.sheetsWide)
    setSheetsTall(result.sheetsTall)
    setOffsetMm(0)
  }, [loadedImg, paperSize, orientation, marginMm, overlapMm])

  const handleClear = useCallback(() => {
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
    setLoadedImg(null)
    setOffsetMm(0)
  }, [])

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <PosterPageHeader />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <PosterCanvas
            image={image}
            loadedImg={loadedImg}
            layout={layout}
            primaryAxis={primaryAxis}
            offsetMm={offsetMm}
            onOffsetChange={setOffsetMm}
            showCropMarks={showCropMarks}
            showPageCoords={showPageCoords}
            onImageReplace={handleImageFromFile}
          />
        </div>
        <div className="md:w-80 md:shrink-0 space-y-4">
          <PosterControls
            paperSize={paperSize}
            onPaperSizeChange={setPaperSize}
            orientation={orientation}
            onOrientationChange={setOrientation}
            marginMm={marginMm}
            onMarginMmChange={setMarginMm}
            overlapMm={overlapMm}
            onOverlapMmChange={setOverlapMm}
            unit={unit}
            onUnitChange={setUnit}
            primaryAxis={primaryAxis}
            sheetsWide={sheetsWide}
            sheetsTall={sheetsTall}
            onSheetsWideChange={handleSheetsWideChange}
            onSheetsTallChange={handleSheetsTallChange}
            layout={layout}
            showCropMarks={showCropMarks}
            onShowCropMarksChange={setShowCropMarks}
            showPageCoords={showPageCoords}
            onShowPageCoordsChange={setShowPageCoords}
            onOptimum={handleOptimum}
            hasImage={!!loadedImg}
          />
          <PosterActions
            image={image}
            settings={settings}
            onClear={handleClear}
          />
        </div>
      </div>
    </div>
  )
}
