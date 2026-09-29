-- ============================================================================
-- MIGRATION: FIX BOOK_SEGMENT COLUMN AMBIGUITY
-- ============================================================================

create or replace function book_segment(
  p_trip_id uuid,
  p_passenger_id uuid,
  p_origin_trip_stop_id uuid,
  p_destination_trip_stop_id uuid,
  p_seat_count int,
  p_fare_ugx int,
  p_booking_type booking_type_enum default 'seat',
  p_hold_minutes int default 15
) returns table (booking_id uuid, booking_segment_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origin_seq int;
  v_dest_seq int;
  v_seats_total int;
  v_max_occupied int;
  v_booking_id uuid;
  v_segment_id uuid;
  v_expires_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_trip_id::text));

  select sequence into v_origin_seq from trip_stops where id = p_origin_trip_stop_id and trip_id = p_trip_id;
  select sequence into v_dest_seq from trip_stops where id = p_destination_trip_stop_id and trip_id = p_trip_id;

  if v_origin_seq is null or v_dest_seq is null then
    raise exception 'STOP_NOT_ON_TRIP';
  end if;
  if v_origin_seq >= v_dest_seq then
    raise exception 'INVALID_STOP_ORDER';
  end if;

  select seats_total into v_seats_total from trips where id = p_trip_id for update;
  if v_seats_total is null then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  -- lazily expire any holds that lapsed before we compute occupancy
  update booking_segments bs
     set status = 'expired'
   where bs.trip_id = p_trip_id and bs.status = 'held' and bs.expires_at < now();

  select coalesce(max(occupied), 0) into v_max_occupied
  from (
    select gap.seq, coalesce(sum(bs.seat_count), 0) as occupied
    from generate_series(v_origin_seq, v_dest_seq - 1) as gap(seq)
    left join booking_segments bs
      on bs.trip_id = p_trip_id
     and bs.status in ('held', 'confirmed')
     and bs.origin_sequence <= gap.seq
     and bs.destination_sequence > gap.seq
    group by gap.seq
  ) occ;

  if v_max_occupied + p_seat_count > v_seats_total then
    raise exception 'SEATS_UNAVAILABLE';
  end if;

  v_expires_at := now() + (p_hold_minutes || ' minutes')::interval;

  insert into bookings (passenger_id, trip_id, booking_type, status, total_seats, total_fare_ugx)
  values (p_passenger_id, p_trip_id, p_booking_type, 'held', p_seat_count, p_fare_ugx)
  returning id into v_booking_id;

  insert into booking_segments (
    booking_id, trip_id, origin_trip_stop_id, destination_trip_stop_id,
    origin_sequence, destination_sequence, seat_count, fare_ugx, status, expires_at
  ) values (
    v_booking_id, p_trip_id, p_origin_trip_stop_id, p_destination_trip_stop_id,
    v_origin_seq, v_dest_seq, p_seat_count, p_fare_ugx, 'held', v_expires_at
  ) returning id into v_segment_id;

  return query select v_booking_id, v_segment_id, v_expires_at;
end;
$$;
