import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalStorageDriver } from "./local-storage.driver.js";
import { S3StorageDriver } from "./s3-storage.driver.js";
import type { StorageDriver, StoredFile } from "./storage.interface.js";

@Injectable()
export class StorageService implements StorageDriver {
  private readonly driver: StorageDriver;

  constructor(
    config: ConfigService,
    local: LocalStorageDriver,
    s3: S3StorageDriver
  ) {
    this.driver = config.get<string>("UPLOADS_DRIVER", "local") === "s3" ? s3 : local;
  }

  save(file: Express.Multer.File): Promise<StoredFile> {
    return this.driver.save(file);
  }
}
