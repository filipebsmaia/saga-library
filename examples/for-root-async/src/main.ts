import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`\nforRootAsync example running on http://localhost:${port}`);
  console.log(`\n  POST /ping  — Start a ping-pong saga`);
  console.log(`  GET  /pongs — List completed pongs\n`);
}
bootstrap();
