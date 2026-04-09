const jwt = require('jsonwebtoken');
const config = require('../../config/config');

/**
 * In-memory user store (replace with a database in production)
 * Passwords are plain for demo; in production use bcrypt
 */
const users = [
  {
    id: 'user-001',
    username: 'admin',
    email: 'admin@cloudoptimizer.local',
    password: 'admin123', // In production: hash with bcrypt
    name: 'Admin User',
    connectedClouds: [], // Will be populated on login/account addition
  },
  {
    id: 'user-002',
    username: 'demo',
    email: 'demo@cloudoptimizer.local',
    password: 'demo123',
    name: 'Demo User',
    connectedClouds: [],
  },
];

// Per-user cloud credentials store (in-memory; use DB in production)
const userCloudCredentials = {};

function findUser(usernameOrEmail) {
  return users.find(u => u.username === usernameOrEmail || u.email === usernameOrEmail);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: `${config.auth.sessionTimeoutHours}h` }
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { username, password, selectedClouds } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = findUser(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!selectedClouds || !Array.isArray(selectedClouds) || selectedClouds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one cloud provider' });
    }

    const validClouds = ['aws', 'azure', 'gcp'];
    const invalidClouds = selectedClouds.filter(c => !validClouds.includes(c));
    if (invalidClouds.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid cloud providers: ${invalidClouds.join(', ')}` });
    }

    // Store selected clouds for this user
    userCloudCredentials[user.id] = userCloudCredentials[user.id] || {};
    selectedClouds.forEach(cloud => {
      if (!userCloudCredentials[user.id][cloud]) {
        userCloudCredentials[user.id][cloud] = { connected: true, connectedAt: new Date().toISOString() };
      }
    });

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        connectedClouds: Object.keys(userCloudCredentials[user.id] || {}),
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { username, email, password, name } = req.body;
    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (findUser(username) || findUser(email)) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    const newUser = { id: `user-${Date.now()}`, username, email, password, name, connectedClouds: [] };
    users.push(newUser);
    const token = generateToken(newUser);
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, username, name, email, connectedClouds: [] },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── ADD CLOUD ACCOUNT ────────────────────────────────────────────────────────
async function addCloudAccount(req, res) {
  try {
    const userId = req.user.id;
    const { cloud, credentials } = req.body;

    const validClouds = ['aws', 'azure', 'gcp'];
    if (!validClouds.includes(cloud)) {
      return res.status(400).json({ success: false, message: `Invalid cloud: ${cloud}` });
    }

    userCloudCredentials[userId] = userCloudCredentials[userId] || {};
    userCloudCredentials[userId][cloud] = {
      connected: true,
      connectedAt: new Date().toISOString(),
      // In production: encrypt and store credentials securely
      credentials: credentials || {},
    };

    const connectedClouds = Object.keys(userCloudCredentials[userId]);

    return res.json({
      success: true,
      message: `${cloud.toUpperCase()} account connected successfully`,
      connectedClouds,
    });
  } catch (err) {
    console.error('[Auth] Add cloud account error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── GET PROFILE ──────────────────────────────────────────────────────────────
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const connectedClouds = Object.keys(userCloudCredentials[userId] || {});
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, connectedClouds },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ─── REMOVE CLOUD ACCOUNT ─────────────────────────────────────────────────────
async function removeCloudAccount(req, res) {
  try {
    const userId = req.user.id;
    const { cloud } = req.params;
    if (userCloudCredentials[userId]) {
      delete userCloudCredentials[userId][cloud];
    }
    const connectedClouds = Object.keys(userCloudCredentials[userId] || {});
    return res.json({ success: true, message: `${cloud.toUpperCase()} account removed`, connectedClouds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = { login, register, addCloudAccount, getProfile, removeCloudAccount };
