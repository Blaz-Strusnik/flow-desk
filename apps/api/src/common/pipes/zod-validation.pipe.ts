import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodIssue, ZodType } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue: ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }))
      );
    }
    return result.data;
  }
}
