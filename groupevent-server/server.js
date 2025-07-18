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

// --- ERROR HANDLING ---

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GroupEvent API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;