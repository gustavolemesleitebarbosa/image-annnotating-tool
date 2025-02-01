import { z } from "zod";
import type { Class } from "~/Types/Class";
import {
  type Canvas as FabricCanvas,
} from "fabric";
import { generateRandomId } from "~/utils/uuid";

export interface COCOAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  segmentation: number[][];
  area: number;
  bbox: [number, number, number, number];
  iscrowd: number;
}

// Define COCO Schema
const infoSchema = z.object({
  description: z.string(),
  url: z.string().url(),
  version: z.string(),
  year: z.number(),
  contributor: z.string(),
  date_created: z.string(),
});

const licenseSchema = z.object({
  url: z.string().url(),
  id: z.number(),
  name: z.string(),
});

const imageSchema = z.object({
  license: z.number(),
  file_name: z.string(),
  coco_url: z.string().url(),
  height: z.number(),
  width: z.number(),
  date_captured: z.string(),
  flickr_url: z.string().url(),
  id: z.number(),
});

const annotationSchema = z.object({
  segmentation: z.array(z.union([z.array(z.number()), z.array(z.array(z.number()))])),
  area: z.number(),
  iscrowd: z.number(),
  image_id: z.number(),
  bbox: z.array(z.number()).length(4), // Ensures bbox has exactly 4 numbers
  category_id: z.number(),
  id: z.number(),
});

const categorySchema = z.object({
  supercategory: z.string(),
  id: z.number(),
  name: z.string(),
});

// Main COCO Schema
const cocoSchema = z.object({
  info: infoSchema,
  licenses: z.array(licenseSchema),
  images: z.array(imageSchema),
  annotations: z.array(annotationSchema),
  categories: z.array(categorySchema),
});

// Utility function to validate COCO schema
export const validateCOCO = (data: unknown) => {
  try {
    cocoSchema.parse(data);  // This will throw if data is invalid
    return { success: true, message: "Validation successful!" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Validation failed", details: error.errors };
    }
    return { success: false, message: "Unexpected error during validation" };
  }
};



export function buildCOCOData(
  canvas: FabricCanvas,
  annotationsData: COCOAnnotation[],
  classes: Class[],
  categoryMap: Record<number, number>,
) {

  const licenseID = generateRandomId();
  const imageId = generateRandomId();
  const info = {
    description: "Sample dataset",
    url: "https://your-url.com",
    version: "1.0",
    year: new Date().getFullYear(),
    contributor: "Your Name",
    date_created: new Date().toISOString(),
  };

  const licenses = [
    {
      url: "https://creativecommons.org/licenses/by/4.0/",
      id: licenseID,
      name: "Creative Commons Attribution 4.0 International",
    },
  ];

  const images = [
    {
      license: licenseID,
      file_name: "image.jpg",
      coco_url: "https://example.com/coco-url",
      height: canvas.getHeight(),
      width: canvas.getWidth(),
      date_captured: new Date().toISOString(),
      flickr_url: "https://www.flickr.com/photos/tags/flicker/",
      id: imageId,
    },
  ];

  const categories = classes.map((cls) => ({
    supercategory: "none",
    id: categoryMap[cls.id],
    name: cls.name,
  }));

  return {
    info,
    licenses,
    images,
    annotations: annotationsData,
    categories,
  };
}