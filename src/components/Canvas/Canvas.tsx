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
  type Path,
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
  object: FabricObject;
};

interface COCOAnnotation {
  id: number;
  category_id: number;
  segmentation: number[][];
  area: number;
  bbox: [number, number, number, number];
  iscrowd: number;
}

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
    const currentPolygonLines = useRef<Line[]>([]);
    const isRestoringState = useRef(false);
    const CLOSE_THRESHOLD = 10; // Threshold distance to close polygon

    // References to event handlers so they can be removed
    const handleMouseDownRef = useRef<(options: fabric.IEvent) => void>();
    const handlePathCreatedRef = useRef<(e: fabric.IEvent) => void>();

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
      if (!mainCanvasRef.current) {
        alert("Canvas is not initialized.");
        return;
      }

      const canvas = mainCanvasRef.current;

      // Remove temporary Line and Circle objects before exporting
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => obj.type === "line" || obj.type === "circle");

      objectsToRemove.forEach((obj) => canvas.remove(obj));

      // Build up the list of annotations from your Fabric objects
      const annotationsData: COCOAnnotation[] = annotations
        .map((annotation, index) => {
          // For polygons
          if (annotation.type === "polygon") {
            const polygon = annotation.object as Polygon;
            const points = polygon.points ?? [];

            // Flatten points into [x1, y1, x2, y2, ...]
            const segmentation = points.flatMap((point) => [point.x, point.y]);

            // Calculate area using the Shoelace formula
            const area = Math.abs(
              points.reduce((sum, point, i, arr) => {
                const nextPoint = arr[(i + 1) % arr.length];
                return sum + (point.x * nextPoint.y - nextPoint.x * point.y);
              }, 0) / 2
            );

            return {
              id: index + 1,
              category_id: annotation.class?.id ?? 0,
              segmentation: [segmentation],
              area: area,
              bbox: [
                polygon.left || 0,
                polygon.top || 0,
                polygon.width || 0,
                polygon.height || 0,
              ],
              iscrowd: 0,
            };
          }

          // For paths
          if (annotation.type === "path") {
            const path = annotation.object as Path;
            const pathData = path.path ?? [];

            // Convert path data to a polygon by extracting points
            const points: [number, number][] = [];
            let currentX = 0;
            let currentY = 0;

            for (const command of pathData) {
              const [cmd, ...args] = command;

              switch (cmd) {
                case 'M': // Move to
                  currentX = args[0];
                  currentY = args[1];
                  points.push([currentX, currentY]);
                  break;
                case 'L': // Line to
                  currentX = args[0];
                  currentY = args[1];
                  points.push([currentX, currentY]);
                  break;
                case 'C': // Bezier curve
                  const [x1, y1, x2, y2, x, y] = args;
                  const curvePoints = approximateBezierCurve(
                    currentX,
                    currentY,
                    x1,
                    y1,
                    x2,
                    y2,
                    x,
                    y,
                    10 // Number of points to sample
                  );
                  points.push(...curvePoints);
                  currentX = x;
                  currentY = y;
                  break;
                case 'Q': // Quadratic curve
                  const [qx1, qy1, qx, qy] = args;
                  const quadPoints = approximateQuadraticCurve(
                    currentX,
                    currentY,
                    qx1,
                    qy1,
                    qx,
                    qy,
                    10 // Number of points to sample
                  );
                  points.push(...quadPoints);
                  currentX = qx;
                  currentY = qy;
                  break;
                case 'Z': // Close path
                  // Optional: Add the starting point to close the path
                  if (points.length > 0) {
                    points.push(points[0]);
                  }
                  break;
                default:
                  // Handle other commands if necessary
                  break;
              }
            }

            // Flatten points into [x1, y1, x2, y2, ...]
            const segmentation = points.flatMap(([x, y]) => [x, y]);

            // Calculate area and bounding box
            const boundingRect = path.getBoundingRect();

            // Calculate approximate area using Shoelace formula
            const area = Math.abs(
              points.reduce((sum, point, i, arr) => {
                const nextPoint = arr[(i + 1) % arr.length];
                return sum + (point[0] * nextPoint[1] - nextPoint[0] * point[1]);
              }, 0) / 2
            );

            return {
              id: index + 1,
              category_id: annotation.class?.id ?? 0,
              segmentation: [segmentation],
              area: area,
              bbox: [
                boundingRect.left || 0,
                boundingRect.top || 0,
                boundingRect.width || 0,
                boundingRect.height || 0,
              ],
              iscrowd: 0,
            };
          }

          return null;
        })
        .filter((annotation): annotation is COCOAnnotation => annotation !== null);

      // Example "info" and "licenses"
      // Adjust these fields to match your dataset
      const info = {
        description: "Sample dataset description",
        url: "https://your-website.com",
        version: "1.0",
        year: new Date().getFullYear(),
        contributor: "Gustavo Barbosa",
        date_created: new Date().toISOString(),
      };

      const licenses = [
        {
          url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
          id: 1,
          name: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International",
        },
      ];

      // Example single image entry
      const images = [
        {
          license: 1,
          file_name: "image.jpg",
          coco_url: "",
          height: canvas.getHeight(),
          width: canvas.getWidth(),
          date_captured: new Date().toISOString(),
          flickr_url: "",
          id: 1,
        },
      ];

      // Build category objects from the classes array
      const categories = classes.map((cls) => ({
        supercategory: "none",
        id: cls.id,
        name: cls.name,
      }));

      // Final COCO data structure
      const cocoData = {
        info,
        licenses,
        images,
        annotations: annotationsData,
        categories,
      };

      // Convert to JSON and download
      const dataStr = JSON.stringify(cocoData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "annotations.json";
      link.click();

      URL.revokeObjectURL(url);
    };

    const toggleAnnotationsView = () => {
      setShowAnnotations((prev) => !prev);
    };

    useImperativeHandle(ref, () => ({
      undo,
      exportToCOCO,
      toggleAnnotationsView,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      mainCanvasRef.current = new FabricCanvas("mainCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        isDrawingMode: false,
      });

      maskCanvasRef.current = new FabricCanvas("maskCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
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

    // Tool handling, including adding annotations
    useEffect(() => {
      if (!mainCanvasRef.current) return;
      const canvas = mainCanvasRef.current;

      // Remove previous event handlers
      if (handleMouseDownRef.current) {
        canvas.off("mouse:down", handleMouseDownRef.current);
      }
      if (handlePathCreatedRef.current) {
        canvas.off("path:created", handlePathCreatedRef.current);
      }

      // Clear any temporary data when switching tools
      currentPolygonPoints.current = [];
      currentPolygonLines.current = [];

      if (tool === "brush") {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.color = hexToRgba(
          selectedClass?.color ?? "#000000",
          0.35
        );

        // Define and store the event handler
        const handlePathCreated = (e: fabric.IEvent) => {
          const path = e.path as Path;

          // Assign the selected class to the path
          path.data = {
            class: selectedClass,
          };

          // Add annotation with a reference to the path object
          setAnnotations((prevAnnotations) => [
            ...prevAnnotations,
            {
              type: "path",
              class: selectedClass,
              object: path,
            },
          ]);
        };

        // Store the handler in ref
        handlePathCreatedRef.current = handlePathCreated;

        // Attach the event handler
        canvas.on("path:created", handlePathCreated);
      } else if (tool === "polygon") {
        canvas.isDrawingMode = false;

        // Define and store the event handler
        const handleMouseDown = (options: fabric.IEvent) => {
          if (!selectedClass) {
            alert("Please select a class before drawing.");
            return;
          }

          const pointer = canvas.getPointer(options.e);
          const circle = new Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 3,
            fill: hexToRgba(selectedClass.color ?? "#000000", 0.8),
            stroke: "#ffffff",
            strokeWidth: 1,
            selectable: false,
            originX: "center",
            originY: "center",
          });
          canvas.add(circle);
          currentPolygonPoints.current.push(circle);

          if (currentPolygonPoints.current.length > 1) {
            const previousPoint =
              currentPolygonPoints.current[
                currentPolygonPoints.current.length - 2
              ];
            const line = new Line(
              [
                previousPoint.left,
                previousPoint.top,
                circle.left,
                circle.top,
              ],
              {
                stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
                strokeWidth: 2,
                selectable: false,
                hasControls: false,
                hasBorders: false,
              }
            );
            canvas.add(line);
            currentPolygonLines.current.push(line);
          }

          // Check if the first and last point are close enough to close the polygon
          if (currentPolygonPoints.current.length > 2) {
            const firstPoint = currentPolygonPoints.current[0];
            const dx = pointer.x - firstPoint.left;
            const dy = pointer.y - firstPoint.top;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < CLOSE_THRESHOLD) {
              // Close the polygon
              // Remove the last point and use the first point instead
              canvas.remove(circle);
              currentPolygonPoints.current.pop();

              // Add closing line
              const previousPoint =
                currentPolygonPoints.current[
                  currentPolygonPoints.current.length - 1
                ];
              const closingLine = new Line(
                [
                  previousPoint.left,
                  previousPoint.top,
                  firstPoint.left,
                  firstPoint.top,
                ],
                {
                  stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
                  strokeWidth: 2,
                  selectable: false,
                  hasControls: false,
                  hasBorders: false,
                }
              );
              canvas.add(closingLine);
              currentPolygonLines.current.push(closingLine);

              // Create polygon from points
              const polygonPoints = currentPolygonPoints.current.map(
                (point) => {
                  return {
                    x: point.left,
                    y: point.top,
                  };
                }
              );

              const polygon = new Polygon(polygonPoints, {
                fill: hexToRgba(selectedClass.color ?? "#f0f0f0", 0.35),
                stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
                strokeWidth: 2,
                selectable: false,
              });

              canvas.add(polygon);

              // Remove temporary points and lines
              currentPolygonPoints.current.forEach((point) =>
                canvas.remove(point)
              );
              currentPolygonLines.current.forEach((line) => canvas.remove(line));

              // Clear arrays
              currentPolygonPoints.current = [];
              currentPolygonLines.current = [];

              canvas.requestRenderAll();

              // Add annotation
              setAnnotations((prevAnnotations) => [
                ...prevAnnotations,
                {
                  type: "polygon",
                  class: selectedClass,
                  object: polygon,
                },
              ]);
            }
          }

          canvas.requestRenderAll();
        };

        // Store the handler in ref
        handleMouseDownRef.current = handleMouseDown;

        // Attach the event handler
        canvas.on("mouse:down", handleMouseDown);
      } else if (tool === "eraser") {
        canvas.isDrawingMode = false;
        // Implement eraser tool if needed
      } else {
        // Default case
        canvas.isDrawingMode = false;
      }

      // Clean up function when the component unmounts or tool changes
      return () => {
        if (handleMouseDownRef.current) {
          canvas.off("mouse:down", handleMouseDownRef.current);
          handleMouseDownRef.current = undefined;
        }
        if (handlePathCreatedRef.current) {
          canvas.off("path:created", handlePathCreatedRef.current);
          handlePathCreatedRef.current = undefined;
        }

        // Clear temporary data
        currentPolygonPoints.current = [];
        currentPolygonLines.current = [];
      };
    }, [tool, selectedClass, brushSize]);

    // New useEffect to remove temporary lines and circles when tool or selectedClass changes
    useEffect(() => {
      if (!mainCanvasRef.current) return;
      const canvas = mainCanvasRef.current;

      // Remove all Line and Circle objects
      const objectsToRemove = canvas
        .getObjects()
        .filter(
          (obj) =>
            obj.type === "line" || obj.type === "circle"
        );

      objectsToRemove.forEach((obj) => canvas.remove(obj));

      canvas.requestRenderAll();

      // Clear temporary data
      currentPolygonPoints.current = [];
      currentPolygonLines.current = [];
    }, [tool, selectedClass]);

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

    // Helper functions for curve approximation
    function approximateBezierCurve(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      numPoints: number
    ): [number, number][] {
      const points: [number, number][] = [];

      for (let i = 1; i <= numPoints; i++) {
        const t = i / numPoints;
        const x =
          Math.pow(1 - t, 3) * x0 +
          3 * Math.pow(1 - t, 2) * t * x1 +
          3 * (1 - t) * Math.pow(t, 2) * x2 +
          Math.pow(t, 3) * x3;
        const y =
          Math.pow(1 - t, 3) * y0 +
          3 * Math.pow(1 - t, 2) * t * y1 +
          3 * (1 - t) * Math.pow(t, 2) * y2 +
          Math.pow(t, 3) * y3;
        points.push([x, y]);
      }

      return points;
    }

    function approximateQuadraticCurve(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      numPoints: number
    ): [number, number][] {
      const points: [number, number][] = [];

      for (let i = 1; i <= numPoints; i++) {
        const t = i / numPoints;
        const x =
          Math.pow(1 - t, 2) * x0 +
          2 * (1 - t) * t * x1 +
          Math.pow(t, 2) * x2;
        const y =
          Math.pow(1 - t, 2) * y0 +
          2 * (1 - t) * t * y1 +
          Math.pow(t, 2) * y2;
        points.push([x, y]);
      }

      return points;
    }

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
          <div className={annotationsClass()}>
            {annotations.map((annotation, index) => (
              <Button
                className="m-2 border border-slate-300 bg-slate-50 text-black hover:bg-slate-400"
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
                <div
                  className="flex w-3 h-3 rounded-full"
                  style={{ backgroundColor: annotation.class?.color }}
                ></div>
                {annotation.class?.name} <FaTrash size={8}/>
              </Button>
            ))}
            <Button
              className="m-2 bg-blue-300 hover:bg-blue-300"
              onClick={() => setshowAnnotationsOnTop(!showAnnotationsOnTop)}
            >
              {" "}
              {showAnnotationsOnTop ? "bottom" : "Top"}
            </Button>
          </div>
        )}
      </>
    );
  },
);

Canvas.displayName = "Canvas";

export default Canvas;
