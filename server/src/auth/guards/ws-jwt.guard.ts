import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const authHeader = client.handshake.headers?.authorization;
      
      if (!authHeader) {
        throw new WsException('Missing authorization header');
      }

      const token = authHeader.split(' ')[1];
      const payload = await this.jwtService.verifyAsync(token);
      
      // Attach user to client
      (client as any)['user'] = payload;
      
      return true;
    } catch (err) {
      this.logger.error(`WS Auth Error: ${err.message}`);
      throw new WsException('Unauthorized access');
    }
  }
}
