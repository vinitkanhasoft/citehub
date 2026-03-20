import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration to handle production and local environment
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://jsmglobe.com:8010',  // Local development
        'https://citehub.vercel.app',  // Production domain
        'http://localhost:8010',
        'http://127.0.0.1:63625'
      ];

      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);  // Allow the origin
      } else {
        callback(new Error('Not allowed by CORS'), false);  // Reject the origin
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allowed headers
    credentials: true,  // Allow credentials (cookies, authorization headers)
    preflightContinue: false,  // Handle OPTIONS requests automatically
    optionsSuccessStatus: 204,  // Legacy browser support (e.g., IE11)
  });

  // Enable global validation pipes
  app.useGlobalPipes(GlobalValidationPipe);

  // Swagger documentation configuration
  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .setVersion('1.0')
    .build();
  app.setGlobalPrefix('api');
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Start the application
  await app.listen(process.env.PORT ?? 5002);
}

bootstrap();



// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { GlobalValidationPipe } from './common/pipes/validation.pipe';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, {
//     cors: true,
//   });
//   app.useGlobalPipes(GlobalValidationPipe);

//   const config = new DocumentBuilder()
//     .setTitle('API Docs')
//     .setVersion('1.0')
//     .build();
//   app.setGlobalPrefix('api');
//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('docs', app, document);

//   await app.listen(process.env.PORT ?? 5002);
// }
// bootstrap();
