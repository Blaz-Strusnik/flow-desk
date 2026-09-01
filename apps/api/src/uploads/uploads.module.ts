import { Module } from "@nestjs/common";
import { LocalStorageDriver } from "./local-storage.driver.js";
import { S3StorageDriver } from "./s3-storage.driver.js";
import { StorageService } from "./storage.service.js";

@Module({
  providers: [LocalStorageDriver, S3StorageDriver, StorageService],
  exports: [StorageService],
})
export class UploadsModule {}
