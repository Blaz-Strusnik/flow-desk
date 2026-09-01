import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }

  async updateProfile(id: string, data: { name?: string; avatarUrl?: string | null }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }
}
