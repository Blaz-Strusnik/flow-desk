export interface StoredFile {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageDriver {
  save(file: Express.Multer.File): Promise<StoredFile>;
}
