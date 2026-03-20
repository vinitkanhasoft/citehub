export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
}

export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  password: 'testPassword123',
  ...overrides,
});

export const createTestAdmin = (overrides: Partial<TestUser> = {}): TestUser => 
  createTestUser({
    id: 'test-admin-id',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  });

export const TEST_USERS = {
  user: createTestUser(),
  admin: createTestAdmin(),
} as const;
