"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import ColorPicker from "~/components/ColorPicker/ColorPicker";
import { type Class } from "~/Types/Class";
import ClassPicker from "~/components/ClassPicker/ClassPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import toast, { Toaster } from 'react-hot-toast';

const initialClasses: Class[] = [
  {
    id: 1,
    name: "Car",
    color: "#FF0000",
  },
  {
    id: 2,
    name: "Tree",
    color: "#00FF00",
  },
  {
    id: 3,
    name: "Road",
    color: "#0000FF",
  },
  {
    id: 6,
    name: "Bicycle",
    color: "#800080",
  },
  {
    id: 7,
    name: "Sky",
    color: "#87CEEB",
  },
  {
    id: 8,
    name: "Sidewalk",
    color: "#808080",
  },
  {
    id: 9,
    name: "Traffic Light",
    color: "#FFA500",
  },
];

// We'll need to use dynamic import for the Canvas component because Fabric.js
// requires window object which isn't available during SSR
const Canvas = dynamic(() => import("../components/Canvas/Canvas"), {
  ssr: false,
});

const getInitialClasses = (): Class[] => {
  if (typeof window === 'undefined') return initialClasses;
  
  const savedClasses = localStorage.getItem('classes');
  if (!savedClasses) {
    localStorage.setItem('classes', JSON.stringify(initialClasses));
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
  const [tool, setTool] = useState<"brush" | "polygon" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassColor, setNewClassColor] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>(() => getInitialClasses());
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // TODO: Implement export functionality
    console.log("Export clicked");
  };

  const buttonClass = (isActive: boolean) => `
    w-full p-2 rounded 
    ${isActive ? "bg-[#f5f5dc]" : "bg-gray-200"} 
    hover:bg-[#f5f5dc]
  `;

  const handleAddClass = () => {
    const previousTakenColors = classes.map(classElement => classElement.color);

    if (!newClassName || !newClassColor) {
      toast.error('Please fill in both name and color');
      return;
    }
    if (previousTakenColors.includes(newClassColor)) {
      toast.error('Color already taken');
      return;
    }

    if (!newClassName || !newClassColor) {
      toast.error('Please fill in both name and color');
      return;
    }
    
    const newClass: Class = {
      id: Math.max(...classes.map(c => c.id)) + 1,
      name: newClassName,
      color: newClassColor
    };
    
    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    localStorage.setItem('classes', JSON.stringify(updatedClasses));
    setNewClassName("");
    setNewClassColor("");
    toast.success(`Class "${newClassName}" added successfully!`);
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="flex w-full justify-end border-b bg-white p-4 shadow-sm">
        <button
          onClick={handleExport}
          className="rounded bg-gray-200 px-4 py-2 hover:bg-[#f5f5dc]"
        >
          Export COCO
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-64 flex-col bg-white p-4 shadow-lg">
          <h2 className="mb-4 text-lg font-bold">Tools</h2>

          <div className="mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded bg-gray-200 p-2 hover:bg-[#f5f5dc]"
            >
              Upload Image
            </button>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setTool("brush")}
              className={buttonClass(tool === "brush")}
            >
              Brush
            </button>
            <button
              onClick={() => setTool("polygon")}
              className={buttonClass(tool === "polygon")}
            >
              Polygon
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={buttonClass(tool === "eraser")}
            >
              Eraser
            </button>
          </div>

          {(tool === "brush" || tool === "eraser") && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
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
          <h2 className="mb-4 text-lg font-bold">Classes</h2>
          <h5 className="mb-4">Select a Class </h5>
          <ClassPicker
            onClassSelect={(selectedClass) => {
              if (selectedClass) {
                setSelectedClass(selectedClass);
              }
            }}
            selectedClass={selectedClass}
            classes={classes}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="mt-6 w-full">Add a new Class</Button>
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClassName(e.target.value)}
                    placeholder="Enter class name"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="color">Class Color</label>
                  <div className="relative">
                    <Input
                      id="color"
                      value={newClassColor}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClassColor(e.target.value)}
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
          <div className="relative bottom-64 left-24">
          </div>
        </div>
        <div className="flex-1">
          <Canvas selectedClass={selectedClass} tool={tool} brushSize={brushSize} imageUrl={imageUrl} />
        </div>
      </div>
    </div>
  );
}
