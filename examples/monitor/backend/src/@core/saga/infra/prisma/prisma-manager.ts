import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export interface RunTransactionProps {
  isolation?: 'required' | 'none';
  maxWait?: number;
  timeout?: number;
}

export class PrismaManager implements OnModuleInit, OnModuleDestroy {
  private readonly prisma = new PrismaClient();
  private asyncLocalStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  get client(): Prisma.TransactionClient | PrismaClient {
    const txClient = this.asyncLocalStorage.getStore();
    return txClient ?? this.prisma;
  }

  async runTransaction<T>(
    { isolation = 'required', maxWait, timeout }: RunTransactionProps,
    fn: () => Promise<T>,
  ): Promise<T> {
    const txClient = this.asyncLocalStorage.getStore();
    if (isolation === 'none' && txClient) {
      return this.asyncLocalStorage.run(txClient, async () => {
        return await fn();
      });
    }

    return this.prisma.$transaction(
      async (tx) => {
        return this.asyncLocalStorage.run(tx, async () => {
          return await fn();
        });
      },
      { maxWait, timeout },
    );
  }
}
