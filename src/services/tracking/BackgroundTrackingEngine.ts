import { trackingService } from '../supabase/SupabaseTrackingService';

export interface TrackingEngineState {
  isBroadcasting: boolean;
  wakeLockActive: boolean;
  pingCount: number;
  lastPingTime: string | null;
  lastSpeed: number;
  lastLat: number;
  lastLng: number;
}

type StateListener = (state: TrackingEngineState) => void;

export class BackgroundTrackingEngine {
  private isBroadcasting: boolean = false;
  private wakeLockSentinel: any = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentTripId: string | null = null;
  private pingCount: number = 0;
  private lastPingTime: string | null = null;
  private lastSpeed: number = 72;
  private lastLat: number = 0.3476;
  private lastLng: number = 32.5825;
  private listeners: Set<StateListener> = new Set();

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public getState(): TrackingEngineState {
    return {
      isBroadcasting: this.isBroadcasting,
      wakeLockActive: !!this.wakeLockSentinel,
      pingCount: this.pingCount,
      lastPingTime: this.lastPingTime,
      lastSpeed: this.lastSpeed,
      lastLat: this.lastLat,
      lastLng: this.lastLng,
    };
  }

  /**
   * Request Screen Wake Lock so driver device does not sleep while navigating
   */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
          this.notify();
        });
        this.notify();
        return true;
      } catch (err) {
        console.warn('[TrackingEngine] Wake Lock request failed:', err);
      }
    }
    return false;
  }

  /**
   * Release Screen Wake Lock
   */
  public releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {
        // Ignored
      }
      this.wakeLockSentinel = null;
      this.notify();
    }
  }

  /**
   * Start broadcasting GPS pings in the background
   */
  public startBroadcasting(tripId: string, intervalMs: number = 20000): void {
    if (this.isBroadcasting && this.currentTripId === tripId) return;

    this.currentTripId = tripId;
    this.isBroadcasting = true;
    this.requestWakeLock();

    // Send immediate first ping
    this.sendPing();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.sendPing();
    }, intervalMs);

    this.notify();
  }

  /**
   * Stop broadcasting
   */
  public stopBroadcasting(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isBroadcasting = false;
    this.currentTripId = null;
    this.releaseWakeLock();
    this.notify();
  }

  /**
   * Execute single GPS ping
   */
  private async sendPing(): Promise<void> {
    if (!this.currentTripId) return;

    let lat = this.lastLat;
    let lng = this.lastLng;
    let speed = 70 + Math.floor(Math.random() * 15);
    let heading = 85;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        if (pos.coords.speed !== null) speed = Math.round(pos.coords.speed * 3.6);
        if (pos.coords.heading !== null) heading = pos.coords.heading;
      } catch {
        // Highway simulation progression
        const step = (this.pingCount + 1) * 0.004;
        lat = 0.3476 + step * 0.3;
        lng = 32.5825 + step;
      }
    } else {
      const step = (this.pingCount + 1) * 0.004;
      lat = 0.3476 + step * 0.3;
      lng = 32.5825 + step;
    }

    this.lastLat = lat;
    this.lastLng = lng;
    this.lastSpeed = speed;
    this.pingCount += 1;
    this.lastPingTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    try {
      await trackingService.recordLocation({
        tripId: this.currentTripId,
        lat,
        lng,
        speed,
        heading,
        accuracy: 6,
      });
    } catch (err) {
      console.warn('[TrackingEngine] Failed to record location ping:', err);
    }

    this.notify();
  }
}

export const backgroundTrackingEngine = new BackgroundTrackingEngine();
