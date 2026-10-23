/*
# Create Customer Auth User and Link Seller to Store

## Purpose
1. Create the customer auth user (Mukhethwa Sydney) with email mulalo.ramagoma@capaciti.org.za
2. Update the seller's profile to ensure correct name, phone, and role
3. Link the seller (Ramagoma Mulalo Donald) to Meli's Collection demo store

## Security
- Uses a SECURITY DEFINER function to insert into auth.users (normally restricted)
- Password is hashed with bcrypt via pgcrypto's crypt() function
- The function is immediately dropped after use — no lingering privileged function
- No passwords are stored in the migration file — the password is passed as a function parameter
- The customer profile is created by the existing handle_new_user trigger on auth.users INSERT

## Idempotency
- Checks if user exists by email before creating
- Store link uses UPDATE ... WHERE seller_id IS NULL to avoid overwriting an existing seller
- Profile update uses ON CONFLICT (id) DO UPDATE

## Important Notes
1. The seller account (ramagomamd@outlook.com) was created by the user via the app's signup page
2. The seller profile already has role='seller' — this was set during a previous step
3. The customer account is created here because the user asked us to create both accounts
4. The password is NOT stored in this file — it is passed as a parameter to the function
*/
