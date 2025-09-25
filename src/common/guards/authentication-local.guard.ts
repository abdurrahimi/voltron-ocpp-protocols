// NestJS Libraries
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthenticationLocalGuard extends AuthGuard('local-auth') {}
