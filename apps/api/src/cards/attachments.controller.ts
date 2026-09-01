import { Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ResolveBoardFrom } from "../common/decorators/resolve-board-from.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { BoardMemberGuard } from "../common/guards/board-member.guard.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../uploads/storage.service.js";

@Controller("cards/:cardId/attachments")
@UseGuards(JwtAuthGuard, BoardMemberGuard, RolesGuard)
@ResolveBoardFrom("card")
@Roles("OWNER", "EDITOR")
export class AttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(@Param("cardId") cardId: string, @UploadedFile() file: Express.Multer.File) {
    const stored = await this.storage.save(file);
    return this.prisma.attachment.create({
      data: {
        cardId,
        url: stored.url,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        mimeType: stored.mimeType,
      },
    });
  }
}
