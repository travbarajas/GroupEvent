const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id: groupId, carId } = req.query;
  
  if (req.method === 'POST') {
    try {
      const { device_id } = req.body;
      
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

      // Check if car exists and belongs to this group
      const [car] = await sql`
        SELECT * FROM group_cars WHERE id = ${carId} AND group_id = ${groupId}
      `;

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      // Remove user from all cars in this group first (one car per user rule)
      await sql`
        DELETE FROM car_seat_assignments 
        WHERE member_device_id = ${device_id} 
        AND car_id IN (
          SELECT id FROM group_cars WHERE group_id = ${groupId}
        )
      `;

      // Find the first available seat position
      const occupiedSeats = await sql`
        SELECT seat_position FROM car_seat_assignments 
        WHERE car_id = ${carId}
        ORDER BY seat_position ASC
      `;

      let seatPosition = -1;
      const occupiedPositions = occupiedSeats.map(s => s.seat_position);
      
      for (let i = 0; i < car.capacity; i++) {
        if (!occupiedPositions.includes(i)) {
          seatPosition = i;
          break;
        }
      }

      if (seatPosition === -1) {
        return res.status(400).json({ error: 'Car is full' });
      }

      // Assign the seat
      const [assignment] = await sql`
        INSERT INTO car_seat_assignments (car_id, member_device_id, seat_position)
        VALUES (${carId}, ${device_id}, ${seatPosition})
        RETURNING *
      `;

      return res.status(201).json({ 
        success: true, 
        assignment: {
          carId: assignment.car_id,
          memberDeviceId: assignment.member_device_id,
          seatPosition: assignment.seat_position,
          assignedAt: assignment.assigned_at
        }
      });

    } catch (error) {
      console.error('Error assigning seat:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { device_id } = req.body;
      
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

      // Remove user's seat assignment from this car
      const deletedRows = await sql`
        DELETE FROM car_seat_assignments 
        WHERE car_id = ${carId} AND member_device_id = ${device_id}
        RETURNING *
      `;

      if (deletedRows.length === 0) {
        return res.status(404).json({ error: 'Seat assignment not found' });
      }

      // Compact remaining seats (shift left to fill gaps)
      const remainingSeats = await sql`
        SELECT * FROM car_seat_assignments 
        WHERE car_id = ${carId}
        ORDER BY seat_position ASC
      `;

      // Delete all current assignments
      await sql`DELETE FROM car_seat_assignments WHERE car_id = ${carId}`;

      // Re-insert with compacted positions
      for (let i = 0; i < remainingSeats.length; i++) {
        await sql`
          INSERT INTO car_seat_assignments (car_id, member_device_id, seat_position)
          VALUES (${carId}, ${remainingSeats[i].member_device_id}, ${i})
        `;
      }

      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('Error removing seat assignment:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};