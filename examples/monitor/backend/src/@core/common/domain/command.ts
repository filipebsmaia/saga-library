import { UseCase } from './use-case';

export abstract class Command<T, R = void> extends UseCase<T, R> {}
