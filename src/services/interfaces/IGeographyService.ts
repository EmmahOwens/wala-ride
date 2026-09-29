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
}
