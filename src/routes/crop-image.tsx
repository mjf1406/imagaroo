import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/crop-image')({
  component: CropImagePage,
})

function CropImagePage() {
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Crop Images</h1>
        <p className="text-muted-foreground">
          Crop and resize your images
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The crop image feature is under development and will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
