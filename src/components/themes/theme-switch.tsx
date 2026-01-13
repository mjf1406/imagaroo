/** @format */

'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/themes/theme-provider'

import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Map theme to our theme options
  // If theme is "system", resolve it to light or dark
  const currentTheme = React.useMemo(() => {
    if (!mounted) return 'light'
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      return systemTheme
    }
    return theme
  }, [theme, mounted])

  const handleThemeChange = React.useCallback(
    (value: string) => {
      setTheme(value as 'light' | 'dark' | 'system')
    },
    [setTheme],
  )

  if (!mounted) {
    return (
      <div className="inline-flex items-center rounded-md border border-input bg-background p-1">
        <div className="h-8 w-8" />
      </div>
    )
  }

  return (
    <RadioGroup
      value={currentTheme}
      onValueChange={handleThemeChange}
      className="inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-sm"
      aria-label="Theme selection"
      role="radiogroup"
    >
      <label
        htmlFor="theme-light"
        className={cn(
          'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
          'data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground',
          currentTheme === 'light' &&
            'bg-accent text-accent-foreground shadow-sm',
        )}
      >
        <RadioGroupItem
          value="light"
          id="theme-light"
          className="sr-only absolute"
        />
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Light theme</span>
      </label>
      <label
        htmlFor="theme-dark"
        className={cn(
          'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
          'data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground',
          currentTheme === 'dark' &&
            'bg-accent text-accent-foreground shadow-sm',
        )}
      >
        <RadioGroupItem
          value="dark"
          id="theme-dark"
          className="sr-only absolute"
        />
        <Moon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Dark theme</span>
      </label>
    </RadioGroup>
  )
}
