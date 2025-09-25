// Class Transformer
import { Exclude } from 'class-transformer';

// NestJS Libraries
import { ApiProperty } from '@nestjs/swagger';

export abstract class AppBaseEntity {
  @ApiProperty()
  public id: string;

  /*
   * Create, Update and Delete Date Columns
   */
  @ApiProperty()
  public createdAt: number;

  @ApiProperty()
  public createdBy: string;

  @Exclude()
  public createdById: string;

  @ApiProperty()
  public updatedAt: number;

  @ApiProperty()
  public updatedBy: string;

  @Exclude()
  public updatedById: string;

  @ApiProperty()
  public deletedAt: number | null;

  @ApiProperty()
  public deletedBy: string;

  @Exclude()
  public deletedById: string;
}
