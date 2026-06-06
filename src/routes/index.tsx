import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Eraser,
  ImageIcon,
  LayoutGrid,
  Lightbulb,
  Minimize2,
  Scissors,
  Sparkles,
} from 'lucide-react'

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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-4xl font-bold mb-4">Image Tools</h1>
        <p className="text-muted-foreground text-lg">
          Convert and transform your images with ease
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ImageIcon className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Convert</CardTitle>
            </div>
            <CardDescription>
              Convert images between different formats (JPG, PNG, WEBP).
              Supports bulk conversion with automatic ZIP download.
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
                <Scissors className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Crop</CardTitle>
            </div>
            <CardDescription>
              Automatically crop images by detecting content boundaries, or
              manually draw a crop region on a single image.
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
              Automatically remove backgrounds from images. Works best with
              images that have a single solid background.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/remove">
              <Button className="w-full" size="lg">
                Open Remover
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Minimize2 className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Reduce</CardTitle>
            </div>
            <CardDescription>
              Resize images to reduce file size and resolution. Adjust
              dimensions while maintaining aspect ratio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/reduce">
              <Button className="w-full" size="lg">
                Open Reducer
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Lightbulb className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Spotlight</CardTitle>
            </div>
            <CardDescription>
              Draw rectangles or ellipses, add an optional magnifier inset zoom,
              and darken or blur the rest of the image.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/spotlight">
              <Button className="w-full" size="lg">
                Open Spotlight
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sparkles className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Transform</CardTitle>
            </div>
            <CardDescription>
              Crop, remove backgrounds, and reduce images all at once. Switch
              between modes with a single toggle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/transform">
              <Button className="w-full" size="lg">
                Open Transformer
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <LayoutGrid className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Poster</CardTitle>
            </div>
            <CardDescription>
              Split an image across multiple pages to print and assemble into a
              poster. Supports A4, A3, and Letter with PDF output.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/poster">
              <Button className="w-full" size="lg">
                Open Poster
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
