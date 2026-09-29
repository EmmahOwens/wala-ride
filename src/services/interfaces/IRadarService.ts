import type { RadarLead, TripAlert } from '../../types/domain';

export interface IRadarService {
  createTripAlert(params: {
    passengerId: string;
    originTownId: string;
    destinationTownId: string;
    travelDate: string;
    seatsNeeded?: number;
  }): Promise<string | null>;

  getDriverRadarLeads(driverId: string): Promise<RadarLead[]>;

  revealLead(
    driverId: string,
    tripAlertId: string
  ): Promise<{ passenger_phone: string; passenger_name: string; alert_id: string } | null>;

  getPassengerAlerts(passengerId: string): Promise<TripAlert[]>;
}
