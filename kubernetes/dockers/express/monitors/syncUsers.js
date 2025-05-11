require('dotenv').config();
const axios = require('axios');
const { prisma } = require('../prisma/prisma.js');
const { getAdminToken } = require('../libs/auth.js');

const { KC_HOSTNAME, KC_REALM } = process.env;

async function getKeycloakUsers(token) {
  const res = await axios.get(
    `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users?max=1000`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
}

async function syncUsers() {
  console.log('Users Sync: start');
  try {
    const tokenRes = await getAdminToken();
    if(!tokenRes.success)
        return console.error('Can not retrieve admin Token.');

    const keycloakUsers = await getKeycloakUsers(tokenRes.token);

    for (const kcUser of keycloakUsers) {
      const { id, username, email, enabled } = kcUser;

      const dbUser = await prisma.user.findUnique({ where: { id } });

      if (!dbUser) {
        await prisma.user.create({
          data: {
            id,
            username,
            email,
            enabled,
          },
        });
        continue;
      }

      if (
        dbUser.username !== username ||
        dbUser.email !== email ||
        dbUser.enabled !== enabled
      ) {
        await prisma.user.update({
          where: { id },
          data: {
            username,
            email,
            enabled,
          },
        });
      }
    }
		console.log('Users Sync: end');
  } catch (err) {
    console.error('Users sync error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
    syncUsers,
};