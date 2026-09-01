import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(boardId: string, name: string, color: string) {
    return this.prisma.label.create({ data: { boardId, name, color } });
  }

  async list(boardId: string) {
    return this.prisma.label.findMany({ where: { boardId } });
  }

  /** Scoped by boardId too, so a member of board A can't delete a label
   * belonging to board B just by knowing its id. */
  async delete(boardId: string, labelId: string) {
    await this.prisma.label.deleteMany({ where: { id: labelId, boardId } });
  }
}
