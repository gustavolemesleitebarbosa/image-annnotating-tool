"use client";

import { useEffect, useRef } from 'react';
import { Canvas as FabricCanvas,  FabricImage, PencilBrush } from 'fabric';

interface CanvasProps {
  tool: 'brush' | 'polygon' | 'eraser';
  brushSize: number;
  imageUrl: string | null;
}

const Canvas = ({ tool, brushSize, imageUrl }: CanvasProps) => {
  const canvasRef = useRef<FabricCanvas>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Initialize Fabric canvas with explicit dimensions
    canvasRef.current = new FabricCanvas('canvas', {
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      backgroundColor: '#f0f0f0',
      isDrawingMode: true,
    });

    // Initialize the brush
    const brush = new PencilBrush(canvasRef.current);
    canvasRef.current.freeDrawingBrush = brush;

    // Cleanup
    return () => {
      void canvasRef.current?.dispose();
    };
  }, []);

  // Handle image loading
  useEffect(() => {
    const loadImage = async () => {
      if (!imageUrl || !canvasRef.current) return;

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
        canvasRef.current.clear();

        // Get canvas dimensions
        const canvasWidth = canvasRef.current.getWidth();
        const canvasHeight = canvasRef.current.getHeight();

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
        canvasRef.current.add(fabricImage);
        canvasRef.current.renderAll();

      } catch (error) {
        console.error('Error loading image:', error);
      }
    };

    void loadImage();
  }, [imageUrl]);

  // Handle tool changes
  useEffect(() => {
    if (!canvasRef.current) return;

    if (tool === 'eraser') {
      canvasRef.current.isDrawingMode = true;
      const brush = new PencilBrush(canvasRef.current);
      brush.width = brushSize;
      brush.color = '#f0f0f0';
      canvasRef.current.freeDrawingBrush = brush;
    } else if (tool === 'brush') {
      canvasRef.current.isDrawingMode = true;
      const brush = new PencilBrush(canvasRef.current);
      brush.width = brushSize;
      brush.color = '#000000';
      canvasRef.current.freeDrawingBrush = brush;
    } else {
      canvasRef.current.isDrawingMode = false;
    }
  }, [tool, brushSize]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative min-h-[600px]"
      style={{ touchAction: 'none' }}
    >
      <canvas id="canvas" />
    </div>
  );
};

export default Canvas;