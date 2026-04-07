// Run once before first launch: node setup.js <username> <password>
// Example: node setup.js admin MySecurePassword123
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node setup.js <username> <password>');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 12);
  const secret = crypto.randomBytes(32).toString('hex');

  const env = `APP_USERNAME=${username}
APP_PASSWORD_HASH=${hash}
JWT_SECRET=${secret}
PORT=3000
`;

  fs.writeFileSync('.env', env);
  console.log(`.env created for user "${username}".`);
  console.log('Start the app with: npm start');
})();
