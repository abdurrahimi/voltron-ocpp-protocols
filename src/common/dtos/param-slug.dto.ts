// Class Validator
import { IsNotEmpty, IsString } from 'class-validator';

export class ParamSlugDto {
  @IsNotEmpty()
  @IsString()
  public slug: string;
}
