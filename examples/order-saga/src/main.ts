import './tracing';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log('\nTelecom Saga Examples running on http://localhost:3000');
  console.log('\nRecurring Billing:');
  console.log('  POST /recurrings                  — Trigger recurring (happy path)');
  console.log('  POST /recurrings?paymentFail=true — Payment rejection → compensation');
  console.log('  POST /recurrings?transient=true   — Transient error → retry exhausted');
  console.log('  GET  /recurrings                  — List all recurring records');
  console.log('  GET  /orders                      — List all orders');
  console.log('  GET  /products                    — List all products');
  console.log('\nSIM Swap (parent → sub-saga → parent resumes):');
  console.log('  POST /sim-swaps                   — Trigger SIM swap');
  console.log('  GET  /sim-swaps                   — List all SIM swaps');
  console.log('\nBulk Activation (fan-out / fan-in):');
  console.log('  POST /bulk-activations?lines=3    — Trigger bulk activation (1-10 lines)');
  console.log('  GET  /bulk-activations             — List all bulk activations');
  console.log('\nObservability:');
  console.log('  Saga Monitor → http://localhost:3000/monitor');
  console.log('  Jaeger UI    → http://localhost:16686');
  console.log('  Kafka UI     → http://localhost:8080\n');
}
bootstrap();
