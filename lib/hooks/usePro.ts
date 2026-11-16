"use client";
import { useSyncExternalStore } from "react";
import { proSnapshot, proServerSnapshot, subscribePro } from "../pro-access";
export function usePro() { return useSyncExternalStore(subscribePro, proSnapshot, proServerSnapshot); }
