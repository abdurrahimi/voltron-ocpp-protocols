export interface BaseResponseOptions<T> {
  statusCode: number;
  message: string;
  data: T;
}

export class BaseResponseDto<T> {
  public statusCode: number;
  public message: string;
  public data: T;

  constructor(data: BaseResponseOptions<T>) {
    this.statusCode = data.statusCode;
    this.message = data.message;
    this.data = data.data;
  }
}
