// NestJS Libraries
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

// Passport
import { ExtractJwt, Strategy } from 'passport-jwt';

// Services
import { JwtConfigService } from 'src/configurations/jwt/jwt-configuration.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly _jwtConfigService: JwtConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: _jwtConfigService.jwtSecret,
    });
  }

  async validate(payload: IValidateJWTStrategy) {
    return { id: payload.sub, name: payload.name };
  }
}
