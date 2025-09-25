// NestJS LIbraries
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthenticationJWTGuard extends AuthGuard('jwt') {
  public canActivate(context: ExecutionContext) {
    // Add your custom authentication logic here
    // for example, call super.logIn(request) to establish a session.
    return super.canActivate(context);
  }

  public handleRequest(error: Error, user: any, info: string) {
    // You can throw an exception based on either "info" or "err" arguments
    if (error || !user) {
      console.log(`[ERROR] AuthenticationJWTGuard: ${info}`);
      throw error || new UnauthorizedException();
    }

    if (user.verified_at === null) {
      console.log(`[ERROR] AuthenticationJWTGuard: User not verified`);
      return new HttpException('User not verified', HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}
