export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          active: boolean
          created_at: string
          data: Json
          id: string
          key: string
          message: string
          resolved_at: string | null
          restaurant_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          type: Database["public"]["Enums"]["alert_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          data?: Json
          id?: string
          key: string
          message: string
          resolved_at?: string | null
          restaurant_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          type: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          data?: Json
          id?: string
          key?: string
          message?: string
          resolved_at?: string | null
          restaurant_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          type?: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          last4: string
          name: string
          restaurant_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          last4: string
          name?: string
          restaurant_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          last4?: string
          name?: string
          restaurant_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount: number
          created_at: string
          data: Json
          description: string
          id: string
          order_id: string | null
          period_end: string | null
          period_start: string | null
          restaurant_id: string
          subscription_id: string | null
          type: Database["public"]["Enums"]["billing_event_type"]
        }
        Insert: {
          amount?: number
          created_at?: string
          data?: Json
          description: string
          id?: string
          order_id?: string | null
          period_end?: string | null
          period_start?: string | null
          restaurant_id: string
          subscription_id?: string | null
          type: Database["public"]["Enums"]["billing_event_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          data?: Json
          description?: string
          id?: string
          order_id?: string | null
          period_end?: string | null
          period_start?: string | null
          restaurant_id?: string
          subscription_id?: string | null
          type?: Database["public"]["Enums"]["billing_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          orders_count: number
          phone: string | null
          region: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          orders_count?: number
          phone?: string | null
          region?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          orders_count?: number
          phone?: string | null
          region?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_attempts: {
        Row: {
          attempt_number: number
          counts_for_acceptance: boolean
          created_at: string
          distance_pickup_km: number | null
          distance_total_km: number | null
          expires_at: string
          id: string
          motoboy_id: string
          offered_at: string
          order_id: string
          outcome: Database["public"]["Enums"]["dispatch_outcome"] | null
          payout_estimate: number | null
          quality: Database["public"]["Enums"]["offer_quality"] | null
          quality_factors: Json
          quality_score: number | null
          reason: string | null
          responded_at: string | null
          restaurant_id: string
          score: number | null
          score_breakdown: Json
        }
        Insert: {
          attempt_number?: number
          counts_for_acceptance?: boolean
          created_at?: string
          distance_pickup_km?: number | null
          distance_total_km?: number | null
          expires_at?: string
          id?: string
          motoboy_id: string
          offered_at?: string
          order_id: string
          outcome?: Database["public"]["Enums"]["dispatch_outcome"] | null
          payout_estimate?: number | null
          quality?: Database["public"]["Enums"]["offer_quality"] | null
          quality_factors?: Json
          quality_score?: number | null
          reason?: string | null
          responded_at?: string | null
          restaurant_id: string
          score?: number | null
          score_breakdown?: Json
        }
        Update: {
          attempt_number?: number
          counts_for_acceptance?: boolean
          created_at?: string
          distance_pickup_km?: number | null
          distance_total_km?: number | null
          expires_at?: string
          id?: string
          motoboy_id?: string
          offered_at?: string
          order_id?: string
          outcome?: Database["public"]["Enums"]["dispatch_outcome"] | null
          payout_estimate?: number | null
          quality?: Database["public"]["Enums"]["offer_quality"] | null
          quality_factors?: Json
          quality_score?: number | null
          reason?: string | null
          responded_at?: string | null
          restaurant_id?: string
          score?: number | null
          score_breakdown?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_attempts_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_attempts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_lock: {
        Row: {
          id: number
          leased_at: string
        }
        Insert: {
          id?: number
          leased_at?: string
        }
        Update: {
          id?: number
          leased_at?: string
        }
        Relationships: []
      }
      dispatch_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          expired: number
          failed: number
          finished_at: string | null
          id: string
          offered: number
          restaurant_id: string | null
          skipped: boolean
          source: string
          started_at: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          expired?: number
          failed?: number
          finished_at?: string | null
          id?: string
          offered?: number
          restaurant_id?: string | null
          skipped?: boolean
          source?: string
          started_at?: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          expired?: number
          failed?: number
          finished_at?: string | null
          id?: string
          offered?: number
          restaurant_id?: string | null
          skipped?: boolean
          source?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_incidents: {
        Row: {
          created_at: string
          id: string
          motoboy_id: string
          note: string | null
          order_id: string | null
          origin: Database["public"]["Enums"]["incident_origin"]
          restaurant_id: string | null
          severity: number
          type: Database["public"]["Enums"]["incident_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          motoboy_id: string
          note?: string | null
          order_id?: string | null
          origin?: Database["public"]["Enums"]["incident_origin"]
          restaurant_id?: string | null
          severity?: number
          type: Database["public"]["Enums"]["incident_type"]
        }
        Update: {
          created_at?: string
          id?: string
          motoboy_id?: string
          note?: string | null
          order_id?: string | null
          origin?: Database["public"]["Enums"]["incident_origin"]
          restaurant_id?: string | null
          severity?: number
          type?: Database["public"]["Enums"]["incident_type"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_incidents_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          id: number
          latitude: number
          longitude: number
          motoboy_id: string
          order_id: string | null
          recorded_at: string
          restaurant_id: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          id?: never
          latitude: number
          longitude: number
          motoboy_id: string
          order_id?: string | null
          recorded_at?: string
          restaurant_id: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          id?: never
          latitude?: number
          longitude?: number
          motoboy_id?: string
          order_id?: string | null
          recorded_at?: string
          restaurant_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      error_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          message: string
          restaurant_id: string | null
          scope: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          message: string
          restaurant_id?: string | null
          scope: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          message?: string
          restaurant_id?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          attempts: number
          created_at: string
          direction: string
          error: string | null
          event_id: string | null
          external_order_id: string | null
          id: string
          order_id: string | null
          payload: Json
          processed_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          restaurant_id: string | null
          signature_valid: boolean | null
          status: Database["public"]["Enums"]["integration_event_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          direction?: string
          error?: string | null
          event_id?: string | null
          external_order_id?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          restaurant_id?: string | null
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["integration_event_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          direction?: string
          error?: string | null
          event_id?: string | null
          external_order_id?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          restaurant_id?: string | null
          signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["integration_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          credentials_set: boolean
          id: string
          last_event_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          restaurant_id: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          webhook_secret_hint: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials_set?: boolean
          id?: string
          last_event_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          restaurant_id: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          webhook_secret_hint?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_set?: boolean
          id?: string
          last_event_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          restaurant_id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          webhook_secret_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      motoboys: {
        Row: {
          acceptance_rate: number
          active: boolean
          avg_delay_min: number
          blocked: boolean
          blocked_reason: string | null
          completion_rate_pct: number
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          deliveries_completed: number
          deliveries_late: number
          deliveries_total: number
          fleet: Database["public"]["Enums"]["driver_fleet"]
          full_name: string
          id: string
          location_updated_at: string | null
          max_concurrent_deliveries: number
          offers_adequate: number
          offers_adequate_accepted: number
          phone: string
          punctuality_rate: number
          rating: number
          reliability_index: number
          reputation_updated_at: string | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["motoboy_status"]
          updated_at: string
          user_id: string | null
          vehicle: string | null
        }
        Insert: {
          acceptance_rate?: number
          active?: boolean
          avg_delay_min?: number
          blocked?: boolean
          blocked_reason?: string | null
          completion_rate_pct?: number
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          deliveries_completed?: number
          deliveries_late?: number
          deliveries_total?: number
          fleet?: Database["public"]["Enums"]["driver_fleet"]
          full_name: string
          id?: string
          location_updated_at?: string | null
          max_concurrent_deliveries?: number
          offers_adequate?: number
          offers_adequate_accepted?: number
          phone: string
          punctuality_rate?: number
          rating?: number
          reliability_index?: number
          reputation_updated_at?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["motoboy_status"]
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
        }
        Update: {
          acceptance_rate?: number
          active?: boolean
          avg_delay_min?: number
          blocked?: boolean
          blocked_reason?: string | null
          completion_rate_pct?: number
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          deliveries_completed?: number
          deliveries_late?: number
          deliveries_total?: number
          fleet?: Database["public"]["Enums"]["driver_fleet"]
          full_name?: string
          id?: string
          location_updated_at?: string | null
          max_concurrent_deliveries?: number
          offers_adequate?: number
          offers_adequate_accepted?: number
          phone?: string
          punctuality_rate?: number
          rating?: number
          reliability_index?: number
          reputation_updated_at?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["motoboy_status"]
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoboys_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motoboys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          data: Json
          error: string | null
          id: string
          order_id: string | null
          recipient: string | null
          recipient_type: Database["public"]["Enums"]["notification_recipient"]
          restaurant_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
          title: string | null
        }
        Insert: {
          attempts?: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          order_id?: string | null
          recipient?: string | null
          recipient_type: Database["public"]["Enums"]["notification_recipient"]
          restaurant_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
          title?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          order_id?: string | null
          recipient?: string | null
          recipient_type?: Database["public"]["Enums"]["notification_recipient"]
          restaurant_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string
          data: Json
          id: number
          order_id: string
          restaurant_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          data?: Json
          id?: never
          order_id: string
          restaurant_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          data?: Json
          id?: never
          order_id?: string
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          order_id: string
          quantity: number
          restaurant_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          order_id: string
          quantity?: number
          restaurant_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          restaurant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          restaurant_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          restaurant_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_address: string
          customer_fee: number | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee: number
          dispatch_attempts: number
          dispatch_state: Database["public"]["Enums"]["dispatch_state"]
          dispatched_at: string | null
          driver_payout: number | null
          eta_computed_at: string | null
          eta_max: number | null
          eta_min: number | null
          external_id: string | null
          group_id: string | null
          id: string
          in_route_at: string | null
          latitude: number | null
          leeva_fee: number | null
          logistics_margin: number | null
          longitude: number | null
          motoboy_id: string | null
          notes: string | null
          order_amount: number
          order_number: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          preparing_at: string | null
          ready_at: string | null
          region: string | null
          restaurant_id: string
          route_distance_km: number | null
          route_duration_min: number | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_address: string
          customer_fee?: number | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          dispatch_attempts?: number
          dispatch_state?: Database["public"]["Enums"]["dispatch_state"]
          dispatched_at?: string | null
          driver_payout?: number | null
          eta_computed_at?: string | null
          eta_max?: number | null
          eta_min?: number | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          in_route_at?: string | null
          latitude?: number | null
          leeva_fee?: number | null
          logistics_margin?: number | null
          longitude?: number | null
          motoboy_id?: string | null
          notes?: string | null
          order_amount?: number
          order_number?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          region?: string | null
          restaurant_id: string
          route_distance_km?: number | null
          route_duration_min?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_address?: string
          customer_fee?: number | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee?: number
          dispatch_attempts?: number
          dispatch_state?: Database["public"]["Enums"]["dispatch_state"]
          dispatched_at?: string | null
          driver_payout?: number | null
          eta_computed_at?: string | null
          eta_max?: number | null
          eta_min?: number | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          in_route_at?: string | null
          latitude?: number | null
          leeva_fee?: number | null
          logistics_margin?: number | null
          longitude?: number | null
          motoboy_id?: string | null
          notes?: string | null
          order_amount?: number
          order_number?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          region?: string | null
          restaurant_id?: string
          route_distance_km?: number | null
          route_duration_min?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_policies: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          name: string
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_policies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          features: Json
          id: string
          monthly_price: number
          name: string
          per_delivery_margin: number
          per_delivery_price: number
          sort_order: number
          trial_days: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          features?: Json
          id?: string
          monthly_price?: number
          name: string
          per_delivery_margin?: number
          per_delivery_price?: number
          sort_order?: number
          trial_days?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          features?: Json
          id?: string
          monthly_price?: number
          name?: string
          per_delivery_margin?: number
          per_delivery_price?: number
          sort_order?: number
          trial_days?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          name: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          name?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      reputation_config: {
        Row: {
          config: Json
          id: number
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          fleet_mode: Database["public"]["Enums"]["fleet_mode"]
          id: string
          latitude: number | null
          logistics_config: Json
          longitude: number | null
          name: string
          onboarding_completed: boolean
          phone: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          fleet_mode?: Database["public"]["Enums"]["fleet_mode"]
          id?: string
          latitude?: number | null
          logistics_config?: Json
          longitude?: number | null
          name: string
          onboarding_completed?: boolean
          phone?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          fleet_mode?: Database["public"]["Enums"]["fleet_mode"]
          id?: string
          latitude?: number | null
          logistics_config?: Json
          longitude?: number | null
          name?: string
          onboarding_completed?: boolean
          phone?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          restaurant_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          order_id: string
          restaurant_id: string
          revoked: boolean
          token: string
          views: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          order_id: string
          restaurant_id: string
          revoked?: boolean
          token: string
          views?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          order_id?: string
          restaurant_id?: string
          revoked?: boolean
          token?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracking_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          restaurant_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_dispatch_lease: {
        Args: { ttl_seconds?: number }
        Returns: boolean
      }
      cleanup_driver_locations: {
        Args: { retention?: string }
        Returns: number
      }
      configure_dispatch_cron: {
        Args: { p_schedule?: string; p_secret: string; p_target_url: string }
        Returns: string
      }
      current_motoboy_id: { Args: never; Returns: string }
      current_restaurant_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      is_platform_admin: { Args: never; Returns: boolean }
      motoboy_completion_rate: {
        Args: { m: Database["public"]["Tables"]["motoboys"]["Row"] }
        Returns: number
      }
      rate_limit_check: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after: number
        }[]
      }
      release_dispatch_lease: { Args: never; Returns: undefined }
      release_lock: { Args: { key: string }; Returns: boolean }
      trigger_dispatch_tick: { Args: never; Returns: undefined }
      try_lock: { Args: { key: string }; Returns: boolean }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical" | "ok"
      alert_type:
        | "delay"
        | "no_driver"
        | "demand_spike"
        | "normal"
        | "long_prep"
      billing_event_type:
        | "subscription_fee"
        | "delivery_fee"
        | "adjustment"
        | "credit"
      dispatch_outcome:
        | "accepted"
        | "declined"
        | "timeout"
        | "cancelled"
        | "expired"
      dispatch_state: "none" | "searching" | "offered" | "assigned" | "failed"
      driver_fleet: "own" | "leeva"
      fleet_mode: "own" | "leeva" | "hybrid"
      incident_origin:
        | "driver"
        | "restaurant"
        | "customer"
        | "system"
        | "unknown"
      incident_type:
        | "decline_adequate_offer"
        | "cancel_after_accept"
        | "abandon"
        | "no_show"
        | "late_delivery"
        | "complaint"
      integration_event_status:
        | "received"
        | "processed"
        | "failed"
        | "duplicate"
        | "ignored"
      integration_provider: "ifood" | "whatsapp" | "sms" | "push" | "maps"
      integration_status: "implemented" | "prepared" | "mock" | "disabled"
      motoboy_status: "offline" | "available" | "on_delivery"
      notification_channel: "in_app" | "whatsapp" | "sms" | "push"
      notification_recipient: "customer" | "restaurant" | "motoboy"
      notification_status: "pending" | "sent" | "failed" | "skipped"
      offer_quality: "excellent" | "good" | "acceptable" | "poor"
      order_source: "manual" | "ifood" | "whatsapp" | "menu" | "api"
      order_status:
        | "waiting_dispatch"
        | "preparing"
        | "ready"
        | "assigned"
        | "picked_up"
        | "in_route"
        | "delivered"
        | "cancelled"
      payment_method:
        | "cash"
        | "card_on_delivery"
        | "online"
        | "pix"
        | "other"
        | "unknown"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      user_role: "restaurant_owner" | "restaurant_staff" | "motoboy"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "warning", "critical", "ok"],
      alert_type: ["delay", "no_driver", "demand_spike", "normal", "long_prep"],
      billing_event_type: [
        "subscription_fee",
        "delivery_fee",
        "adjustment",
        "credit",
      ],
      dispatch_outcome: [
        "accepted",
        "declined",
        "timeout",
        "cancelled",
        "expired",
      ],
      dispatch_state: ["none", "searching", "offered", "assigned", "failed"],
      driver_fleet: ["own", "leeva"],
      fleet_mode: ["own", "leeva", "hybrid"],
      incident_origin: [
        "driver",
        "restaurant",
        "customer",
        "system",
        "unknown",
      ],
      incident_type: [
        "decline_adequate_offer",
        "cancel_after_accept",
        "abandon",
        "no_show",
        "late_delivery",
        "complaint",
      ],
      integration_event_status: [
        "received",
        "processed",
        "failed",
        "duplicate",
        "ignored",
      ],
      integration_provider: ["ifood", "whatsapp", "sms", "push", "maps"],
      integration_status: ["implemented", "prepared", "mock", "disabled"],
      motoboy_status: ["offline", "available", "on_delivery"],
      notification_channel: ["in_app", "whatsapp", "sms", "push"],
      notification_recipient: ["customer", "restaurant", "motoboy"],
      notification_status: ["pending", "sent", "failed", "skipped"],
      offer_quality: ["excellent", "good", "acceptable", "poor"],
      order_source: ["manual", "ifood", "whatsapp", "menu", "api"],
      order_status: [
        "waiting_dispatch",
        "preparing",
        "ready",
        "assigned",
        "picked_up",
        "in_route",
        "delivered",
        "cancelled",
      ],
      payment_method: [
        "cash",
        "card_on_delivery",
        "online",
        "pix",
        "other",
        "unknown",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      user_role: ["restaurant_owner", "restaurant_staff", "motoboy"],
    },
  },
} as const
