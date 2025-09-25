// NestJS Libraries
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

// Passport
import { Strategy } from 'passport-local';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local-auth') {
  constructor() {
    super();
  }

  async validate(username: string, password: string): Promise<any> {
    return { username, password };
  }
}
