import { ValidationPipe } from '@nestjs/common';

export const GlobalValidationPipe = new ValidationPipe({
  whitelist: true, // ✅ strips properties that are not in the DTO
  forbidNonWhitelisted: true, // ❌ throws error if unknown properties are sent
  transform: true, // 🔄 auto-transforms payloads to match DTO classes
  transformOptions: {
    enableImplicitConversion: true, // ⚠️ allows primitive conversion (e.g., string -> number)
  },
});
