"use client";

import { useState, useRef, useEffect } from "react";
import ColorPicker from "~/components/ColorPicker/ColorPicker";
import { type Class } from "~/Types/Class";
import ClassPicker from "~/components/ClassPicker/ClassPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import toast, { Toaster } from "react-hot-toast";
import Canvas from "~/components/Canvas/Canvas";
import { generateRandomId } from "~/utils/uuid";

import {
  FaUpload,
  FaPaintBrush,
  FaDrawPolygon,
  FaEraser,
  FaUndo,
  FaDownload,
} from "react-icons/fa";

const initialClasses: Class[] = [
  {
    id: generateRandomId(),
    name: "Car",
    color: "#FF0000",
  },
  {
    id: generateRandomId(),
    name: "Tree",
    color: "#00FF00",
  },
  {
    id: generateRandomId(),
    name: "Road",
    color: "#0000FF",
  },
  {
    id: generateRandomId(),
    name: "Bicycle",
    color: "#800080",
  },
  {
    id: generateRandomId(),
    name: "Sky",
    color: "#87CEEB",
  },
  {
    id: generateRandomId(),
    name: "Sidewalk",
    color: "#808080",
  },
  {
    id: generateRandomId(),
    name: "Traffic Light",
    color: "#FFA500",
  },
];

const getInitialClasses = (): Class[] => {
  if (typeof window === "undefined") return initialClasses;

  const savedClasses = localStorage.getItem("classes");
  if (!savedClasses) {
    localStorage.setItem("classes", JSON.stringify(initialClasses));
    return initialClasses;
  }

  try {
    const parsed = JSON.parse(savedClasses) as Class[];
    if (!Array.isArray(parsed)) return initialClasses;
    return parsed;
  } catch {
    return initialClasses;
  }
};

export default function Home() {
  const [tool, setTool] = useState<"6rush" | "polygon" | "eraser" | null>(null);
  const [brushSize, setBrushSize] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassColor, setNewClassColor] = useState<string>("#ff0000");
  const [classes, setClasses] = useState<Class[]>(() => getInitialClasses());
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<{
    undo: () => void;
    exportToCOCO: () => void;
    toggleAnnotationsView: () => void;
  }>(null);

  // Sync with localStorage when classes change
  useEffect(() => {
    const handleStorageChange = () => {
      setClasses(getInitialClasses());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImageUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = () => {
    if (canvasRef.current) {
      canvasRef.current.exportToCOCO();
    } else {
      console.error("Canvas reference is not available.");
    }
  };

  const handleAddClass = () => {
    const previousTakenColors = classes.map(
      (classElement) => classElement.color,
    );

    if (!newClassName || !newClassColor) {
      toast.error("Please fill in both name and color");
      return;
    }
    if (previousTakenColors.includes(newClassColor)) {
      toast.error("Color already taken");
      return;
    }
    if (classes.some((c) => c.name.toLowerCase() === newClassName.toLowerCase())) {
      toast.error("Class name already exists");
      return;
    }

    const newClass: Class = {
      id: generateRandomId(),
      name: newClassName,
      color: newClassColor,
    };

    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    localStorage.setItem("classes", JSON.stringify(updatedClasses));
    setNewClassName("");
    setNewClassColor("#ff0000"); // reset to default color
    toast.success(`Class "${newClassName}" added successfully!`);
  };

  const undo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  };

  const handleSetTool = (tool: "brush" | "polygon" | "eraser") => {
    if ((tool === "polygon" || tool === "brush") && !selectedClass) {
      toast.error(`Please select a class before using the ${tool} tool`);
      return; // Prevents `setTool(tool)` from running
    }
    setTool(tool);
  };

  const buttonClass = (isActive: boolean) => `
    w-full flex items-center justify-center rounded text-xs md:text-sm h-8 md:h-12
    ${isActive ? "bg-black text-white" : "bg-gray-300 text-black"} 
    hover:bg-[#a2c2dc]
  `;

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toaster position="top-right" />
      {/* Header */}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-64 flex-col bg-white p-4 shadow-2xl">
          <h2 className="mb-4 text-xs text-sm font-bold md:text-lg">Classes</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button className={buttonClass(false)}>Add a new Class</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="name">Class Name</label>
                  <Input
                    id="name"
                    value={newClassName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewClassName(e.target.value)
                    }
                    placeholder="Enter class name"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="color">Class Color</label>
                  <div className="relative">
                    <Input
                      id="color"
                      value={newClassColor}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewClassColor(e.target.value)
                      }
                      placeholder="#000000"
                    />
                    <ColorPicker
                      color={newClassColor}
                      initialColor={newClassColor || "#ff0000"}
                      onChange={setNewClassColor}
                    />
                  </div>
                </div>
                <Button onClick={handleAddClass}>Add Class</Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="mt-4">
            <h5 className="mb-4 text-xs md:text-base">Select a Class </h5>

            <ClassPicker
              onClassSelect={(selectedClass) => {
                if (selectedClass) {
                  setSelectedClass(selectedClass);
                }
              }}
              selectedClass={selectedClass}
              classes={classes}
            />
          </div>

          <div className="mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <h2 className="mb-5 mt-6 border-t-2 border-gray-500 pt-2 text-xs font-bold md:text-lg">
              Upload
            </h2>

            <Button
              onClick={() => fileInputRef.current?.click()}
              className={buttonClass(false)}
            >
              <FaUpload color="black" className="mr-2" />
              Upload Image
            </Button>
          </div>
          <h2 className="mb-4 border-t-2 border-gray-500 pt-2 text-xs font-bold md:text-lg">
            Tools
          </h2>

          <div className="space-y-2">
            <Button
              onClick={() => handleSetTool("brush")}
              className={buttonClass(tool === "brush")}
            >
              <FaPaintBrush size={10} className="mr-2" />
              Brush
            </Button>
            <Button
              onClick={() => handleSetTool("polygon")}
              className={buttonClass(tool === "polygon")}
            >
              <FaDrawPolygon className="mr-2" />
              Polygon
            </Button>
            <Button onClick={undo} className={buttonClass(false)}>
              <FaUndo className="mr-2" />
              Undo
            </Button>
            <Button
              onClick={() => canvasRef.current?.toggleAnnotationsView()}
              className={buttonClass(tool === "eraser")}
            >
              <FaEraser className="mr-2" />
              Toggle Annotations View
            </Button>
          </div>

          {(tool === "brush" || tool === "eraser") && (
            <div className="mt-4">
              <label className="mb-2 block md:text-sm  text-xs font-medium">
                {tool === "brush" ? "Brush" : "Eraser"} Size: {brushSize}px
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          <h2 className="mb-4 mt-6 border-t-2 border-gray-500 pt-2 text-xs font-bold md:text-lg">
            Export
          </h2>
          <Button onClick={handleExport} className={buttonClass(false)}>
            <FaDownload className="mr-2" color="black" />
            Export COCO
          </Button>
        </div>
        <div className="flex-1 relative">
          <Canvas
            classes={classes}
            ref={canvasRef}
            tool={tool}
            brushSize={brushSize}
            imageUrl={imageUrl}
            selectedClass={selectedClass}
          />
        </div>
      </div>
    </div>
  );
}
