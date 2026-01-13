import { Link } from '@tanstack/react-router'
import { ImageIcon, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeSwitch } from '@/components/themes/theme-switch'

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full max-w-7xl mx-auto border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center justify-between px-4 py-2">
      {/* Logo and Text - Left */}
      <Link
        to="/"
        className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity"
      >
        <img
          src="/brand/imagaroo-logo-removebg.webp"
          alt="Imagaroo Logo"
          className="h-12 w-auto"
        />
        <img
          src="/brand/imagaroo-text-2.webp"
          alt="Imagaroo"
          className="h-12 w-auto hidden sm:block"
        />
      </Link>

      {/* Tools - Middle */}
      <div className="flex items-center gap-1">
        <Link
          to="/convert"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-muted hover:text-foreground',
            'text-muted-foreground',
          )}
          activeProps={{
            className: cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'border-b-4 border-primary hover:bg-muted hover:text-foreground',
              'text-foreground',
            ),
          }}
        >
          <ImageIcon className="size-4" />
          <span className="hidden sm:inline">Convert</span>
          <span className="sm:hidden">Convert</span>
        </Link>

        <Link
          to="/transform"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-muted hover:text-foreground',
            'text-muted-foreground',
          )}
          activeProps={{
            className: cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'border-b-4 border-primary hover:bg-muted hover:text-foreground',
              'text-foreground',
            ),
          }}
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Transform</span>
          <span className="sm:hidden">Transform</span>
        </Link>
      </div>

      {/* Theme Switcher - Right */}
      <div className="flex items-center">
        <ThemeSwitch />
      </div>
    </nav>
  )
}
