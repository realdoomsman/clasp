import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql } from "../db.ts";
import { env } from "../env.ts";
import type { ImageUploadResponse } from "../types.ts";

/**
 * Coin images for the Pons `logo` field. The URL is written on chain at
 * launch and can never change, so images are content-addressed (sha256) and
 * served forever from our own origin.
 *
 * The declared content type is ignored: the format is sniffed from the bytes,
 * and only PNG, JPEG, GIF and WebP are accepted. SVG is refused outright —
 * it is a document that can carry script, not an image.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const FORMATS = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;
type Ext = keyof typeof FORMATS;

function sniff(bytes: Buffer): Ext | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const head = bytes.subarray(0, 12).toString("latin1");
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "webp";
  return null;
}

const ImageParams = z.object({ file: z.string().regex(/^[0-9a-f]{64}\.(png|jpg|gif|webp)$/) });

export async function imageRoutes(app: FastifyInstance) {
  // Uploading is launching a coin: a handful a minute is a person, more is
  // someone using us as free storage.
  app.post(
    "/api/images",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply): Promise<ImageUploadResponse | void> => {
      if (!request.isMultipart()) return reply.code(415).send({ error: "send the image as multipart/form-data" });
      const file = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } });
      if (!file) return reply.code(400).send({ error: "an image file is required" });
      const bytes = await file.toBuffer();
      if (file.file.truncated) return reply.code(413).send({ error: "image must be 2 MB or smaller" });
      const ext = sniff(bytes);
      if (!ext) return reply.code(400).send({ error: "image must be PNG, JPEG, GIF or WebP" });

      const sha = createHash("sha256").update(bytes).digest("hex");
      await sql`
        INSERT INTO images (sha256, mime, ext, bytes, size)
        VALUES (${sha}, ${FORMATS[ext]}, ${ext}, ${bytes}, ${bytes.length})
        ON CONFLICT (sha256) DO NOTHING
      `;
      return { url: `${env.publicApiUrl}/img/${sha}.${ext}` };
    },
  );

  app.get("/img/:file", async (request, reply) => {
    const parsed = ImageParams.safeParse(request.params);
    if (!parsed.success) return reply.code(404).send({ error: "not found" });
    const [sha, ext] = parsed.data.file.split(".");
    const [image] = await sql<{ mime: string; bytes: Buffer }[]>`
      SELECT mime, bytes FROM images WHERE sha256 = ${sha} AND ext = ${ext}
    `;
    if (!image) return reply.code(404).send({ error: "not found" });
    return reply
      .header("content-type", image.mime)
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("cross-origin-resource-policy", "cross-origin")
      .send(image.bytes);
  });
}
