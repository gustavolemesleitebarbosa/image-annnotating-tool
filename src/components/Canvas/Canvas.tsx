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
  type TPointerEvent,
} from "fabric";
import type { Class } from "~/Types/Class";
import { Button } from "~/components/ui/button";
import { FaTrash } from "react-icons/fa";
import { hexToRgba } from "~/utils/colors";
import { buildCOCOData, createCategoryMap, downloadJSONData, validateCOCO } from "~/utils/COCOUtils";
import toast from "react-hot-toast";
import { generateRandomId } from "~/utils/uuid";
import { type Annotation, buildAnnotationsData } from "~/utils/COCOUtils";
import { getClassFromColor } from "~/utils/classUtils";

interface CanvasProps {
  tool: "brush" | "polygon" | "eraser" |null;
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

// -- Helper to check collision for brush/polygon
function checkCollision(canvas: FabricCanvas, newObject: FabricObject) {
  return canvas.getObjects().some((obj) => {
    if (obj === newObject) return false;
    return obj.intersectsWithObject(newObject);
  });
}

// -- Setup "brush" tool
function setupBrushTool(
  canvas: FabricCanvas,
  brushSize: number,
  selectedClass: Class | null,
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  handlePathCreatedRef: React.MutableRefObject<((e: { path: Path }) => void) | undefined>,
) {
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush = new PencilBrush(canvas);
  canvas.freeDrawingBrush.width = brushSize;
  canvas.freeDrawingBrush.color = hexToRgba(selectedClass?.color ?? "#000000", 0.35);

  const handlePathCreated = (e: { path: Path }) => {
    const pathObj = e.path;
    if (checkCollision(canvas, pathObj)) {
      pathObj.set({ stroke: "red" });
      setTimeout(() => canvas.remove(pathObj), 500);
      return;
    }
    pathObj.set("data", {
      class: selectedClass,
    });
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
  handleMouseDownRef: React.MutableRefObject<((opt: {e: TPointerEvent}) => void) | undefined>,
  CLOSE_THRESHOLD = 10,
) {
  canvas.isDrawingMode = false;

  const handleMouseDown = (options: {e: TPointerEvent}) => {
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
      fill: hexToRgba(selectedClass.color ?? "#000000", 0.8),
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
      const previous = currentPolygonPoints.current[currentPolygonPoints.current.length - 2];
      const line = new Line([previous?.left ?? 0, previous?.top ?? 0, circle.left, circle.top], {
        stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
        strokeWidth: 2,
        selectable: false,
      });
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
        const prev = currentPolygonPoints.current[currentPolygonPoints.current.length - 1];
        const closingLine = new Line([prev?.left ?? 0, prev?.top ?? 0, firstPt?.left ?? 0, firstPt?.top ?? 0], {
          stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
          strokeWidth: 2,
          selectable: false,
        });
        canvas.add(closingLine);
        currentPolygonLines.current.push(closingLine);

        // create polygon
        const polygonPoints = currentPolygonPoints.current.map((pt) => ({ x: pt.left, y: pt.top }));
        const polygon = new Polygon(polygonPoints, {
          fill: hexToRgba(selectedClass.color ?? "#f0f0f0", 0.35),
          stroke: hexToRgba(selectedClass.color ?? "#000000", 0.8),
          strokeWidth: 2,
          selectable: false,
        });
        canvas.add(polygon);

        // cleanup
        currentPolygonPoints.current.forEach((pt) => canvas.remove(pt));
        currentPolygonLines.current.forEach((ln) => canvas.remove(ln));
        currentPolygonPoints.current = [];
        currentPolygonLines.current = [];

        // check overlap
        if (checkCollision(canvas, polygon)) {
          polygon.set({ stroke: "red" });
          setTimeout(() => canvas.remove(polygon), 500);
          return;
        }
        
        polygon.set("data", {
          class: selectedClass,
        });

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

const Canvas = forwardRef(
  ({ tool, brushSize, imageUrl, selectedClass, classes }: CanvasProps, ref) => {
    const mainCanvasRef = useRef<FabricCanvas>();
    const containerRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<CanvasState[]>([]);
    const currentPolygonPoints = useRef<Circle[]>([]);
    const currentPolygonLines = useRef<Line[]>([]);
    const isRestoringState = useRef(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotationsOnTop, setShowAnnotationsOnTop] = useState(true);
    // References to event handlers so they can be removed
    const handleMouseDownRef = useRef<(options: fabric.IEvent) => void>();
    const handlePathCreatedRef = useRef<(e: {path: Path}) => void>();
   
    const [showAnnotations, setShowAnnotations] = useState(false);
    const [imageId, setImageId] = useState<number | null>(null);

 
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
    
      const canvas = mainCanvasRef.current;
    
      // 1) Pop the newest state
      const lastState = historyRef.current.pop();
      if (!lastState?.objects?.length) {
        isRestoringState.current = false;
        return;
      }
    
      // 2) Check the last state's last object's type
      const lastObj = lastState.objects[lastState.objects.length - 1];
      const lastObjType = (lastObj as { type?: string })?.type;
    
      // 3) If removed object was a polygon, keep popping states until you find another polygon or path
      if (lastObjType === "Polygon") {
        while (historyRef.current.length > 0) {
          const peekState = historyRef.current[historyRef.current.length - 1];
          if (!peekState?.objects?.length) break;
    
          const peekObj = peekState.objects[peekState.objects.length - 1];
          const peekObjType = (peekObj as { type?: string })?.type;
    
          if (peekObjType === "Polygon" || peekObjType === "Path") {
            break; // Stop popping as soon as we see a polygon or path
          }
          historyRef.current.pop();
        }
      }
    
      // 4) Also remove the last annotation if it's a polygon or path
      if (lastObjType === "Polygon" || lastObjType === "Path") {
        setAnnotations((prev) => prev.slice(0, -1));
      }
    
      // 5) Clear the canvas and load the now-top previous state
      clearCanvas();

      // 3) Get the previous state
      const prevState = historyRef.current[historyRef.current.length - 1];
      if (!prevState?.objects) {
        isRestoringState.current = false;
        return;
      }

      // 4) Re-create objects on canvas
      void util.enlivenObjects(prevState.objects).then((objs) => {
        objs.forEach((obj) => canvas.add(obj as FabricObject));
        canvas.renderAll();

        // 5) Rebuild "annotations" by scanning the newly added objects
        const newAnnotations: Annotation[] = [];
        for (const obj of canvas.getObjects()) {
          // Assume you store class info in obj.data?.class, and need .type to decide
          if (obj.type === "polygon") {
            newAnnotations.push({ type: "polygon", class:getClassFromColor(classes, obj?.stroke as string)!, object: obj });
          } else if (obj.type === "path") {
            newAnnotations.push({ type: "path", class: getClassFromColor(classes, obj?.stroke as string )!, object: obj });
          }
        }
        setAnnotations(newAnnotations);

        // Undo is complete; resume saving states normally
        isRestoringState.current = false;
      });
    };

    // 1) Remove temporary objects (lines/circles)
    function removeTemporaryObjects(canvas: FabricCanvas) {
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => obj.type === "line" || obj.type === "circle");
      objectsToRemove.forEach((obj) => canvas.remove(obj));
    }

    function exportToCOCO() {
      const canvas = mainCanvasRef.current;
      if (!canvas) {
        alert("Canvas is not initialized.");
        return;
      }
      removeTemporaryObjects(canvas);
      const categoryMap = createCategoryMap(classes);
      const annotationsData = buildAnnotationsData(annotations, categoryMap, imageId);
      const cocoData = buildCOCOData(canvas, annotationsData, classes, categoryMap, imageId);
      const validation = validateCOCO(cocoData);
      if (!validation.success) {
        toast.error(validation.message);
        console.log(validation.details);
        return;
      }
      toast.success("COCO data is valid");
      downloadJSONData(cocoData, "annotations.json");
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
        setupBrushTool(canvas, brushSize, selectedClass, setAnnotations, handlePathCreatedRef);
      } else if (tool === "polygon") {
        setupPolygonTool(
          canvas,
          selectedClass,
          currentPolygonPoints,
          currentPolygonLines,
          setAnnotations,
          handleMouseDownRef
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
        saveCanvasState()
        canvas.renderAll();
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
                    if (index >= 0 && index < objects.length && objects[index]) {
                      objects[index].set("opacity", 0.6);
                      canvas.renderAll();
                      // remove the last state
                      historyRef.current.pop();
                    }
                  }}
                  onMouseLeave={() => {
                    const canvas = mainCanvasRef.current;
                    if (!canvas) return;

                    const objects = canvas.getObjects();
                    if (index >= 0 && index < objects.length && objects[index]) {
                      objects[index].set("opacity", 1);
                      canvas.renderAll();
                      // remove the last state
                      historyRef.current.pop();
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
