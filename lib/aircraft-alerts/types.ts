import type { AppStateId, StateCode } from "@/lib/app-states";
import type { AircraftTrackingPreferences } from "@/lib/aircraft-tracking";

export type AircraftAlertWebPushSubscription = {
  transport?: "web_push";
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type AircraftAlertFcmSubscription = {
  transport: "fcm";
  token: string;
};

export type AircraftAlertPushSubscription =
  | AircraftAlertWebPushSubscription
  | AircraftAlertFcmSubscription;

export type AircraftAlertSubscriber = {
  userId: string;
  enabled: boolean;
  subscription: AircraftAlertPushSubscription;
  stateCode: StateCode;
  excludedAircraftByState?: AircraftTrackingPreferences;
  createdAt: string;
  updatedAt: string;
  disabledAt?: string | null;
};

export type AircraftAlertStatus = {
  supported: boolean;
  configured: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  stateCode?: StateCode;
  stateId?: AppStateId;
  publicKey?: string;
  message?: string;
};
