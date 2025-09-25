// Class Validator
import { IsUUID } from 'class-validator';

// NestJS Libraries
import { ApiProperty } from '@nestjs/swagger';

export class ParamIdDto {
  @ApiProperty()
  @IsUUID()
  public id: string;
}
