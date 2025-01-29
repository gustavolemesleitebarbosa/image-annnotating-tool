"use client";

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// We'll need to use dynamic import for the Canvas component because Fabric.js 
// requires window object which isn't available during SSR
const Canvas = dynamic(() => import('../components/Canvas/Canvas'), {
  ssr: false
});

export default function Home() {
  const [tool, setTool] = useState<'brush' | 'polygon' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
    console.log('Export clicked');
  };

  const buttonClass = (isActive: boolean) => `
    w-full p-2 rounded 
    ${isActive ? 'bg-[#f5f5dc]' : 'bg-gray-200'} 
    hover:bg-[#f5f5dc]
  `;

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <div className="w-full bg-white shadow-sm p-4 flex justify-end border-b">
        <button
          onClick={handleExport}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-[#f5f5dc]"
        >
          Export COCO
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-white shadow-lg p-4 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Tools</h2>

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
              className="w-full p-2 rounded bg-gray-200 hover:bg-[#f5f5dc]"
            >
              Upload Image
            </button>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setTool('brush')}
              className={buttonClass(tool === 'brush')}
            >
              Brush
            </button>
            <button
              onClick={() => setTool('polygon')}
              className={buttonClass(tool === 'polygon')}
            >
              Polygon
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={buttonClass(tool === 'eraser')}
            >
              Eraser
            </button>
          </div>
          
          {(tool === 'brush' || tool === 'eraser') && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">
                {tool === 'brush' ? 'Brush' : 'Eraser'} Size: {brushSize}px
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
        </div>

        {/* Canvas Area */}
        <div className="flex-1">
          <Canvas
            tool={tool}
            brushSize={brushSize}
            imageUrl={imageUrl}
          />
        </div>
      </div>
    </div>
  );
}
