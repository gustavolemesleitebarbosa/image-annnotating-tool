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
  Circle,
  Line,
  Polygon,
  PencilBrush,
  util,
} from "fabric";
import type { Class } from "~/Types/Class";
import { Button } from "~/components/ui/button";
import { FaTrash, X, safa } from "react-icons/fa";
import { hexToRgba } from "~/utils/colors";

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
};

const Canvas = forwardRef(
  ({ tool, brushSize, imageUrl, selectedClass, classes }: CanvasProps, ref) => {
    const mainCanvasRef = useRef<FabricCanvas>();
    const maskCanvasRef = useRef<FabricCanvas>();
    const containerRef = useRef<HTMLDivElement>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotationsOnTop, setshowAnnotationsOnTop] = useState(false);
    const [showAnnotations, setShowAnnotations] = useState(false);
    const historyRef = useRef<CanvasState[]>([]);
    const currentPolygonPoints = useRef<Circle[]>([]);
    const isRestoringState = useRef(false);
    const CLOSE_THRESHOLD = 10; // Threshold distance to close polygon

    const saveCanvasState = () => {
      if (!mainCanvasRef.current || isRestoringState.current) return;

      const state = mainCanvasRef.current.toJSON() as CanvasState;
      historyRef.current = [...historyRef.current, state];

      // Keep only last 50 states
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50);
      }
      console.log("Saved state, total states:", historyRef.current.length);
    };

    const clearCanvas = () => {
      if (!mainCanvasRef.current) return;
      mainCanvasRef.current.remove(...mainCanvasRef.current.getObjects());
    };

    const undo = () => {
      if (!mainCanvasRef.current || historyRef.current.length <= 1) return;

      isRestoringState.current = true;
      clearCanvas();

      // Remove current state
      historyRef.current.pop();

      // Get previous state
      const previousState = historyRef.current[historyRef.current.length - 1];

      if (!previousState?.objects) {
        console.log("No previous state objects found");
        isRestoringState.current = false;
        return;
      }

      const canvas = mainCanvasRef.current;

      // Restore objects using the imported util
      void util.enlivenObjects(previousState.objects).then((objs) => {
        objs.forEach((obj) => {
          canvas.add(obj as FabricObject);
        });
        canvas.renderAll();
        isRestoringState.current = false;
      });
    };

    const exportToCOCO = () => {
      const canvas = mainCanvasRef.current;
      const cocoDataset = {
        images: [],
        annotations: [],
        categories: [],
      };
      // Assuming a single image
      const imageId = 1;
      cocoDataset.images.push({
        id: imageId,
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        file_name: "exported_image.png", // Adjust as needed
      });

      // Map classes to category IDs
      if (classes && classes.length > 0) {
        classes.forEach((cls) => {
          cocoDataset.categories.push({
            id: cls.id,
            name: cls.name,
            supercategory: "none",
          });
        });
      }

      let annotationId = 1;
      canvas?.getObjects().forEach((obj, index) => {
        // Retrieve the class from the object's data
        const objClass = annotations[index] as Class | undefined;

        if (!objClass) return; // Skip if class is not assigned

        const annotation: any = {
          id: annotationId++,
          image_id: imageId,
          category_id: objClass.id,
          segmentation: [],
          area: 0,
          bbox: [],
          iscrowd: 0,
        };
        console.log("scategory_id", annotationcategory_id);

        if (annotations[index]?.type === "polygon") {
          console.log("polygon");
          const polygon = obj as fabric.Polygon;

          // Extract segmentation points
          const points = polygon.get("points") || [];
          const transformedPoints = points.map((point) => {
            // Transform the points to absolute coordinates
            const x = polygon.left! + point.x * polygon.scaleX!;
            const y = polygon.top! + point.y * polygon.scaleY!;
            return [x, y];
          });

          // Flatten the array for segmentation
          const segmentation = transformedPoints.flat();

          annotation.segmentation = [segmentation];

          // Calculate bounding box [x, y, width, height]
          const bbox = [
            polygon.left,
            polygon.top,
            polygon.width! * polygon.scaleX!,
            polygon.height! * polygon.scaleY!,
          ];
          annotation.bbox = bbox;
          annotation.class = objClass;
          annotation.area = bbox[2] * bbox[3];
        } else if (annotations[index]?.type === "path") {
          console.log("path");
          const path = obj as fabric.Path;

          // For brush strokes, we can approximate using the bounding box
          const bbox = [
            path.left,
            path.top,
            path.width! * path.scaleX!,
            path.height! * path.scaleY!,
          ];
          annotation.bbox = bbox;
          annotation.area = bbox[2] * bbox[3];
        }
        cocoDataset.annotations.push(annotation);
      });
      const jsonStr = JSON.stringify(cocoDataset, null, 2);
      console.log(jsonStr);
    };

    const toggleAnnotationsView = () => {
      setShowAnnotations( (prevState) =>!prevState);
    };

    useImperativeHandle(ref, () => ({
      undo,
      exportToCOCO,
      toggleAnnotationsView
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      mainCanvasRef.current = new FabricCanvas("mainCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        backgroundColor: hexToRgba("#f0f0f0", 0.35),
        isDrawingMode: false,
      });

      maskCanvasRef.current = new FabricCanvas("maskCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        backgroundColor: hexToRgba("#f0f0f0", 0.35),
        isDrawingMode: false,
      });

      const brush = new PencilBrush(mainCanvasRef.current);
      mainCanvasRef.current.freeDrawingBrush = brush;

      const canvas = mainCanvasRef.current;

      // Save state only when user finishes drawing
      canvas.on("after:render", () => {
        if (!isRestoringState.current) {
          saveCanvasState();
        }
      });

      // Save initial state
      saveCanvasState();

      return () => {
        if (canvas) {
          canvas.off("after:render");
          void canvas.dispose();
        }
      };
    }, []);

    useEffect(() => {
      if (!mainCanvasRef.current) return;

      const brush = mainCanvasRef.current.freeDrawingBrush;
      if (brush) {
        brush.color = hexToRgba(selectedClass?.color ?? "#f0f0f0", 0.35);
      }
    }, [selectedClass?.color]);

    // Handle image loading
    useEffect(() => {
      const loadImage = async () => {
        if (!imageUrl || !mainCanvasRef.current) return;

        try {
          // Create a new HTML Image element
          const img = new Image();

          // Create a promise to handle image loading
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          // Create Fabric Image from loaded HTML Image
          const fabricImage = new FabricImage(img);

          // Clear existing canvas
          mainCanvasRef.current.clear();

          // Get canvas dimensions
          const canvasWidth = mainCanvasRef.current.getWidth();
          const canvasHeight = mainCanvasRef.current.getHeight();

          // Calculate scaling to fit the canvas while maintaining aspect ratio
          const scaleX = canvasWidth / fabricImage.width;
          const scaleY = canvasHeight / fabricImage.height;
          const scale = Math.min(scaleX, scaleY);

          // Configure image
          fabricImage.set({
            scaleX: scale,
            scaleY: scale,
            left: (canvasWidth - fabricImage.width * scale) / 2,
            top: (canvasHeight - fabricImage.height * scale) / 2,
            selectable: false,
          });

          // Add image to canvas
          mainCanvasRef.current.backgroundImage = fabricImage;
        } catch (error) {
          console.error("Error loading image:", error);
        }
      };

      void loadImage();
    }, [imageUrl]);

    // Handle tool changes
    useEffect(() => {
      if (!mainCanvasRef.current) return;
      if (!tool) {
        mainCanvasRef.current.isDrawingMode = false;
        return;
      }
      // Remove event listeners for polygon tool
      if (tool !== "polygon") {
        mainCanvasRef.current.off("mouse:down");
      }

      if (tool === "eraser") {
        mainCanvasRef.current.isDrawingMode = true;
        const brush = new PencilBrush(mainCanvasRef.current);
        brush.width = brushSize;
        brush.color = hexToRgba("#f0f0f0", 0.35);
        mainCanvasRef.current.freeDrawingBrush = brush;
      } else if (tool === "brush") {
        const handleMouseDown = () => {
          setAnnotations((prevAnnotations) => [
            ...prevAnnotations,
            {
              type: "path",
              class: selectedClass,
            },
          ]);
        };

        const canvas = mainCanvasRef.current;
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(mainCanvasRef.current);
        brush.width = brushSize;
        brush.color = hexToRgba(selectedClass?.color ?? "#f0f0f0", 0.35);
        mainCanvasRef.current.freeDrawingBrush = brush;
        canvas.on("mouse:down", handleMouseDown);
      } else if (tool === "polygon") {
        mainCanvasRef.current.isDrawingMode = false;
        const canvas = mainCanvasRef.current;

        const handleMouseDown = (event: fabric.IEvent) => {
          const pointer = canvas.getPointer(event.e);
          const positionX = pointer.x;
          const positionY = pointer.y;

          // Add small circle as an indicative point
          const circlePoint = new Circle({
            radius: 5,
            fill: hexToRgba(selectedClass?.color ?? "#f0f0f0", 0.35),
            left: positionX,
            top: positionY,
            selectable: false,
            originX: "center",
            originY: "center",
            hoverCursor: "auto",
          });

          canvas.add(circlePoint);
          currentPolygonPoints.current = [
            ...currentPolygonPoints.current,
            circlePoint,
          ];

          // Check if the polygon should be closed
          if (currentPolygonPoints.current.length > 2) {
            const firstPoint = currentPolygonPoints.current[0];
            const dx = positionX - firstPoint.get("left");
            const dy = positionY - firstPoint.get("top");
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= CLOSE_THRESHOLD) {
              // Close the polygon
              const lastPoint =
                currentPolygonPoints.current[
                  currentPolygonPoints.current.length - 1
                ];

              // Draw closing line
              const closingLine = new Line(
                [
                  lastPoint.get("left"),
                  lastPoint.get("top"),
                  firstPoint.get("left"),
                  firstPoint.get("top"),
                ],
                {
                  stroke: hexToRgba(selectedClass?.color ?? "#000000", 0.8),
                  strokeWidth: 2,
                  hasControls: false,
                  hasBorders: false,
                  selectable: false,
                  lockMovementX: true,
                  lockMovementY: true,
                  hoverCursor: "default",
                  originX: "center",
                  originY: "center",
                },
              );
              canvas.add(closingLine);

              // Create polygon from points
              const polygonPoints = currentPolygonPoints.current.map(
                (point) => {
                  return {
                    x: point.get("left"),
                    y: point.get("top"),
                  };
                },
              );

              const polygon = new Polygon(polygonPoints, {
                fill: hexToRgba(selectedClass?.color ?? "#f0f0f0", 0.35),
                stroke: hexToRgba(selectedClass?.color ?? "#000000", 0.8),
                strokeWidth: 2,
                selectable: false,
              });

              canvas.add(polygon);

              // Remove lines and points
              canvas.remove(...currentPolygonPoints.current);
              canvas.remove(closingLine);
              currentPolygonPoints.current = [];

              canvas.renderAll();

              setAnnotations((prevAnnotations) => [
                ...prevAnnotations,
                {
                  type: "polygon",
                  class: selectedClass,
                },
              ]);
              return;
            }
          }

          // Draw line to previous point
          if (currentPolygonPoints.current.length > 1) {
            const startPoint =
              currentPolygonPoints.current[
                currentPolygonPoints.current.length - 2
              ];
            const endPoint =
              currentPolygonPoints.current[
                currentPolygonPoints.current.length - 1
              ];

            const line = new Line(
              [
                startPoint.get("left"),
                startPoint.get("top"),
                endPoint.get("left"),
                endPoint.get("top"),
              ],
              {
                stroke: hexToRgba(selectedClass?.color ?? "#000000", 0.8),
                strokeWidth: 2,
                hasControls: false,
                hasBorders: false,
                selectable: false,
                lockMovementX: true,
                lockMovementY: true,
                hoverCursor: "default",
                originX: "center",
                originY: "center",
              },
            );

            canvas.add(line);
          }
        };

        canvas.on("mouse:down", handleMouseDown);

        // Clean up event listener when the tool changes
        return () => {
          canvas.off("mouse:down", handleMouseDown);
        };
      }
    }, [tool, selectedClass, brushSize]);

    const removeAnnotation = (index: number) => {
      setAnnotations((prevAnnotations) =>
        prevAnnotations.filter((_, i) => i !== index),
      );

      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const objects = canvas.getObjects();

      if (index >= 0 && index < objects.length) {
        canvas.remove(objects[index]);
        canvas.renderAll(); // Ensure the canvas updates visually
      }
    };

   const annotationsClass = () => `
    absolute w-full  ${showAnnotationsOnTop ? " top-0 left-0 " : "bottom-0 left-0 "} flex h-14 w-full flex-wrap overflow-auto shadow-lg bg-slate-200 border-black px-4
  `;

    return (
      <>
        <div
          ref={containerRef}
          className="relative h-full min-h-[600px] w-full"
          style={{ touchAction: "none" }}
        >
          <canvas id="mainCanvas" />
          <canvas id="maskCanvas" />
        </div>
        {showAnnotations && (
        <div className= {annotationsClass()}>
          {annotations.map((annotation, index) => (
            <Button
              className="m-2"
              key={index}
              onMouseEnter={() => {
                const canvas = mainCanvasRef.current;
                if (!canvas) return;

                const objects = canvas.getObjects();
                if (index >= 0 && index < objects.length) {
                  objects[index].set("opacity", 0.6);
                  canvas.renderAll();
                }
              }}
              onMouseLeave={() => {
                const canvas = mainCanvasRef.current;
                if (!canvas) return;

                const objects = canvas.getObjects();
                if (index >= 0 && index < objects.length) {
                  objects[index].set("opacity", 1);
                  canvas.renderAll();
                }
              }}
              onClick={() => removeAnnotation(index)}
            >
              {annotation.class?.name} <FaTrash />
            </Button>
          ))}
          <Button className="m-2 bg-blue-300 hover:bg-blue-300 " onClick={() => setshowAnnotationsOnTop(!showAnnotationsOnTop)}> {showAnnotationsOnTop ? "Bottom" : "Top"}</Button>
        </div>
        )}
      </>
    );
  },
);

Canvas.displayName = "Canvas";

export default Canvas;
