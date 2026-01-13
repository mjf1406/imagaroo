export function RemoveImagePageHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-2">Remove Background</h1>
      <p className="text-muted-foreground">
        Automatically remove backgrounds from images.{' '}
        <span className="font-bold">
          Works best with images that have a single solid background.
        </span>
      </p>
    </div>
  )
}
