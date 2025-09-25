// DTOs
import { BaseResponseDto } from '../dtos/base-response.dto';

// NestJS Libraries
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';

// RxJS
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CustomBaseResponseInterceptor<T>
  implements NestInterceptor<T, BaseResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || !data) {
          return data;
        }

        return new BaseResponseDto<T>({
          statusCode: data.statusCode
            ? data.statusCode
            : context.switchToHttp().getResponse().statusCode,
          message: data.message ? data.message : '',
          data: data.result,
        });
      }),
    );
  }
}
