import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { StorageDriver, StoredFile } from "./storage.interface.js";

/** S3-compatible storage (real S3, R2, or local MinIO in dev — see the
 * commented minio service in docker-compose.yml). Selected via
 * UPLOADS_DRIVER=s3; needs S3_BUCKET/S3_REGION/S3_PUBLIC_URL (and
 * S3_ENDPOINT for non-AWS providers) set.
 *
 * Config is read lazily in save(), not the constructor: this driver is
 * always instantiated by StorageService's DI regardless of which driver
 * is actually selected, so it must not require S3 env vars to exist when
 * UPLOADS_DRIVER=local. */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  constructor(private readonly config: ConfigService) {}

  async save(file: Express.Multer.File): Promise<StoredFile> {
    const bucket = this.config.getOrThrow<string>("S3_BUCKET");
    const publicUrl = this.config.getOrThrow<string>("S3_PUBLIC_URL");
    const endpoint = this.config.get<string>("S3_ENDPOINT");

    const client = new S3Client({
      region: this.config.get<string>("S3_REGION", "auto"),
      endpoint,
      forcePathStyle: endpoint != null,
    });

    const key = `${randomUUID()}${extname(file.originalname)}`;
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype })
    );

    return {
      url: `${publicUrl.replace(/\/$/, "")}/${key}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }
}
