export function BackgroundRemovalAttribution() {
  return (
    <p className="text-xs text-muted-foreground">
      Standard uses{' '}
      <a
        className="underline underline-offset-4"
        href="https://huggingface.co/briaai/RMBG-1.4"
        target="_blank"
        rel="noreferrer"
      >
        BRIA RMBG-1.4
      </a>
      , which is source-available for non-commercial use.{' '}
      <a
        className="underline underline-offset-4"
        href="https://bria.ai/bria-huggingface-model-license-agreement/"
        target="_blank"
        rel="noreferrer"
      >
        Commercial use needs a BRIA license
      </a>
      . Quality uses{' '}
      <a
        className="underline underline-offset-4"
        href="https://github.com/ZhengPeng7/BiRefNet"
        target="_blank"
        rel="noreferrer"
      >
        BiRefNet
      </a>{' '}
      (MIT).
    </p>
  )
}
