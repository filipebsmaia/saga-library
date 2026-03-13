export abstract class UseCase<T, R> {
  abstract execute(props: T): Promise<R>;
}
