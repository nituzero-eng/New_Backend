const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../../data/users.json');

function loadUsersData() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Auth] Error loading users data:', err);
  }
  return { users: [], credentials: {} };
}

function saveUsersData(data) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Auth] Error saving users data:', err);
  }
}

function findUser(usernameOrEmail) {
  const data = loadUsersData();
  return data.users.find(u => u.username === usernameOrEmail || u.email === usernameOrEmail);
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = findUser(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const data = loadUsersData();
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
        connectedClouds: Object.keys(data.credentials[user.id] || {}),
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
    const { username, email, password, name, selectedClouds, credentials } = req.body;
    if (!username || !email || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (findUser(username) || findUser(email)) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    
    const validClouds = ['aws', 'azure', 'gcp'];
    const invalidClouds = (selectedClouds || []).filter(c => !validClouds.includes(c));
    if (invalidClouds.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid cloud providers: ${invalidClouds.join(', ')}` });
    }

    const data = loadUsersData();
    const newUser = { 
      id: `user-${Date.now()}`, 
      username, 
      email, 
      password, 
      name, 
      connectedClouds: selectedClouds || [] 
    };
    
    data.users.push(newUser);
    data.credentials[newUser.id] = {};
    
    // Save credentials provided during registration
    if (selectedClouds && selectedClouds.length > 0) {
      selectedClouds.forEach(cloud => {
        data.credentials[newUser.id][cloud] = {
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: (credentials && credentials[cloud]) ? credentials[cloud] : {}
        };
      });
    }

    saveUsersData(data);
    const token = generateToken(newUser);
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: newUser.id, username, name, email, connectedClouds: selectedClouds || [] },
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

    const data = loadUsersData();
    data.credentials[userId] = data.credentials[userId] || {};
    data.credentials[userId][cloud] = {
      connected: true,
      connectedAt: new Date().toISOString(),
      credentials: credentials || {},
    };
    
    // Update user's connectedClouds array if not present
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      if (!data.users[userIndex].connectedClouds) {
        data.users[userIndex].connectedClouds = [];
      }
      if (!data.users[userIndex].connectedClouds.includes(cloud)) {
        data.users[userIndex].connectedClouds.push(cloud);
      }
    }

    saveUsersData(data);
    const connectedClouds = Object.keys(data.credentials[userId]);

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
    const data = loadUsersData();
    const user = data.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const connectedClouds = Object.keys(data.credentials[userId] || {});
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
    const data = loadUsersData();
    
    if (data.credentials[userId]) {
      delete data.credentials[userId][cloud];
    }
    
    // Remove from user's connectedClouds array
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1 && data.users[userIndex].connectedClouds) {
      data.users[userIndex].connectedClouds = data.users[userIndex].connectedClouds.filter(c => c !== cloud);
    }
    
    saveUsersData(data);
    const connectedClouds = Object.keys(data.credentials[userId] || {});
    return res.json({ success: true, message: `${cloud.toUpperCase()} account removed`, connectedClouds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = { login, register, addCloudAccount, getProfile, removeCloudAccount };

