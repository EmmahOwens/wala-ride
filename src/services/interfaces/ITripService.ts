import type { Route, RouteStop, Trip, TripStatus, TripManifest } from '../../types/domain';

export interface ITripService {
  getRoutes(): Promise<Route[]>;
  getRouteStops(routeId: string): Promise<RouteStop[]>;
  publishTrip(params: {
    driverId: string;
    vehicleId: string;
    routeId: string;
    departsAt: string;
    baseFareUgx: number;
    notes?: string;
  }): Promise<{ tripId: string | null; error: Error | null }>;
  getDriverTrips(driverId: string): Promise<Trip[]>;
  getTripManifest(tripId: string): Promise<TripManifest | null>;
  updateTripStatus(tripId: string, status: TripStatus): Promise<boolean>;
}
