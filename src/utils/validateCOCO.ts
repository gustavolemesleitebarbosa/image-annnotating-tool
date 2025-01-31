import { z } from "zod";

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
