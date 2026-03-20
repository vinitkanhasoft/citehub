# API Response Standard

This document defines the standard format for all API responses in the NestJS application.

## Standard Response Format

All successful API responses should follow this structure:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    // Response data here
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## Error Response Format

All error responses should follow this structure:

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Detailed error message",
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## Paginated Response Format

For endpoints that return lists of data, use this paginated format:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 0,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## HTTP Status Codes

- `200` - OK: Successful GET, PUT, PATCH requests
- `201` - Created: Successful POST request
- `204` - No Content: Successful DELETE request
- `400` - Bad Request: Invalid input data
- `401` - Unauthorized: Authentication required
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource not found
- `409` - Conflict: Resource already exists
- `422` - Unprocessable Entity: Validation failed
- `500` - Internal Server Error: Server-side error

## Response Examples

### Successful GET Request

```http
GET /api/users/123
Authorization: Bearer <token>

Response:
{
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": {
    "id": "123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "createdAt": "2023-12-07T10:00:00.000Z",
    "updatedAt": "2023-12-07T10:00:00.000Z"
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

### Successful POST Request

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith"
}

Response:
{
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "id": "456",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "createdAt": "2023-12-07T10:30:00.000Z",
    "updatedAt": "2023-12-07T10:30:00.000Z"
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

### Error Response

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "invalid-email",
  "password": "123"
}

Response:
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": [
    "email must be a valid email address",
    "password must be at least 6 characters long"
  ],
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

### Paginated Response

```http
GET /api/users?page=0&limit=10
Authorization: Bearer <token>

Response:
{
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "123",
      "email": "user1@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
    // ... more users
  ],
  "pagination": {
    "page": 0,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## Implementation Notes

- All responses are automatically formatted by the `ResponseInterceptor`
- Error responses are automatically formatted by the `HttpExceptionFilter`
- Timestamps are always in ISO 8601 format
- Pagination is 0-indexed
- All timestamps use UTC timezone
