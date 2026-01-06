import { z } from 'zod';

export const TileSchema = z.number().int().min(0);

export const ObjectEntitySchema = z.object({
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  properties: z.record(z.string(), z.any()).optional(),
});

export const MapDataSchema = z.object({
  name: z.string(),
  version: z.string(),
  width: z.number().int().positive(), // in tiles
  height: z.number().int().positive(), // in tiles
  tileSize: z.number().int().positive(),
  layers: z.object({
    floor: z.array(z.array(TileSchema)),
    walls: z.array(z.array(TileSchema)),
  }),
  objects: z.array(ObjectEntitySchema).optional(),
});

export type MapData = z.infer<typeof MapDataSchema>;
export type MapObject = z.infer<typeof ObjectEntitySchema>;