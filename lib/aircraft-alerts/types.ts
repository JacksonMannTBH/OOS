import type { AppStateId, StateCode } from "@/lib/app-states";

export type AircraftAlertPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type AircraftAlertSubscriber = {
  userId: string;
  enabled: boolean;
  subscription: AircraftAlertPushSubscription;
  stateCode: StateCode;
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
