import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { UploadsModule } from "../uploads/uploads.module.js";
import { AttachmentsController } from "./attachments.controller.js";
import { CardsController } from "./cards.controller.js";
import { CardsService } from "./cards.service.js";
import { CommentsController } from "./comments.controller.js";

@Module({
  imports: [NotificationsModule, UploadsModule],
  controllers: [CardsController, CommentsController, AttachmentsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
