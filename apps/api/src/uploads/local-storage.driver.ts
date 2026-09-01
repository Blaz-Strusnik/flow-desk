import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { StorageDriver, StoredFile } from "./storage.interface.js";

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = config.get<string>("UPLOADS_LOCAL_DIR", "./uploads");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  async save(file: Express.Multer.File): Promise<StoredFile> {
    const filename = `${randomUUID()}${extname(file.originalname)}`;
    await writeFile(join(this.dir, filename), file.buffer);
    return {
      url: `/uploads/${filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }
}
