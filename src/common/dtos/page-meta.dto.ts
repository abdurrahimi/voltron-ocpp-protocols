import { ApiProperty } from '@nestjs/swagger';

export class PageMetaDto {
  @ApiProperty()
  public readonly hasPreviousPage?: boolean = false;

  @ApiProperty()
  public readonly hasNextPage?: boolean = false;

  @ApiProperty()
  public page: number;

  @ApiProperty()
  public readonly pageCount: number;

  @ApiProperty()
  public total: number;

  @ApiProperty()
  public totalData: number;

  @ApiProperty()
  public size: number;

  constructor(data: IConstructPageMeta) {
    this.totalData = data.totalData;
    this.total = data.total;
    this.size = data.size;
    this.page = data.page;
    this.pageCount = Math.ceil(this.totalData / this.size);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}
