import { runtime } from "./runtime";
import { createNotificationsHandler } from "./notifications-handler";

runtime.serve(createNotificationsHandler());
