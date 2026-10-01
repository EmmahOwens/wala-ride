-- ============================================================================
-- LOCAL DEVELOPMENT & CI TEST SEED DATA
-- ============================================================================

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES 
  (
    '15800568-a314-4291-ae3f-29ce3c11d44d',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'driver_1790705109500@gmail.com',
    '$2a$10$123456789012345678901uOqVkWLg7yLhVjYg3qS5M.JvN1hW8G1e',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Walugembe","last_name":"David"}',
    now(),
    now()
  ),
  (
    '0780e6a2-f543-44f2-8e37-111c944003d0',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test.passenger@walaride.com',
    '$2a$10$123456789012345678901uOqVkWLg7yLhVjYg3qS5M.JvN1hW8G1e',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Mbayo","last_name":"Emmanuel"}',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, role, first_name, last_name, phone)
VALUES
  ('15800568-a314-4291-ae3f-29ce3c11d44d', 'driver', 'Walugembe', 'David', '+256700000001'),
  ('0780e6a2-f543-44f2-8e37-111c944003d0', 'passenger', 'Mbayo', 'Emmanuel', '+256700000002')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone;

INSERT INTO user_roles (user_id, role)
VALUES
  ('15800568-a314-4291-ae3f-29ce3c11d44d', 'admin'),
  ('15800568-a314-4291-ae3f-29ce3c11d44d', 'driver'),
  ('0780e6a2-f543-44f2-8e37-111c944003d0', 'passenger')
ON CONFLICT (user_id, role) DO NOTHING;
