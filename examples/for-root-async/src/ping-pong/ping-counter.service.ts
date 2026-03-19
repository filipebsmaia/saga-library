import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class PingCounterService {
  private readonly logger = new Logger(PingCounterService.name);
  private count = 0;

  increment(): number {
    this.count++;
    this.logger.log(`Total pings processed: ${this.count}`);
    return this.count;
  }

  getCount(): number {
    return this.count;
  }
}
