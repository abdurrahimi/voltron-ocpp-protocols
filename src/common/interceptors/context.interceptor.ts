// NestJS Libraries
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

// RxJS
import { Observable } from 'rxjs';

/**
 * https://stackoverflow.com/questions/55481224/nestjs-how-to-access-both-body-and-param-in-custom-validator
 * Injects request data into the context, so that the ValidationPipe can use it.
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (!request.body) {
      request.body = {};
    }

    request.body.context = {
      params: request.params,
      query: request.query,
      user: request.user,
    };

    return next.handle();
  }
}
