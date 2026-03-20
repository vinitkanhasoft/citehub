# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database
- Supabase account (optional, for authentication)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration:
   - Database URL
   - Supabase credentials (if using)
   - JWT secret
   - Other environment variables

## Database Setup

1. Install Prisma CLI:
   ```bash
   npm install -g prisma
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Seed the database (optional):
   ```bash
   npx prisma db seed
   ```

## Running the Application

1. Start the development server:
   ```bash
   npm run start:dev
   ```

2. The API will be available at `http://localhost:3000`

## Testing

1. Run unit tests:
   ```bash
   npm run test
   ```

2. Run e2e tests:
   ```bash
   npm run test:e2e
   ```

3. Run tests with coverage:
   ```bash
   npm run test:cov
   ```

## API Documentation

- Import the `postman-collection.json` into Postman for API testing
- Swagger documentation available at `http://localhost:3000/api` when running

## Project Structure

The project follows a modular structure with:

- `src/avatar/` - Avatar management
- `src/users/` - User management
- `src/auth/` - Authentication
- `src/common/` - Shared utilities and components
- `src/prisma/` - Database service
- `src/supabase/` - Supabase integration
- `src/config/` - Configuration management

## Development Notes

- Use `npm run lint` to check code style
- Use `npm run format` to format code with Prettier
- Database schema is managed through Prisma
- Environment variables should never be committed to version control
