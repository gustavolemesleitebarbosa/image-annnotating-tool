import { z } from "zod";
import type { Class } from "~/Types/Class";
import {
  type FabricObject,
  type Path,
  type Polygon,
  type Canvas as FabricCanvas,
} from "fabric";
import { generateRandomId } from "~/utils/uuid";

export interface COCOAnnotation {
  id: number;
  image_id: number | null;
  category_id: number | null;
  segmentation: number[][];
  area: number;
  bbox: [number, number, number, number];
  iscrowd: number;
}

export type Annotation = {
  type: "polygon" | "path";
  class: Class | null;
  object: FabricObject;
};

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
  segmentation: z.array(
    z.union([z.array(z.number()), z.array(z.array(z.number()))]),
  ),
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
    cocoSchema.parse(data); // This will throw if data is invalid
    return { success: true, message: "Validation successful!" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Validation failed",
        details: error.errors,
      };
    }
    return { success: false, message: "Unexpected error during validation" };
  }
};

export function buildCOCOData(
  canvas: FabricCanvas,
  annotationsData: COCOAnnotation[],
  classes: Class[],
  categoryMap: Record<number, number>,
  imageId: number | null,
) {
  const licenseID = generateRandomId();
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

// 3) Build one annotation for a polygon
function buildPolygonAnnotation(
  polygon: Polygon,
  catId: number,
  imageId: number | null,
): COCOAnnotation {
  const points = polygon.points ?? [];

  // Flatten points => [x1,y1, x2,y2, ...]
  const segmentation = points.flatMap((pt) => [pt.x, pt.y]);

  // Shoelace area
  const area = Math.abs(
    points.reduce((sum, point, i, arr) => {
      const next = arr[(i + 1) % arr.length];
      return sum + (point.x * (next?.y ?? 0) - (next?.x ?? 0) * point.y);
    }, 0) / 2,
  );

  return {
    id: generateRandomId(),
    image_id: imageId ?? null,
    category_id: catId ?? null,
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

// 4) Build one annotation for a path
export function buildPathAnnotation(
  pathObj: Path,
  catId: number,
  imageId: number | null,
): COCOAnnotation {
  const pathData = pathObj.path ?? [];
  const points: [number, number][] = [];
  let currentX = 0;
  let currentY = 0;

  for (const command of pathData) {
    const [cmd, ...args] = command;
    switch (cmd) {
      case "M": {
        currentX = args[0] ?? 0;
        currentY = args[1] ?? 0;
        points.push([currentX, currentY]);
        break;
      }
      case "L": {
        currentX = args[0] ?? 0;
        currentY = args[1] ?? 0;
        points.push([currentX, currentY]);
        break;
      }
      case "C": {
        const [x, y] = args.slice(-2);
        currentX = x ?? 0;
        currentY = y ?? 0;
        points.push([currentX, currentY]);
        break;
      }
      case "Q": {
        const [qx, qy] = args.slice(-2);
        currentX = qx ?? 0;
        currentY = qy ?? 0;
        points.push([currentX, currentY]);
        break;
      }
      case "Z": {
        if (points.length > 0) {
          points.push(points?.[0] ?? [0, 0]);
        }
        break;
      }
      default:
        break;
    }
  }

  const segmentation = points.flatMap(([x, y]) => [x, y]);
  const area = Math.abs(
    points.reduce((sum, point, i, arr) => {
      const next = arr[(i + 1) % arr.length];
      if (!next) return sum;
      return sum + (point[0] * next[1] - next[0] * point[1]);
    }, 0) / 2,
  );

  const boundingRect = pathObj.getBoundingRect();

  return {
    id: generateRandomId(),
    image_id: imageId ?? null,
    category_id: catId ?? null,
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

// 5) Build the annotations array (polygon or path)
export function buildAnnotationsData(
  annotations: Annotation[],
  categoryMap: Record<number, number>,
  imageId: number | null,
): COCOAnnotation[] {
  return annotations
    .map((annotation) => {
      if (annotation.type === "polygon") {
        const polygon = annotation.object as Polygon;
        const catId = annotation.class ? categoryMap[annotation.class.id] ?? null : null;
        return buildPolygonAnnotation(polygon, catId ?? 0, imageId ?? 0);
      }

      if (annotation.type === "path") {
        const pathObj = annotation.object as Path;
        const catId = annotation.class ? categoryMap[annotation.class.id] : 0;
        return buildPathAnnotation(pathObj, catId ?? 0, imageId ?? 0);
      }

      // Return null for unsupported types, filtered out below
      return null;
    })
    .filter((anno): anno is COCOAnnotation => anno !== null);
}

export function createCategoryMap(classes: Class[]): Record<number, number> {
  const categoryMap: Record<number, number> = {};
  classes.forEach((cls) => {
    categoryMap[cls.id] = generateRandomId();
  });
  return categoryMap;
}

export function downloadJSONData<T extends object>(jsonData: T, fileName: string) {
  const dataStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
