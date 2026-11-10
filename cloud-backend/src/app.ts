import { runtime } from "./runtime";
import { createAppHandler } from "./app-handler";

runtime.serve(createAppHandler());
