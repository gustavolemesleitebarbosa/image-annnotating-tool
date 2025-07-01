# Image Annotator Tool

A React-based web application for annotating images with support for brush and polygon tools. The tool exports annotations in COCO format and features a customizable class system.

[Demo Video](https://youtu.be/K0r6AQVgHpM)

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

#### Polygon Tool

- Click to place points
- Auto-closes when near starting point
- Clear visual feedback

### 3. COCO Export

Exports annotations in COCO format with:

- Image information
- Category definitions
- Segmentation data
- Bounding boxes
- Area calculations

### 4. Basic Usage and Tools

# Annotation Tool Documentation

## Getting Started

To begin using the annotation tool:

- Click the **Upload Image** button in the sidebar to add a new image.
- Once uploaded, you can start adding annotations.

## Class Management

  - To annotate with specific classes, choose a predefined class from the **Select a Class** drop-down menu.
  - Alternatively, create a custom class by clicking the **Add Class** button.
  - Custom classes are stored in your browser's local storage, so they persist across sessions.
  - When creating a new class, ensure that the name and color are unique.

## Annotation Tools 

  - Select either the **Brush** or **Polygon** tool from the sidebar to start annotating.
  - Once selected, you can begin adding annotations to the canvas.

### Undo Feature

  - The **Undo** button allows you to revert the last annotation action:
  - For polygons, it can undo the last added point or remove the entire shape.
  - For the brush tool, it removes the last drawn stroke.
  - Multiple undo actions can be performed sequentially.

## Annotation Control & COCO Export

  - Click the **Toggle Annotations** button to display the list of annotations.
  - The annotation list can be positioned at the **top** or **bottom** of the window for better accessibility.
  - Clicking an annotation in the list removes it from the canvas.
  - To export annotations in **COCO format**, click the **Export COCO** button. This generates a JSON file containing the annotations.

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

1. **Polygon Tool**

   - Ensure points are placed accurately
   - Click near starting point to close
   - Use undo for mistakes

2. **Export Issues**
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
import Canvas from "~/components/Canvas/Canvas";

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

## Notes

- The annotation tool is designed to enhance efficiency while ensuring accurate annotations.
- Future improvements may refine collision detection and introduce additional functionalities based on user feedback.
