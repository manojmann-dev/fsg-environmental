
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';

dotenv.config({ path: '../.env' });

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing in the root .env file.');
    }

    const email = (
      await rl.question('Enter your admin email: ')
    ).trim().toLowerCase();

    const password = await rl.question(
      'Enter your new password (minimum 12 characters): '
    );

    if (!email || password.length < 6) {
      throw new Error('Valid email and a password of at least 6 characters are required.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const { AdminUser } = await import('./src/models/index.js');

    const user = await AdminUser.findOne({ email });

    if (!user) {
      throw new Error('Admin account not found. No account was created.');
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    console.log('\nSUCCESS: Admin password updated.');
    console.log('Admin email:', user.email);
    console.log('You can now sign in with your new password.');

  } catch (error) {
    console.error('\nPASSWORD RESET FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

main();
