const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database later)
const groups = new Map();
const members = new Map(); // memberId -> member data
const groupMembers = new Map(); // groupId -> Set of memberIds
const devices = new Map(); // deviceId -> { device_id, fingerprint, created_at, linked_user }
const fingerprints = new Map(); // fingerprint -> deviceId (for fast lookups)

// Generate short group IDs for links
function generateGroupId() {
  return Math.random().toString(36).substring(2, 8).toLowerCase();
}

// --- GROUP ENDPOINTS ---

// Create new group
app.post('/api/groups', (req, res) => {
  const { name, description, creatorId } = req.body;
  
  if (!name || !creatorId) {
    return res.status(400).json({ error: 'Name and creatorId are required' });
  }

  const groupId = generateGroupId();
  const group = {
    id: groupId,
    name,
    description: description || '',
    creatorId,
    createdAt: new Date(),
    memberCount: 1
  };

  groups.set(groupId, group);
  groupMembers.set(groupId, new Set([creatorId]));

  res.status(201).json({
    group,
    joinLink: `${req.protocol}://${req.get('host')}/group/${groupId}`
  });
});

// Get group details
app.get('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const group = groups.get(id);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Get member details
  const memberIds = Array.from(groupMembers.get(id) || []);
  const groupMemberDetails = memberIds.map(memberId => members.get(memberId)).filter(Boolean);

  res.json({
    ...group,
    members: groupMemberDetails,
    memberCount: groupMemberDetails.length
  });
});

// --- MEMBER ENDPOINTS ---

// Join group (create member)
app.post('/api/groups/:id/members', (req, res) => {
  const { id: groupId } = req.params;
  const { name, avatar, deviceId } = req.body;

  if (!name || !deviceId) {
    return res.status(400).json({ error: 'Name and deviceId are required' });
  }

  const group = groups.get(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Check if this device already has a member in this group
  const existingMember = Array.from(members.values()).find(
    member => member.deviceId === deviceId && member.groupId === groupId
  );

  if (existingMember) {
    return res.json({ member: existingMember });
  }

  // Create new member
  const memberId = uuidv4();
  const member = {
    id: memberId,
    name,
    avatar: avatar || 'default',
    deviceId,
    groupId,
    joinedAt: new Date()
  };

  members.set(memberId, member);
  
  // Add to group
  if (!groupMembers.has(groupId)) {
    groupMembers.set(groupId, new Set());
  }
  groupMembers.get(groupId).add(memberId);

  // Update group member count
  group.memberCount = groupMembers.get(groupId).size;

  res.status(201).json({ member });
});

// Get member by device ID and group
app.get('/api/groups/:id/members/device/:deviceId', (req, res) => {
  const { id: groupId, deviceId } = req.params;
  
  const member = Array.from(members.values()).find(
    m => m.deviceId === deviceId && m.groupId === groupId
  );

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  res.json({ member });
});

// Update member
app.put('/api/members/:id', (req, res) => {
  const { id: memberId } = req.params;
  const { name, avatar } = req.body;

  const member = members.get(memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  if (name) member.name = name;
  if (avatar) member.avatar = avatar;

  res.json({ member });
});

// --- EVENTS ENDPOINTS (placeholder for later) ---

// Get group events
app.get('/api/groups/:id/events', (req, res) => {
  const { id: groupId } = req.params;
  
  if (!groups.has(groupId)) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // TODO: Return actual events
  res.json({ events: [] });
});

// --- UTILITY ENDPOINTS ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    groups: groups.size,
    members: members.size
  });
});

// --- DEVICE FINGERPRINT ENDPOINTS ---

// Register device with fingerprint
app.post('/api/devices/register', (req, res) => {
  const { device_id, fingerprint } = req.body;
  
  if (!device_id || !fingerprint) {
    return res.status(400).json({ 
      error: 'device_id and fingerprint are required' 
    });
  }

  try {
    // Store device info
    const deviceData = {
      device_id,
      fingerprint,
      created_at: new Date(),
      linked_user: null
    };
    
    devices.set(device_id, deviceData);
    fingerprints.set(fingerprint, device_id);
    
    console.log(`📱 Device registered: ${device_id} with fingerprint: ${fingerprint.substring(0, 10)}...`);
    
    res.status(201).json({
      success: true,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Find device by fingerprint
app.get('/api/devices/fingerprint/:fingerprint', (req, res) => {
  const { fingerprint } = req.params;
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'fingerprint is required' });
  }

  try {
    const deviceId = fingerprints.get(decodeURIComponent(fingerprint));
    
    if (!deviceId) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const deviceData = devices.get(deviceId);
    
    if (!deviceData) {
      return res.status(404).json({ error: 'Device data not found' });
    }
    
    console.log(`🔍 Found device for fingerprint: ${fingerprint.substring(0, 10)}... -> ${deviceId}`);
    
    res.json({
      device_id: deviceData.device_id,
      created_at: deviceData.created_at,
      linked_user: deviceData.linked_user
    });
  } catch (error) {
    console.error('Error finding device by fingerprint:', error);
    res.status(500).json({ error: 'Failed to find device' });
  }
});

// Link device to user (for future manual linking feature)
app.post('/api/devices/link', (req, res) => {
  const { device_id, fingerprint, username, pin } = req.body;
  
  if (!device_id || !fingerprint || !username || !pin) {
    return res.status(400).json({ 
      error: 'device_id, fingerprint, username, and pin are required' 
    });
  }

  try {
    // In a real app, you'd validate the PIN against the user
    // For now, just store the linking
    let deviceData = devices.get(device_id);
    
    if (!deviceData) {
      // Create new device record
      deviceData = {
        device_id,
        fingerprint,
        created_at: new Date(),
        linked_user: null
      };
      devices.set(device_id, deviceData);
      fingerprints.set(fingerprint, device_id);
    }
    
    // Link to user
    deviceData.linked_user = { username, pin, linked_at: new Date() };
    
    console.log(`🔗 Device linked: ${device_id} -> ${username}`);
    
    res.json({
      success: true,
      message: 'Device linked to user successfully'
    });
  } catch (error) {
    console.error('Error linking device to user:', error);
    res.status(500).json({ error: 'Failed to link device' });
  }
});

// Get device info (debug endpoint)
app.get('/api/devices/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  
  const deviceData = devices.get(deviceId);
  
  if (!deviceData) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json(deviceData);
});

// --- ERROR HANDLING ---

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TheRosevilleNewsletter API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;