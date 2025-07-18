"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
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
  type TPointerEvent,
} from "fabric";
import type { Class } from "~/Types/Class";
import { Button } from "~/components/ui/button";
import { FaTrash } from "react-icons/fa";
import { getAlpha, hexToRgba } from "~/utils/colors";
import {
  buildCOCOData,
  createCategoryMap,
  downloadJSONData,
  validateCOCO,
} from "~/utils/COCOUtils";
import toast from "react-hot-toast";
import { generateRandomId } from "~/utils/uuid";
import { type Annotation, buildAnnotationsData } from "~/utils/COCOUtils";
import { getClassFromColor } from "~/utils/classUtils";

interface CanvasProps {
  tool: "brush" | "polygon" | "eraser" | null;
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


// -- Setup "brush" tool
function setupBrushTool(
  canvas: FabricCanvas,
  brushSize: number,
  selectedClass: Class | null,
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  handlePathCreatedRef: React.MutableRefObject<
    ((e: { path: Path }) => void) | undefined
  >,
) {
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush = new PencilBrush(canvas);
  canvas.freeDrawingBrush.width = brushSize;
  canvas.freeDrawingBrush.color = hexToRgba(
    selectedClass?.color ?? "#000000",
    CONTENT_OPACITY,
  );

  const handlePathCreated = (e: { path: Path }) => {
    const pathObj = e.path;

    setAnnotations((prev) => [
      ...prev,
      { type: "path", class: selectedClass, object: pathObj },
    ]);
  };

  handlePathCreatedRef.current = handlePathCreated;
  canvas.on("path:created", handlePathCreated);
}

// -- Setup "polygon" tool
function setupPolygonTool(
  canvas: FabricCanvas,
  selectedClass: Class | null,
  currentPolygonPoints: React.MutableRefObject<Circle[]>,
  currentPolygonLines: React.MutableRefObject<Line[]>,
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  handleMouseDownRef: React.MutableRefObject<
    ((opt: { e: TPointerEvent }) => void) | undefined
  >,
  CLOSE_THRESHOLD = 10,
) {
  canvas.isDrawingMode = false;

  const handleMouseDown = (options: { e: TPointerEvent }) => {
    if (!selectedClass) {
      alert("Please select a class before drawing.");
      return;
    }

    const pointer = canvas.getPointer(options.e);
    // 1) Create circle
    const circle = new Circle({
      left: pointer.x,
      top: pointer.y,
      radius: 3,
      fill: hexToRgba(
        selectedClass.color ?? "#000000",
        POLYGON_OUTLINE_OPACITY,
      ),
      stroke: "#ffffff",
      strokeWidth: 1,
      selectable: false,
      originX: "center",
      originY: "center",
    });
    canvas.add(circle);
    currentPolygonPoints.current.push(circle);

    // 2) Create line from previous circle
    if (currentPolygonPoints.current.length > 1) {
      const previous =
        currentPolygonPoints.current[currentPolygonPoints.current.length - 2];
      const line = new Line(
        [previous?.left ?? 0, previous?.top ?? 0, circle.left, circle.top],
        {
          stroke: hexToRgba(
            selectedClass.color ?? "#000000",
            POLYGON_OUTLINE_OPACITY,
          ),
          strokeWidth: 2,
          selectable: false,
        },
      );
      canvas.add(line);
      currentPolygonLines.current.push(line);
    }

    // 3) Check if we should close polygon
    if (currentPolygonPoints.current.length > 2) {
      const firstPt = currentPolygonPoints.current[0];
      const dx = pointer.x - (firstPt?.left ?? 0);
      const dy = pointer.y - (firstPt?.top ?? 0);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < CLOSE_THRESHOLD) {
        // remove last circle
        canvas.remove(circle);
        currentPolygonPoints.current.pop();

        // add closing line
        const prev =
          currentPolygonPoints.current[currentPolygonPoints.current.length - 1];
        const closingLine = new Line(
          [
            prev?.left ?? 0,
            prev?.top ?? 0,
            firstPt?.left ?? 0,
            firstPt?.top ?? 0,
          ],
          {
            stroke: hexToRgba(
              selectedClass.color ?? "#000000",
              POLYGON_OUTLINE_OPACITY,
            ),
            strokeWidth: 2,
            selectable: false,
          },
        );
        canvas.add(closingLine);
        currentPolygonLines.current.push(closingLine);

        // create polygon
        const polygonPoints = currentPolygonPoints.current.map((pt) => ({
          x: pt.left,
          y: pt.top,
        }));
        const polygon = new Polygon(polygonPoints, {
          fill: hexToRgba(selectedClass.color ?? "#f0f0f0", CONTENT_OPACITY),
          stroke: hexToRgba(
            selectedClass.color ?? "#000000",
            POLYGON_OUTLINE_OPACITY,
          ),
          strokeWidth: 2,
          selectable: false,
        });
        canvas.add(polygon);

        // cleanup
        currentPolygonPoints.current.forEach((pt) => canvas.remove(pt));
        currentPolygonLines.current.forEach((ln) => canvas.remove(ln));
        currentPolygonPoints.current = [];
        currentPolygonLines.current = [];


        setAnnotations((prev) => [
          ...prev,
          { type: "polygon", class: selectedClass, object: polygon },
        ]);
      }
    }
    canvas.requestRenderAll();
  };

