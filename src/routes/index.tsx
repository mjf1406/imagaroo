import { Link, createFileRoute } from '@tanstack/react-router'
import { Crop, Eraser, ImageIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-4xl font-bold mb-4">Image Tools</h1>
        <p className="text-muted-foreground text-lg">
          Convert, crop, and remove backgrounds from your images with ease
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ImageIcon className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Convert Images</CardTitle>
            </div>
            <CardDescription>
              Convert images between different formats (JPG, PNG, WEBP). Supports bulk conversion with automatic ZIP download.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/convert">
              <Button className="w-full" size="lg">
                Open Converter
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Crop className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Crop Images</CardTitle>
            </div>
            <CardDescription>
              Automatically crop images by detecting content boundaries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/crop">
              <Button className="w-full" size="lg">
                Open Cropper
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Eraser className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Remove Background</CardTitle>
            </div>
            <CardDescription>
              Automatically remove backgrounds from images by detecting the
              background color and replacing it with transparency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/remove">
              <Button className="w-full" size="lg">
                Remove Background
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
