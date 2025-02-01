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
    const CLOSE_THRESHOLD = 10; // Threshold distance to close polygon
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotationsOnTop, setshowAnnotationsOnTop] = useState(true);
    const [showAnnotations, setShowAnnotations] = useState(false);
    const [imageId, setImageId] = useState<number | null>(null);

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
      const lastState = historyRef.current.pop();
      console.log("lastState", lastState?.objects[lastState.objects.length - 1]?.type);

      if (lastState && lastState.objects[lastState.objects.length - 1]?.type === "Path" || lastState.objects[lastState.objects.length - 1]?.type === "Polygon") {
        setAnnotations((prevAnnotations) =>
          prevAnnotations.filter((_, i) => i !== annotations.length - 1),
        );
      }

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

    function exportToCOCO() {
      const canvas = mainCanvasRef.current;
      if (!canvas) {
        alert("Canvas is not initialized.");
        return;
      }

      // Remove temporary objects from canvas
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => obj.type === "line" || obj.type === "circle");
      objectsToRemove.forEach((obj) => canvas.remove(obj));

      // Create a mapping from class IDs to new random numeric IDs
      const categoryMap: Record<number, number> = {};
      classes.forEach((cls) => {
        categoryMap[cls.id] = generateRandomId();
      });

      // Build the annotation array
      const annotationsData: COCOAnnotation[] = annotations
        .map((annotation) => {
          // Either polygon or path
          if (annotation.type === "polygon") {
            const polygon = annotation.object as Polygon;
            const points = polygon.points ?? [];

            // Flatten points into [x1, y1, x2, y2, ...]
            const segmentation = points.flatMap((pt) => [pt.x, pt.y]);

            // Calculate area using the Shoelace formula
            const area = Math.abs(
              points.reduce((sum, point, i, arr) => {
                const nextPoint = arr[(i + 1) % arr.length];
                return sum + (point.x * nextPoint.y - nextPoint.x * point.y);
              }, 0) / 2,
            );

            return {
              id: generateRandomId(), // random numeric ID
              image_id: imageId,
              category_id: annotation.class
                ? categoryMap[annotation.class.id]
                : 0,
              segmentation: [segmentation],
              area,
              bbox: [
                polygon.left || 0,
                polygon.top || 0,
                polygon.width || 0,
                polygon.height || 0,
              ],
              iscrowd: 0,
            };
          }

          if (annotation.type === "path") {
            const pathObj = annotation.object as Path;
            const pathData = pathObj.path ?? [];
            const points: [number, number][] = [];
            let currentX = 0;
            let currentY = 0;

            for (const command of pathData) {
              const [cmd, ...args] = command;
              switch (cmd) {
                case "M": {
                  currentX = args[0];
                  currentY = args[1];
                  points.push([currentX, currentY]);
                  break;
                }
                case "L": {
                  currentX = args[0];
                  currentY = args[1];
                  points.push([currentX, currentY]);
                  break;
                }
                case "C": {
                  // For brevity, just move to final x, y
                  const [x1, y1, x2, y2, x, y] = args;
                  currentX = x;
                  currentY = y;
                  points.push([currentX, currentY]);
                  break;
                }
                case "Q": {
                  const [qx1, qy1, qx, qy] = args;
                  currentX = qx;
                  currentY = qy;
                  points.push([currentX, currentY]);
                  break;
                }
                case "Z": {
                  if (points.length > 0) {
                    points.push(points[0]);
                  }
                  break;
                }
                default: {
                  // No-op for other commands
                  break;
                }
              }
            }

            const segmentation = points.flatMap(([xx, yy]) => [xx, yy]);
            const area = Math.abs(
              points.reduce((sum, point, i, arr) => {
                const nextPoint = arr[(i + 1) % arr.length];
                return (
                  sum + (point[0] * nextPoint[1] - nextPoint[0] * point[1])
                );
              }, 0) / 2,
            );
            const boundingRect = pathObj.getBoundingRect();

            return {
              id: generateRandomId(),
              image_id: imageId,
              category_id: annotation.class
                ? categoryMap[annotation.class.id]
                : 0,
              segmentation: [segmentation],
              area,
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
        .filter((anno): anno is COCOAnnotation => anno !== null);

      // Build the final COCO data object
      const cocoData = buildCOCOData(
        canvas,
        annotationsData,
        classes,
        categoryMap,
      );

      // Validate COCO data
      const validation = validateCOCO(cocoData);
      if (!validation.success) {
        toast.error(validation.message);
        console.log(validation.details);
        return;
      }
      toast.success("COCO data is valid");

      // Download
      const dataStr = JSON.stringify(cocoData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "annotations.json";
      link.click();
      URL.revokeObjectURL(url);
    }

    const toggleAnnotationsView = () => {
      setShowAnnotations((prev) => !prev);
    };

    useImperativeHandle(ref, () => ({
      undo,
      exportToCOCO,
      toggleAnnotationsView,
    }));

  // Initialize canvas

    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      mainCanvasRef.current = new FabricCanvas("mainCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 400,
        isDrawingMode: false,
      });

      maskCanvasRef.current = new FabricCanvas("maskCanvas", {
        width: container.clientWidth || 800,
        height: container.clientHeight || 400,
        isDrawingMode: false,
      });

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

    // Handle change color
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
          setImageId(generateRandomId());
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
          0.35,
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
              [previousPoint.left, previousPoint.top, circle.left, circle.top],
              {
                stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
                strokeWidth: 2,
                selectable: false,
                hasControls: false,
                hasBorders: false,
              },
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
                },
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
                },
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
                canvas.remove(point),
              );
              currentPolygonLines.current.forEach((line) =>
                canvas.remove(line),
              );

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
        .filter((obj) => obj.type === "line" || obj.type === "circle");

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
    absolute w-full
    ${showAnnotationsOnTop ? "top-0 left-0 h-14" : "bottom-14 md:bottom-0 left-0 h-14"} 
    flex w-full flex-wrap shadow-lg bg-slate-200 border-black px-4 sm:px-6 overflow-auto max-h-14 
  `;

    return (
      <div className="relative h-full w-full overflow-y-hidden overscroll-none">
        <div
          ref={containerRef}
          className="relative left-12 h-[calc(100vh-100px)] min-h-[400px] w-[calc(100vw-80px)] md:left-0 md:h-full md:w-full"
          style={{ touchAction: "none" }}
        >
          <canvas id="mainCanvas" />
          <canvas id="maskCanvas" />
        </div>
        {showAnnotations && (
          <div className="h-screen w-full overflow-hidden">
            <div className={annotationsClass()}>
              {annotations.map((annotation, index) => (
                <Button
                  className="z-10 m-2 border border-slate-300 bg-slate-50 text-black hover:bg-slate-400"
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
                    className="flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: annotation.class?.color }}
                  ></div>
                  {annotation.class?.name} <FaTrash size={8} />
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
          </div>
        )}
      </div>
    );
  },
);

Canvas.displayName = "Canvas";

export default Canvas;
