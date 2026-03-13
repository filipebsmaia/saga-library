export abstract class Metrics {
  abstract counter(name: string, value?: number, attributes?: Record<string, string | number>): void;
  abstract histogram(name: string, value: number, attributes?: Record<string, string | number>): void;
}
