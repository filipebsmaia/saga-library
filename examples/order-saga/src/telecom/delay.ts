const MIN_DELAY = parseInt(process.env.SAGA_DELAY_MIN ?? '5000', 10);
const MAX_DELAY = parseInt(process.env.SAGA_DELAY_MAX ?? '10000', 10);

export function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
