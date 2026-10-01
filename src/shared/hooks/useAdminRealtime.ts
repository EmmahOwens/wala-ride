import { useEffect, useRef } from 'react';
import { supabase } from '../../config/supabase';

export interface AdminRealtimeCallbacks {
  onIncidentUpdate?: (payload: any) => void;
  onDriverKYCUpdate?: (payload: any) => void;
  onSupportUpdate?: (payload: any) => void;
  onRouteChange?: (payload: any) => void;
}

export const useAdminRealtime = ({
  onIncidentUpdate,
  onDriverKYCUpdate,
  onSupportUpdate,
  onRouteChange,
}: AdminRealtimeCallbacks) => {
  const callbacksRef = useRef<AdminRealtimeCallbacks>({
    onIncidentUpdate,
    onDriverKYCUpdate,
    onSupportUpdate,
    onRouteChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onIncidentUpdate,
      onDriverKYCUpdate,
      onSupportUpdate,
      onRouteChange,
    };
  }, [onIncidentUpdate, onDriverKYCUpdate, onSupportUpdate, onRouteChange]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        (payload) => {
          callbacksRef.current.onIncidentUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_documents' },
        (payload) => {
          callbacksRef.current.onDriverKYCUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_profiles' },
        (payload) => {
          callbacksRef.current.onDriverKYCUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        (payload) => {
          callbacksRef.current.onSupportUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        (payload) => {
          callbacksRef.current.onSupportUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pickup_points' },
        (payload) => {
          callbacksRef.current.onRouteChange?.(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
