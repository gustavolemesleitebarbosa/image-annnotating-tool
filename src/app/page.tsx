"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import ColorPicker from "~/components/ColorPicker/ColorPicker";
import { type Class } from "~/Types/Class";
import ClassPicker from "~/components/ClassPicker/ClassPicker";

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

export default function Home() {
  const [tool, setTool] = useState<"brush" | "polygon" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<Class[]>([]);
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassColor, setNewClassColor] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>(initialClasses);
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

  return (
    <div className="flex h-screen w-screen flex-col">
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
          <button className="mb-4 rounded bg-gray-200 p-2">
            Add a new Class
          </button>
          <div className="relative bottom-64 left-24">
            {/* <ColorPicker/> */}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1">
          <Canvas selectedClass={selectedClass} tool={tool} brushSize={brushSize} imageUrl={imageUrl} />
        </div>
      </div>
    </div>
  );
}
