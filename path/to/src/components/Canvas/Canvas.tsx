"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import {
  Canvas as FabricCanvas,
  FabricImage,
  type FabricObject,
  type Circle,
  type Line,
  Polygon,
  PencilBrush,
  type Path,
  util,
  Point, // We can still import if needed
} from "fabric";
import type { Class } from "~/Types/Class";
import { Button } from "~/components/ui/button";
import { FaTrash } from "react-icons/fa";
import { hexToRgba } from "~/utils/colors";
import { buildCOCOData, validateCOCO } from "~/utils/COCOUtils";
import toast from "react-hot-toast";
import { generateRandomId } from "~/utils/uuid";

interface CanvasProps {
  tool: "brush" | "polygon" | "eraser";
  brushSize: number;
  imageUrl: string | null;
  selectedClass: Class | null;
  classes: Class[];
}

type CanvasState = {
  version: string;
  objects: Array<Record<string, FabricObject>>;
  background: string;
};

type Annotation = {
  type: "polygon" | "path";
  class: Class | null;
  object: FabricObject;
};

const Canvas = forwardRef(
  ({ tool, brushSize, imageUrl, selectedClass, classes }: CanvasProps, ref) => {
    const mainCanvasRef = useRef<FabricCanvas>();
    const maskCanvasRef = useRef<FabricCanvas>();
    const containerRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<CanvasState[]>([]);
    const currentPolygonPoints = useRef<Circle[]>([]);
    const currentPolygonLines = useRef<Line[]>([]);
    const isRestoringState = useRef(false);

    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotationsOnTop, setshowAnnotationsOnTop] = useState(true);
    const [showAnnotations, setShowAnnotations] = useState(false);
    const [imageId, setImageId] = useState<number | null>(null);

    // Save/undo methods ...
    const saveCanvasState = () => { /* ... unchanged ... */ };
    const clearCanvas = () => { /* ... unchanged ... */ };
    const undo = () => { /* ... unchanged ... */ };

    function exportToCOCO() {
      /* ... unchanged ... */
    }

    // Simplified intersection check – bounding box intersection
    // or more thorough shape check
    const intersectsAnyAnnotation = (newObject: FabricObject): boolean => {
      if (!mainCanvasRef.current) return false;
      const objects = mainCanvasRef.current.getObjects();

      // newObject bounding box
      const newRect = newObject.getBoundingRect();
      // Check each existing annotation
      for (const obj of objects) {
        if (obj.type === "circle" || obj.type === "line") continue;

        // Skip if it's the same newly created object or any background image
        if (obj === newObject || obj.type === "image") continue;

        // Compare bounding boxes. If they intersect, we consider it an overlap.
        const objRect = obj.getBoundingRect();

        // "intersectRect" is a Fabric utility
        if (util.intersectRect(newRect, objRect)) {
          return true;
        }
      }
      return false;
    };

    useImperativeHandle(ref, () => ({
      undo,
      exportToCOCO,
      toggleAnnotationsView: () => setShowAnnotations((prev) => !prev),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      mainCanvasRef.current = new FabricCanvas("mainCanvas", {
        width: containerRef.current.clientWidth || 800,
        height: containerRef.current.clientHeight || 600,
        isDrawingMode: false,
      });

      // If you also need mask canvas
      maskCanvasRef.current = new FabricCanvas("maskCanvas", {
        width: containerRef.current.clientWidth || 800,
        height: containerRef.current.clientHeight || 600,
        isDrawingMode: false,
      });

      const canvas = mainCanvasRef.current;

      // Save state after each render
      canvas.on("after:render", () => {
        if (!isRestoringState.current) {
          saveCanvasState();
        }
      });

      // Immediately save initial state
      saveCanvasState();

      return () => {
        canvas.off("after:render");
        void canvas.dispose();
      };
    }, []);

    // Tool handling
    useEffect(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      // Turn off any previous tool event
      canvas.isDrawingMode = false;
      canvas.off("mouse:down");
      canvas.off("path:created");

      // Brush
      if (tool === "brush") {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.color = hexToRgba(selectedClass?.color ?? "#000000", 0.35);

        // When user finishes stroke
        canvas.on("path:created", (e: fabric.IEvent) => {
          const path = e.path as Path;
          if (!path?.path || path.path.length === 0) {
            canvas.remove(path);
            return;
          }

          // Check if it intersects other annotations
          if (intersectsAnyAnnotation(path)) {
            // Remove this path
            canvas.remove(path);
          } else {
            // Otherwise, store it as an annotation
            setAnnotations((prev) => [
              ...prev,
              {
                type: "path",
                class: selectedClass,
                object: path,
              },
            ]);
          }
        });
      }
      // Polygon
      else if (tool === "polygon") {
        canvas.isDrawingMode = false;
        // Attach your polygon logic to "mouse:down"...
      }
      // Eraser
      else if (tool === "eraser") {
        canvas.isDrawingMode = false;
        // ...
      }
    }, [tool, brushSize, selectedClass]);

    // ... e.g. removeAnnotation, etc. remain the same

    return (
      <div className="relative h-full w-full">
        <div
          ref={containerRef}
          className="relative h-full w-full"
          style={{ touchAction: "none" }}
        >
          <canvas id="mainCanvas" />
          <canvas id="maskCanvas" />
        </div>
        {showAnnotations && (
          <div
            style={{
              position: showAnnotationsOnTop ? "absolute" : "absolute",
              top: showAnnotationsOnTop ? 0 : "auto",
              bottom: showAnnotationsOnTop ? "auto" : 0,
              left: 0,
              right: 0,
              backgroundColor: "#f1f1f1",
              height: 100,
              overflowY: "auto",
            }}
          >
            {/* Render annotation list, etc. */}
            {annotations.map((annotation, index) => {
              // ...
            })}
            <Button
              onClick={() => setshowAnnotationsOnTop((prev) => !prev)}
              className="m-2 bg-blue-300 hover:bg-blue-300"
            >
              {showAnnotationsOnTop ? "bottom" : "Top"}
            </Button>
          </div>
        )}
      </div>
    );
  }
);

Canvas.displayName = "Canvas";
export default Canvas; 