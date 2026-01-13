# Imagaroo - Image Tools

## Links

1. [Shadcn Project](https://ui.shadcn.com/create?base=radix&style=lyra&baseColor=stone&theme=lime&iconLibrary=lucide&font=figtree&menuAccent=subtle&menuColor=default&radius=small&item=preview)

## Change Log

- FT: feature
- UX: user experience
- UI: user interface
- DX: developer experience
- BE: backend
- BUG: bug

### 2026/01/13

- UX: user can now select the background color when converting to JPG
- BE: added flood fill algorithm to remove bg to prevent the bg color from being replaced with transparency within the content of the image
- BUG: copper preview no longer fails to show the correct preview with tolerances of 4 or smaller
- BE: added debouncer to remove bg preview
- UX: combined crop and remove bg pages into one new page, Transform
- FT: added remove bg feature
- UX: added theme switcher
- UI: added navbar
- UI: added logo
- DX: componentized the convert image page
