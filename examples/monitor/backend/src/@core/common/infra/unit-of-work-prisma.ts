import { PrismaManager } from '@core/saga/infra/prisma/prisma-manager';
import { RunTransactionProps, UnitOfWork } from '@core/common/application/unit-of-work';

export class PrismaUnitOfWork extends UnitOfWork {
  constructor(private readonly prisma: PrismaManager) {
    super();
  }

  async runTransaction<T>(props: RunTransactionProps, fn: () => Promise<T>): Promise<T> {
    return this.prisma.runTransaction(props, fn);
  }
}
