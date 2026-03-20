const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRegistration() {
  try {
    console.log('Testing user registration...');
    
    const testUser = {
      email: 'test@example.com',
      password: 'testPassword123',
      options: {
        data: {
          firstName: 'Test',
          lastName: 'User',
          role: 'user'
        }
      }
    };

    const { data, error } = await supabase.auth.signUp(testUser);
    
    if (error) {
      console.error('Registration failed:', error.message);
      return;
    }

    console.log('Registration successful:', data);
    
    // Test sign in
    console.log('\nTesting sign in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    if (signInError) {
      console.error('Sign in failed:', signInError.message);
      return;
    }

    console.log('Sign in successful:', signInData);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testRegistration();
