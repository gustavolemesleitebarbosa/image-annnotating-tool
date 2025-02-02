# Image Annotator Tool

A React-based web application for annotating images with support for brush and polygon tools. The tool exports annotations in COCO format and features a customizable class system.

## Features

- 🎨 Multiple annotation tools:
  - Brush tool for freeform annotation
  - Polygon tool for precise boundary marking
- 🎯 Class-based annotation system with customizable colors
- ↩️ Undo functionality
- 💾 COCO format export
- 👁️ Toggle annotation visibility
- 📊 Annotation management interface
- 🖼️ Support for various image formats
- 💫 Collision detection between annotations

## Setup Instructions

1. **Prerequisites**
   - Node.js (higher than 18, recommended version 18.18.2 can get it via nvm)
   - npm or yarn, but preferably pnpm [Why use pnpm](https://pnpm.io/pnpm-vs-npm)

2. **Setup Steps**
   - Clone the [Repo](https://github.com/gustavolemesleitebarbosa/overview-ai-challenge) into your local machine
   - Make sure to be using a supported node version on your terminal
   - Run `pnpm install` (or yarn/npm equivalent) to install deps locally
   - run `pnpm dev`
   - Go to to your browser, the app should be accessible on http://localhost:3000


## App dependencies (third party libs)

   ```json
   {
     "dependencies": {
       "fabric": "^5.0.0",
       "react": "^18.0.0",
       "react-hot-toast": "^2.0.0",
       "react-icons": "^4.0.0",
       "@/components/ui": "^1.0.0"
     }
   }
   ```

## App folder structure

   Place the following components in your project structure:
   ```
   components/
   ├── Canvas/
   │   └── Canvas.tsx
   ├── ColorPicker/
   │   └── ColorPicker.tsx
   ├── ClassPicker/
   │   └── ClassPicker.tsx
   └── ui/
       ├── button.tsx
       ├── dialog.tsx
       └── input.tsx
   ```

## Usage



## Features Guide

### 1. Class Management

Classes represent different annotation categories. Each class has:
- Unique name
- Distinctive color
- Generated ID

Default classes include common objects like "Car", "Tree", "Road", etc. New classes can be added through the UI.

### 2. Annotation Tools

#### Brush Tool
- Freeform drawing
- Adjustable brush size
- Semi-transparent fill
- Collision detection

#### Polygon Tool
- Click to place points
- Auto-closes when near starting point
- Collision detection
- Clear visual feedback

### 3. COCO Export

Exports annotations in COCO format with:
- Image information
- Category definitions
- Segmentation data
- Bounding boxes
- Area calculations

### 4. Canvas Controls

Available methods through the canvas ref:
```typescript
{
  undo: () => void;
  exportToCOCO: () => void;
  toggleAnnotationsView: () => void;
}
```

## Best Practices

1. **Performance**
   - Limit canvas size to viewport dimensions
   - Use appropriate brush sizes
   - Manage state updates efficiently

2. **Annotation Guidelines**
   - Avoid overlapping annotations
   - Complete polygons before switching tools
   - Use appropriate tool for the task

3. **Data Management**
   - Regular exports
   - Validate COCO format before saving
   - Monitor annotation count

## Troubleshooting

Common issues and solutions:

1. **Collision Detection**
   - Red highlight indicates overlap
   - Annotation is automatically removed
   - Try repositioning or using smaller brush size

2. **Polygon Tool**
   - Ensure points are placed accurately
   - Click near starting point to close
   - Use undo for mistakes

3. **Export Issues**
   - Verify all annotations are complete
   - Check class assignments
   - Ensure image is loaded properly

## Technical Details

### State Management
- Uses React's useState for UI state
- Fabric.js canvas state management
- History tracking for undo functionality

### Event Handling
- Mouse events for polygon creation
- Path creation events for brush tool
- Canvas rendering events

### Data Structure
```typescript
type Annotation = {
  type: "path" | "polygon";
  class: Class;
  object: FabricObject;
};
```

### COCO Format Structure
```typescript
interface COCOData {
  images: Array<{
    id: number;
    width: number;
    height: number;
  }>;
  annotations: Array<{
    id: number;
    image_id: number;
    category_id: number;
    segmentation: number[][];
    area: number;
    bbox: number[];
  }>;
  categories: Array<{
    id: number;
    name: string;
    supercategory: string;
  }>;
}
```

### Basic Implementation

```tsx
import Canvas from '~/components/Canvas/Canvas';

function AnnotationApp() {
  return (
    <Canvas
      tool={selectedTool}
      brushSize={10}
      imageUrl={imageUrl}
      selectedClass={selectedClass}
      classes={classes}
    />
  );
}
```

### Props Interface

```typescript
interface CanvasProps {
  tool: "brush" | "polygon" | null;
  brushSize: number;
  imageUrl: string | null;
  selectedClass: Class | null;
  classes: Class[];
}

interface Class {
  id: string;
  name: string;
  color: string;
}
```