import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator.js";

/**
 * Checks the role attached to the request by a membership guard
 * (WorkspaceMemberGuard or BoardMemberGuard) against @Roles(...) metadata.
 * Must run AFTER the relevant membership guard in @UseGuards() order.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role: string | undefined =
      request.boardMembership?.role ?? request.workspaceMembership?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException("Insufficient role for this action");
    }
    return true;
  }
}