  handleMouseDownRef.current = handleMouseDown;
  canvas.on("mouse:down", handleMouseDown);
}

const CONTENT_OPACITY = 0.35;
const POLYGON_OUTLINE_OPACITY = 0.8;

const Canvas = forwardRef(
  ({ tool, brushSize, imageUrl, selectedClass, classes }: CanvasProps, ref) => {
    const mainCanvasRef = useRef<FabricCanvas>();
    const containerRef = useRef<HTMLDivElement>(null);
    const currentImageRef = useRef<FabricImage | null>(null);
    const historyRef = useRef<CanvasState[]>([]);
    const currentPolygonPoints = useRef<Circle[]>([]);
    const currentPolygonLines = useRef<Line[]>([]);
    const isRestoringState = useRef(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotationsOnTop, setShowAnnotationsOnTop] = useState(true);
    // References to event handlers so they can be removed
    const handleMouseDownRef = useRef<(options: fabric.IEvent) => void>();
    const handlePathCreatedRef = useRef<(e: { path: Path }) => void>();

    const [showAnnotations, setShowAnnotations] = useState(false);
    const [imageId, setImageId] = useState<number | null>(null);

    const saveCanvasState = useCallback(() => {
      if (!mainCanvasRef.current || isRestoringState.current) return;
      const state = mainCanvasRef.current.toJSON() as CanvasState;

      // Check if all objects are valid before saving
      for (const obj of state.objects) {
        const fillColor = typeof obj.fill === "string" ? obj.fill : "";
        const strokeColor = typeof obj.stroke === "string" ? obj.stroke : "";
      
        const acceptedTypes =
          // @ts-expect-errorts-ignore this line
          obj?.type === "Polygon" && getAlpha(fillColor) === CONTENT_OPACITY ||
          // @ts-expect-errorts-ignore this line
          obj?.type === "Path" && getAlpha(strokeColor) === CONTENT_OPACITY;
      
        if (!acceptedTypes) {
          return;
        }
      }
      
      // Check if the state is different from the last state and if the state is not empty to update history
      if (
        historyRef.current.length === 0 ||
        state.objects.length !==
          historyRef.current[historyRef.current.length - 1]?.objects.length
      ) {
        historyRef.current = [...historyRef.current, state];
      }

      // Keep only last 500 states
      if (historyRef.current.length > 500) {
        historyRef.current = historyRef.current.slice(-500);
      }
    }, []);

    const clearCanvas = useCallback(() => {
      if (!mainCanvasRef.current) return;
      mainCanvasRef.current.remove(...mainCanvasRef.current.getObjects());
    }, [mainCanvasRef]);

    const removeLastLineAndCircle = useCallback(
      (canvas: FabricCanvas, lines: Line[], circles: Circle[]): boolean => {
        if (lines.length > 0) {
          canvas.remove(lines[lines.length - 1] as unknown as Line); // Remove the last line
          currentPolygonLines.current = [
            ...currentPolygonLines.current.slice(0, -1),
          ];
        }

        if (circles.length > 0) {
          canvas.remove(circles[circles.length - 1] as unknown as Circle); // Remove the last circle
          currentPolygonPoints.current = [
            ...currentPolygonPoints.current.slice(0, -1),
          ];
        }
        if (lines.length === 0 && circles.length === 0) {
          return true;
        }
        return false;
      },
      [],
    );

    const undo = useCallback(() => {
      if (!mainCanvasRef.current) return;
      const canvas = mainCanvasRef.current;

      // Always try to remove lines and circles of unfinished polygon
      const lines = mainCanvasRef.current
        ?.getObjects()
        .filter((obj) => obj.type === "line");
      const circles = mainCanvasRef.current
        ?.getObjects()
        .filter((obj) => obj.type === "circle");
      if (lines?.length > 0 || circles?.length > 0) {
        removeLastLineAndCircle(
          mainCanvasRef.current,
          lines as Line[],
          circles as Circle[],
        );
        return;
      }
      // if the canvas is empty, do nothing
      if (canvas.getObjects().length === 0) {
        return;
      }

      if (historyRef.current.length <= 1) return;
      isRestoringState.current = true;

      // 1) Pop the newest state
      const lastState = historyRef.current.pop();
      if (!lastState?.objects?.length) {
        isRestoringState.current = false;
        return;
      }

      // 2) Check the last state's last object's type
      const lastObj = lastState.objects[lastState.objects.length - 1];
      const lastObjType = (lastObj as { type?: string })?.type;

      // 4)  Remove the last annotation if it's a polygon or path
      if (lastObjType === "Polygon" || lastObjType === "Path") {
        setAnnotations((prev) => prev.slice(0, -1));
      }

      // 5) Clear the canvas and load the now-top previous state
      clearCanvas();

      // 6) Get the previous state
      const prevState = historyRef.current[historyRef.current.length - 1];
      if (!prevState?.objects) {
        isRestoringState.current = false;
        return;
      }

      // 7) Re-create objects on canvas
      void util.enlivenObjects(prevState.objects).then((objs) => {
        objs.forEach((obj) => canvas.add(obj as FabricObject));
        canvas.renderAll();

        // 8) Rebuild "annotations" by scanning the newly added objects
        const newAnnotations: Annotation[] = [];
        for (const obj of canvas.getObjects()) {
          if (obj.type === "polygon") {
            newAnnotations.push({
              type: "polygon",
              class: getClassFromColor(classes, obj?.stroke as string)!,
              object: obj,
            });
          } else if (obj.type === "path") {
            newAnnotations.push({
              type: "path",
              class: getClassFromColor(classes, obj?.stroke as string)!,
              object: obj,
            });
          }
        }
        setAnnotations(newAnnotations);
        // Undo is complete; resume saving states normally
        isRestoringState.current = false;
      });

      // if for some reason the undo failed, try again
      if (canvas.getObjects().length === lastState.objects.length) {
        undo();
      }
    }, [clearCanvas, removeLastLineAndCircle, classes]);

    // Remove temporary objects (lines/circles)
    const removeTemporaryObjects = useCallback((canvas: FabricCanvas) => {
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => obj.type === "line" || obj.type === "circle");
      objectsToRemove.forEach((obj) => canvas.remove(obj));
    }, []);

    const exportToCOCO = useCallback(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas) {
        alert("Canvas is not initialized.");
        return;
      }
      removeTemporaryObjects(canvas);
      const categoryMap = createCategoryMap(classes);
      const annotationsData = buildAnnotationsData(
        annotations,
        categoryMap,
        imageId,
      );
      const cocoData = buildCOCOData(
        canvas,
        annotationsData,
        classes,
        categoryMap,
        imageId,
      );
      const validation = validateCOCO(cocoData);
      if (!validation.success) {
        toast.error(validation.message);
        return;
      }
      toast.success("COCO data is valid");
      downloadJSONData(cocoData, "annotations.json");
    }, [annotations, classes, imageId, removeTemporaryObjects]);

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

    // Add resize handler function
    const handleResize = useCallback(() => {
      if (!mainCanvasRef.current || !containerRef.current) return;
      
      const canvas = mainCanvasRef.current;
      const container = containerRef.current;
      
      // Get container dimensions
      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.width;
      const newHeight = containerRect.height;
      
      // Update canvas dimensions
      canvas.setDimensions({
        width: newWidth,
        height: newHeight
      });
      
      // Re-scale background image if it exists
      if (currentImageRef.current) {
        const fabricImage = currentImageRef.current;
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

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
        
        canvas.backgroundImage = fabricImage;
      }
      
      canvas.renderAll();
    }, []);

    // Add window resize listener
    useEffect(() => {
      window.addEventListener('resize', handleResize);
      
      // Also call on mount to ensure proper initial sizing
      const timeoutId = setTimeout(handleResize, 100);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timeoutId);
      };
    }, [handleResize]);

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
          currentImageRef.current = fabricImage; // Store reference for resize handler

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

      // Remove old event handlers
      if (handleMouseDownRef.current) {
        canvas.off("mouse:down", handleMouseDownRef.current);
      }
      if (handlePathCreatedRef.current) {
        canvas.off("path:created", handlePathCreatedRef.current);
      }

      // Clear temporary data
      currentPolygonPoints.current = [];
      currentPolygonLines.current = [];

      // Set up tool
      if (tool === "brush") {
        setupBrushTool(
          canvas,
          brushSize,
          selectedClass,
          setAnnotations,
          handlePathCreatedRef,
        );
      } else if (tool === "polygon") {
        setupPolygonTool(
          canvas,
          selectedClass,
          currentPolygonPoints,
          currentPolygonLines,
          setAnnotations,
          handleMouseDownRef,
        );
      } else {
        // default / eraser
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
    }, [tool, brushSize, selectedClass]);

    // useEffect to remove temporary lines and circles when tool or selectedClass changes
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

      if (index >= 0 && index < objects.length && objects[index]) {
        // Remove the object
        canvas.remove(objects[index]);
        saveCanvasState();
        canvas.renderAll();
      }
    };

    const annotationsClass = () => `
    absolute w-full
    ${showAnnotationsOnTop ? "top-0 left-0 h-14" : "bottom-14 md:bottom-0 left-0 h-14"} 
    flex w-full flex-wrap shadow-lg bg-slate-200 border-black px-4 sm:px-6 overflow-auto max-h-14 
  `;

    return (
      <div className="relative h-full w-full overflow-hidden">
        <div
          ref={containerRef}
          className="relative h-full w-full"
          style={{ touchAction: "none" }}
        >
          <canvas id="mainCanvas" />
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
                    if (
                      index >= 0 &&
                      index < objects.length &&
                      objects[index]
                    ) {
                      objects[index].set("opacity", 0.6);
                      canvas.renderAll();
                    }
                  }}
                  onMouseLeave={() => {
                    const canvas = mainCanvasRef.current;
                    if (!canvas) return;

                    const objects = canvas.getObjects();
                    if (
                      index >= 0 &&
                      index < objects.length &&
                      objects[index]
                    ) {
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
                onClick={() => setShowAnnotationsOnTop(!showAnnotationsOnTop)}
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
