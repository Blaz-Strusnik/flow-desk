import { Global, Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

/**
 * Makes PassportModule's providers (notably AuthModuleOptions, which
 * JwtAuthGuard/JwtRefreshGuard depend on) available in every module without
 * each feature module needing to import PassportModule itself.
 */
@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" })],
  exports: [PassportModule],
})
export class CommonModule {}
