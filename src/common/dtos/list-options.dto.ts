// Class Transformer
import { Transform, Type } from 'class-transformer';

// Class Validators
import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

// Constants
import { TRUE_VALUE } from '../constants/common.constant';

// NestJS Libraries
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListOptionDto {
  @ApiPropertyOptional()
  @ValidateIf((o) => o.isDeleted)
  @IsOptional()
  @Transform(({ value }) => TRUE_VALUE.includes(value))
  public isDeleted?: boolean = false;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public limit: number = 10;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public offset: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  public search: string;

  @ApiPropertyOptional({
    example: 'createdAt|DESC',
  })
  @IsOptional()
  @ValidateIf((o) => o.sort)
  public sortBy: string[] = ['createdAt|DESC'];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.disablePaginate)
  @Transform(({ value }) => TRUE_VALUE.includes(value))
  public disablePaginate?: boolean = false;

  /**
   * @description Define getter for get skip value from offset and limit
   */
  get skip(): number {
    const offset = this.offset ?? 1;
    const limit = this.limit ?? 10;

    return (offset - 1) * limit;
  }
}
