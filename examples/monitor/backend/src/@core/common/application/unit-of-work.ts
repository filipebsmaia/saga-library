export interface RunTransactionProps {
  isolation?: 'required' | 'none';
  maxWait?: number;
  timeout?: number;
}

export abstract class UnitOfWork {
  abstract runTransaction<T>(props: RunTransactionProps, callback: () => Promise<T>): Promise<T>;
}
