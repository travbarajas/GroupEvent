const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id: groupId } = req.query;
  
  if (req.method === 'GET') {
    try {
      const { device_id, event_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get all cars for this group/event with seat assignments
      let cars = [];
      
      try {
        const rawCars = await sql`
          SELECT 
            gc.id,
            gc.name,
            gc.capacity,
            gc.created_by_device_id,
            gc.created_at,
            gc.updated_at
          FROM group_cars gc
          WHERE gc.group_id = ${groupId}
          ${event_id ? sql`AND (gc.event_id = ${event_id} OR gc.event_id IS NULL)` : sql``}
          ORDER BY gc.created_at ASC
        `;

        // For each car, get seat assignments
        for (const car of rawCars) {
          const seatAssignments = await sql`
            SELECT member_device_id, seat_position
            FROM car_seat_assignments
            WHERE car_id = ${car.id}
            ORDER BY seat_position ASC
          `;

          // Create seats array with assigned members
          const seats = Array(car.capacity).fill(null);
          seatAssignments.forEach(assignment => {
            if (assignment.seat_position < car.capacity) {
              seats[assignment.seat_position] = assignment.member_device_id;
            }
          });

          cars.push({
            id: car.id,
            name: car.name,
            capacity: car.capacity,
            seats,
            createdBy: car.created_by_device_id,
            createdAt: car.created_at,
            updatedAt: car.updated_at
          });
        }
      } catch (tableError) {
        console.log('Table query error, returning empty cars:', tableError.message);
        cars = [];
      }
      
      return res.status(200).json({ cars });
    } catch (error) {
      console.error('Error fetching group cars:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request received for groupId:', groupId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { device_id, name, capacity, event_id } = req.body;
      
      if (!device_id) {
        console.log('Missing device_id');
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!name || !capacity) {
        console.log('Missing required fields:', { name, capacity });
        return res.status(400).json({ error: 'name and capacity are required' });
      }

      console.log('Checking membership for device_id:', device_id, 'in group:', groupId);
      
      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        console.log('User not a member of group');
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      console.log('Membership verified, creating car...');

      // Create the car
      const [newCar] = await sql`
        INSERT INTO group_cars (group_id, event_id, name, capacity, created_by_device_id)
        VALUES (${groupId}, ${event_id || null}, ${name}, ${capacity}, ${device_id})
        RETURNING *
      `;

      console.log('Car created:', newCar);
      
      return res.status(201).json({ 
        success: true, 
        car: {
          id: newCar.id,
          name: newCar.name,
          capacity: newCar.capacity,
          seats: Array(newCar.capacity).fill(null),
          createdBy: newCar.created_by_device_id,
          createdAt: newCar.created_at,
          updatedAt: newCar.updated_at
        }
      });

    } catch (error) {
      console.error('Error creating car:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack?.substring(0, 500)
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};