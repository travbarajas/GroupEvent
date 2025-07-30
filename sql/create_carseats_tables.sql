-- Car seats tables for GroupEvent app
-- Run this in Neon SQL editor to create the tables

-- Table for storing car/vehicle information
CREATE TABLE IF NOT EXISTS group_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL,
    event_id TEXT,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 5,
    created_by_device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking seat assignments
CREATE TABLE IF NOT EXISTS car_seat_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES group_cars(id) ON DELETE CASCADE,
    member_device_id TEXT NOT NULL,
    seat_position INTEGER NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(car_id, seat_position),
    UNIQUE(member_device_id, car_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_cars_group_id ON group_cars(group_id);
CREATE INDEX IF NOT EXISTS idx_group_cars_event_id ON group_cars(event_id);
CREATE INDEX IF NOT EXISTS idx_car_seat_assignments_car_id ON car_seat_assignments(car_id);
CREATE INDEX IF NOT EXISTS idx_car_seat_assignments_member_device_id ON car_seat_assignments(member_device_id);