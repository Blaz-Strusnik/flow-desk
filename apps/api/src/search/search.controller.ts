import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard.js";
import { SearchService } from "./search.service.js";

@Controller("workspaces/:workspaceId/search")
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") query: string
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException("Query parameter 'q' is required");
    }
    return this.searchService.search(workspaceId, user.id, query.trim());
  }
}
