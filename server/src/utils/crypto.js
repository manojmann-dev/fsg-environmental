import crypto from 'node:crypto';
const algorithm = 'aes-256-gcm';
function getKey() {
  const value = process.env.EMAIL_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('EMAIL_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.');
  return Buffer.from(value, 'hex');
}
export function encryptSecret(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}
export function decryptSecret(value) {
  if (!value) return '';
  const [ivHex, tagHex, dataHex] = value.split(':');
  const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
