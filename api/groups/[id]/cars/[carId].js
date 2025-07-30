const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id: groupId, carId } = req.query;
  
  if (req.method === 'PUT') {
    try {
      const { device_id, name, capacity } = req.body;
      
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

      // Check if car exists and user is the creator
      const [car] = await sql`
        SELECT * FROM group_cars 
        WHERE id = ${carId} AND group_id = ${groupId} AND created_by_device_id = ${device_id}
      `;

      if (!car) {
        return res.status(404).json({ error: 'Car not found or you are not the creator' });
      }

      // Update car details
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (capacity !== undefined) {
        updates.capacity = capacity;
        
        // If capacity is reduced, remove seat assignments beyond the new capacity
        if (capacity < car.capacity) {
          await sql`
            DELETE FROM car_seat_assignments 
            WHERE car_id = ${carId} AND seat_position >= ${capacity}
          `;
        }
      }

      if (Object.keys(updates).length > 0) {
        const [updatedCar] = await sql`
          UPDATE group_cars 
          SET ${updates.name ? sql`name = ${updates.name},` : sql``}
              ${updates.capacity ? sql`capacity = ${updates.capacity},` : sql``}
              updated_at = NOW()
          WHERE id = ${carId}
          RETURNING *
        `;

        return res.status(200).json({ success: true, car: updatedCar });
      }

      return res.status(200).json({ success: true, car });

    } catch (error) {
      console.error('Error updating car:', error);
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

      // Check if car exists and user is the creator
      const [car] = await sql`
        SELECT * FROM group_cars 
        WHERE id = ${carId} AND group_id = ${groupId} AND created_by_device_id = ${device_id}
      `;

      if (!car) {
        return res.status(404).json({ error: 'Car not found or you are not the creator' });
      }

      // Delete the car (seat assignments will be automatically deleted due to CASCADE)
      await sql`DELETE FROM group_cars WHERE id = ${carId}`;
      
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('Error deleting car:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};