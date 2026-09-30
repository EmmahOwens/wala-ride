import type { Town, PickupPoint, PickupPointKind } from '../../types/domain';

export interface IGeographyService {
  getTowns(): Promise<Town[]>;
  getPickupPoints(townId?: string): Promise<PickupPoint[]>;
  createPickupPoint(data: {
    town_id: string;
    name: string;
    kind: PickupPointKind;
    description?: string;
    lat?: number;
    lng?: number;
  }): Promise<PickupPoint | null>;
  findNearestPickupPoints(
    lat: number,
    lng: number,
    radiusMeters?: number,
    limit?: number
  ): Promise<(PickupPoint & { distance_km: number; distance_meters: number; town_name: string })[]>;
  findNearestTown(lat: number, lng: number): Promise<(Town & { distance_km: number }) | null>;
  computeRoute(
    origin: { lat: number; lng: number } | string,
    destination: { lat: number; lng: number } | string,
    waypoints?: ({ lat: number; lng: number } | string)[]
  ): Promise<{
    distance_km: number;
    estimated_duration_minutes: number;
    polyline: string;
    legs?: any[];
    stops_breakdown?: any[];
    simulated?: boolean;
  }>;
  autocompletePlaces(
    query: string,
    sessionToken?: string
  ): Promise<{ place_id: string; description: string; main_text: string; secondary_text: string }[]>;
}
